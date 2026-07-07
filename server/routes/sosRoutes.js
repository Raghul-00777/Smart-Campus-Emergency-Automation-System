const express = require('express');
const SOS = require('../models/SOS');
const User = require('../models/User');
const Log = require('../models/Log');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Create SOS alert (Student)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can create SOS alerts' });
    }

    const { latitude, longitude, description } = req.body;

    const sos = new SOS({
      student: req.user._id,
      department: req.user.department,
      location: {
        latitude,
        longitude,
        address: ''
      },
      description: description || ''
    });

    await sos.save();

    // Log SOS
    await Log.create({
      user: req.user._id,
      type: 'sos',
      action: 'SOS alert created',
      details: `Department: ${req.user.department}`,
      status: 'success'
    });

    // Emit to connected faculty via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('new-sos', {
        sos: await SOS.findById(sos._id).populate('student', 'name email department')
      });
    }

    res.status(201).json({ message: 'SOS alert sent successfully', sos });
  } catch (error) {
    await Log.create({
      user: req.user._id,
      type: 'sos',
      action: 'SOS creation failed',
      details: error.message,
      status: 'failed'
    });
    res.status(500).json({ message: 'Failed to create SOS', error: error.message });
  }
});

// Get active SOS alerts (Faculty/Admin)
router.get('/active', authMiddleware, async (req, res) => {
  try {
    let query = { status: 'active' };

    if (req.user.role === 'faculty') {
      query.department = { $in: [req.user.department, 'ALL'] };
    }

    const sosAlerts = await SOS.find(query)
      .populate('student', 'name email department rollNumber phone')
      .sort({ createdAt: -1 });

    res.json(sosAlerts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch SOS alerts', error: error.message });
  }
});

// Get all SOS alerts (Admin)
router.get('/all', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { status, department, fromDate, toDate } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const sosAlerts = await SOS.find(query)
      .populate('student', 'name email department rollNumber')
      .populate('acceptedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(sosAlerts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch SOS alerts', error: error.message });
  }
});

// Accept SOS (Faculty)
router.put('/:id/accept', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only faculty can accept SOS alerts' });
    }

    const sos = await SOS.findById(req.params.id);
    
    if (!sos) {
      return res.status(404).json({ message: 'SOS alert not found' });
    }

    if (sos.status !== 'active') {
      return res.status(400).json({ message: 'SOS alert is not active' });
    }

    sos.status = 'accepted';
    sos.acceptedBy = req.user._id;
    await sos.save();

    // Emit update
    const io = req.app.get('io');
    if (io) {
      io.emit('sos-accepted', {
        sosId: sos._id,
        acceptedBy: { id: req.user._id, name: req.user.name }
      });
    }

    res.json({ message: 'SOS accepted successfully', sos });
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept SOS', error: error.message });
  }
});

// Resolve SOS
router.put('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const sos = await SOS.findById(req.params.id);
    
    if (!sos) {
      return res.status(404).json({ message: 'SOS alert not found' });
    }

    if (sos.status === 'resolved') {
      return res.status(400).json({ message: 'SOS already resolved' });
    }

    sos.status = 'resolved';
    sos.resolvedAt = new Date();
    await sos.save();

    // Emit update
    const io = req.app.get('io');
    if (io) {
      io.emit('sos-resolved', { sosId: sos._id });
    }

    res.json({ message: 'SOS resolved successfully', sos });
  } catch (error) {
    res.status(500).json({ message: 'Failed to resolve SOS', error: error.message });
  }
});

// Cancel SOS (Student - own SOS only)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const sos = await SOS.findById(req.params.id);
    
    if (!sos) {
      return res.status(404).json({ message: 'SOS alert not found' });
    }

    if (sos.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to cancel this SOS' });
    }

    if (sos.status !== 'active') {
      return res.status(400).json({ message: 'Cannot cancel resolved or accepted SOS' });
    }

    sos.status = 'cancelled';
    await sos.save();

    res.json({ message: 'SOS cancelled successfully', sos });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel SOS', error: error.message });
  }
});

// Get my SOS history (Student)
router.get('/my-history', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can view their SOS history' });
    }

    const sosAlerts = await SOS.find({ student: req.user._id })
      .populate('acceptedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(sosAlerts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch SOS history', error: error.message });
  }
});

// Get SOS stats (Admin)
router.get('/stats', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const total = await SOS.countDocuments();
    const active = await SOS.countDocuments({ status: 'active' });
    const accepted = await SOS.countDocuments({ status: 'accepted' });
    const resolved = await SOS.countDocuments({ status: 'resolved' });

    const byDepartment = await SOS.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    res.json({ total, active, accepted, resolved, byDepartment });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch SOS stats', error: error.message });
  }
});

module.exports = router;