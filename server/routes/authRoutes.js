const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Log = require('../models/Log');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, department, rollNumber, employeeId, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = new User({
      name,
      email,
      password,
      role: role || 'student',
      department,
      rollNumber: rollNumber || null,
      employeeId: employeeId || null,
      phone: phone || null
    });

    await user.save();

    // Log registration
    await Log.create({
      user: user._id,
      type: 'register',
      action: 'User registered',
      details: `Role: ${role}, Department: ${department}`,
      status: 'success'
    });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    await Log.create({
      type: 'register',
      action: 'Registration failed',
      details: error.message,
      status: 'failed'
    });
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, userId } = req.body;

    let user;

    // Check for admin login
    if (userId === process.env.ADMIN_ID && password === process.env.ADMIN_PASSWORD) {
      user = await User.findOne({ role: 'admin' });
      if (!user) {
        // Create admin user if not exists
        user = new User({
          name: 'Admin',
          email: 'admin@smartcampus.com',
          password: process.env.ADMIN_PASSWORD,
          role: 'admin',
          department: 'ALL',
          isActive: true
        });
        await user.save();
      }
    } else {
      user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log login
    await Log.create({
      user: user._id,
      type: 'login',
      action: 'User logged in',
      details: `Role: ${user.role}`,
      status: 'success'
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    await Log.create({
      type: 'login',
      action: 'Login failed',
      details: error.message,
      status: 'failed'
    });
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      department: req.user.department,
      isActive: req.user.isActive,
      location: req.user.location
    }
  });
});

// Update location
router.put('/location', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    req.user.location = {
      latitude,
      longitude,
      lastUpdated: new Date()
    };

    await req.user.save();

    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update location', error: error.message });
  }
});

// Get all users (admin only)
router.get('/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { role, department, isActive } = req.query;
    
    let query = {};
    if (role) query.role = role;
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

// Toggle user active status (admin)
router.put('/users/:id/toggle-active', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    await Log.create({
      user: req.user._id,
      type: 'admin_action',
      action: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      details: `User: ${user.email}`,
      status: 'success'
    });

    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`, user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user status', error: error.message });
  }
});

module.exports = router;