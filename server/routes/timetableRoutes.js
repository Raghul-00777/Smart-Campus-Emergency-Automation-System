const express = require('express');
const Timetable = require('../models/Timetable');
const Log = require('../models/Log');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Get timetable for department (All users)
router.get('/:department', authMiddleware, async (req, res) => {
  try {
    const { department } = req.params;
    const { day } = req.query;

    let query = { 
      department: department,
      isActive: true 
    };
    
    if (day) {
      query.day = day;
    }

    const timetable = await Timetable.find(query)
      .populate('faculty', 'name email')
      .sort({ timeSlot: 1 });

    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timetable', error: error.message });
  }
});

// Get all timetables (Admin/Faculty)
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { department, day } = req.query;
    
    let query = {};
    if (department) query.department = department;
    if (day) query.day = day;

    const timetable = await Timetable.find(query)
      .populate('faculty', 'name email department')
      .sort({ department: 1, day: 1, timeSlot: 1 });

    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timetable', error: error.message });
  }
});

// Create timetable entry (Faculty/Admin)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to create timetable' });
    }

    const { department, day, timeSlot, subject, room } = req.body;

    // Check if entry already exists
    const existing = await Timetable.findOne({
      department,
      day,
      timeSlot,
      isActive: true
    });

    if (existing) {
      return res.status(400).json({ message: ' timetable entry already exists for this slot' });
    }

    const timetable = new Timetable({
      department,
      day,
      timeSlot,
      subject,
      faculty: req.user._id,
      room: room || ''
    });

    await timetable.save();

    await Log.create({
      user: req.user._id,
      type: 'timetable',
      action: 'Timetable entry created',
      details: `${subject} - ${department} - ${day} - ${timeSlot}`,
      status: 'success'
    });

    res.status(201).json({ message: 'Timetable entry created', timetable });
  } catch (error) {
    await Log.create({
      user: req.user._id,
      type: 'timetable',
      action: 'Timetable creation failed',
      details: error.message,
      status: 'failed'
    });
    res.status(500).json({ message: 'Failed to create timetable', error: error.message });
  }
});

// Update timetable entry (Faculty/Admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const timetable = await Timetable.findById(req.params.id);
    
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable entry not found' });
    }

    // Faculty can only edit their own entries
    if (req.user.role === 'faculty' && timetable.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this entry' });
    }

    const { subject, room } = req.body;
    if (subject) timetable.subject = subject;
    if (room !== undefined) timetable.room = room;

    await timetable.save();

    res.json({ message: 'Timetable updated', timetable });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update timetable', error: error.message });
  }
});

// Delete timetable entry (Faculty/Admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const timetable = await Timetable.findById(req.params.id);
    
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable entry not found' });
    }

    // Faculty can only delete their own entries
    if (req.user.role === 'faculty' && timetable.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this entry' });
    }

    timetable.isActive = false;
    await timetable.save();

    res.json({ message: 'Timetable entry deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete timetable', error: error.message });
  }
});

// Get current class for student (based on time)
router.get('/current/class', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can access this' });
    }

    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = now.getHours();
    const timeSlot = `${hour}-${hour + 1}`;

    const currentClass = await Timetable.findOne({
      department: req.user.department,
      day,
      timeSlot,
      isActive: true
    }).populate('faculty', 'name email');

    if (!currentClass) {
      return res.json({ message: 'No class scheduled at this time', currentClass: null });
    }

    res.json({ currentClass });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch current class', error: error.message });
  }
});

module.exports = router;