const express = require('express');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Timetable = require('../models/Timetable');
const Log = require('../models/Log');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Haversine formula to calculate distance in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get campus location (hardcoded for now - can be configured)
const CAMPUS_LOCATION = {
  latitude: 17.4419,  // Replace with actual campus latitude
  longitude: 78.5089 // Replace with actual campus longitude
};
const ATTENDANCE_RADIUS = 50; // 50 meters

// Auto mark attendance (Student)
router.post('/auto-mark', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can mark attendance' });
    }

    const { latitude, longitude } = req.body;

    // Calculate distance from campus
    const distance = calculateDistance(
      latitude, longitude,
      CAMPUS_LOCATION.latitude, CAMPUS_LOCATION.longitude
    );

    if (distance > ATTENDANCE_RADIUS) {
      return res.status(400).json({ 
        message: `You are ${Math.round(distance)}m away from campus. Need to be within ${ATTENDANCE_RADIUS}m to mark attendance.`,
        distance: Math.round(distance)
      });
    }

    // Get current time slot
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = now.getHours();
    const timeSlot = `${hour}-${hour + 1}`;

    // Check if already marked today
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const existingAttendance = await Attendance.findOne({
      student: req.user._id,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existingAttendance) {
      return res.status(400).json({ message: 'Attendance already marked for today' });
    }

    // Create attendance record
    const attendance = new Attendance({
      student: req.user._id,
      department: req.user.department,
      date: new Date(),
      approvalStatus: 'PENDING',
      status: 'auto-marked',
      isAutoMarked: true,
      location: { latitude, longitude },
      timeSlot
    });

    await attendance.save();

    const io = req.app.get('io');
    const payload = {
      attendanceId: attendance._id,
      student: {
        _id: req.user._id,
        name: req.user.name,
        department: req.user.department
      },
      timeSlot,
      distance: Math.round(distance),
      createdAt: attendance.createdAt
    };

    if (io) {
      io.to('faculty-room').emit('attendanceRequest', payload);
      if (req.user.department) {
        io.to(`dept-${req.user.department}`).emit('attendanceRequest', payload);
      }
    }

    await Log.create({
      user: req.user._id,
      type: 'attendance',
      action: 'Auto attendance marked',
      details: `Distance: ${Math.round(distance)}m, Department: ${req.user.department}`,
      status: 'success'
    });

    res.status(201).json({ 
      message: 'Attendance marked successfully!',
      distance: Math.round(distance),
      attendance 
    });
  } catch (error) {
    await Log.create({
      user: req.user._id,
      type: 'attendance',
      action: 'Auto attendance failed',
      details: error.message,
      status: 'failed'
    });
    res.status(500).json({ message: 'Failed to mark attendance', error: error.message });
  }
});

// Get pending attendance requests (Faculty/Admin)
router.get('/pending', authMiddleware, roleMiddleware('faculty', 'admin'), async (req, res) => {
  try {
    const targetDepartment = req.user.department || req.query.department;
    if (!targetDepartment) {
      return res.status(400).json({ message: 'Department is required' });
    }

    const pendingRecords = await Attendance.find({
      department: targetDepartment,
      approvalStatus: 'PENDING'
    })
      .populate('student', 'name email department rollNumber')
      .sort({ createdAt: -1 });

    res.json(pendingRecords);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pending attendance', error: error.message });
  }
});

// Update approval status for attendance (Faculty/Admin)
router.patch('/:id', authMiddleware, roleMiddleware('faculty', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PRESENT', 'ABSENT'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    attendance.approvalStatus = status;
    attendance.status = status === 'PRESENT' ? 'approved' : 'rejected';
    attendance.markedBy = req.user._id;
    attendance.markedAt = new Date();
    await attendance.save();

    res.json({ message: 'Attendance status updated', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update attendance status', error: error.message });
  }
});

// Get my attendance (Student)
router.get('/my', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can view their attendance' });
    }

    const { fromDate, toDate } = req.query;
    
    let query = { student: req.user._id };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const attendance = await Attendance.find(query)
      .populate('markedBy', 'name email')
      .sort({ date: -1 });

    // Calculate stats
    const total = attendance.length;
    const present = attendance.filter(a => 
      ['present', 'auto-marked', 'approved'].includes(a.status) || a.approvalStatus === 'PRESENT'
    ).length;
    const absent = attendance.filter(a => a.status === 'absent' || a.approvalStatus === 'ABSENT').length;
    const autoMarked = attendance.filter(a => a.isAutoMarked).length;

    res.json({
      records: attendance,
      stats: { total, present, absent, autoMarked, percentage: total > 0 ? Math.round((present / total) * 100) : 0 }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message });
  }
});

// Get department attendance (Faculty/Admin)
router.get('/department/:department', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const attendance = await Attendance.find({
      department: req.params.department,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('student', 'name email rollNumber');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message });
  }
});

// Approve/Reject attendance (Faculty)
router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    attendance.status = 'approved';
    attendance.approvalStatus = 'PRESENT';
    attendance.markedBy = req.user._id;
    await attendance.save();

    await Log.create({
      user: req.user._id,
      type: 'attendance',
      action: 'Attendance approved',
      details: `Student: ${attendance.student}`,
      status: 'success'
    });

    res.json({ message: 'Attendance approved', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve attendance', error: error.message });
  }
});

router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    attendance.status = 'rejected';
    attendance.approvalStatus = 'ABSENT';
    attendance.markedBy = req.user._id;
    await attendance.save();

    await Log.create({
      user: req.user._id,
      type: 'attendance',
      action: 'Attendance rejected',
      details: `Student: ${attendance.student}`,
      status: 'success'
    });

    res.json({ message: 'Attendance rejected', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject attendance', error: error.message });
  }
});

// Delete attendance (Faculty/Admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Attendance.findByIdAndDelete(req.params.id);

    res.json({ message: 'Attendance deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete attendance', error: error.message });
  }
});

// Get attendance stats (Admin)
router.get('/stats', authMiddleware, roleMiddleware('admin', 'faculty'), async (req, res) => {
  try {
    const { department, fromDate, toDate } = req.query;
    
    let query = {};
    if (department) query.department = department;
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const attendance = await Attendance.find(query).populate('student', 'name department');
    
    const total = attendance.length;
    const approved = attendance.filter(a => a.status === 'approved').length;
    const rejected = attendance.filter(a => a.status === 'rejected').length;
    const pending = attendance.filter(a => a.status === 'auto-marked').length;
    const autoMarked = attendance.filter(a => a.isAutoMarked).length;

    res.json({
      total,
      approved,
      rejected,
      pending,
      autoMarked,
      percentage: total > 0 ? Math.round((approved / total) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
});

module.exports = router;
