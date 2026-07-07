const express = require('express');
const PDFDocument = require('pdfkit');
const Log = require('../models/Log');
const SOS = require('../models/SOS');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Get all logs
router.get('/logs', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { type, fromDate, toDate, page = 1, limit = 50 } = req.query;
    
    let query = {};
    if (type) query.type = type;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const logs = await Log.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Log.countDocuments(query);

    res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch logs', error: error.message });
  }
});

// Get dashboard stats
router.get('/stats', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const userStats = {
      total: await User.countDocuments(),
      students: await User.countDocuments({ role: 'student' }),
      faculty: await User.countDocuments({ role: 'faculty' }),
      active: await User.countDocuments({ isActive: true }),
      inactive: await User.countDocuments({ isActive: false })
    };

    const sosStats = {
      total: await SOS.countDocuments(),
      active: await SOS.countDocuments({ status: 'active' }),
      resolved: await SOS.countDocuments({ status: 'resolved' })
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceStats = {
      today: await Attendance.countDocuments({ date: { $gte: today } })
    };

    const recentLogs = await Log.find()
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      users: userStats,
      sos: sosStats,
      attendance: attendanceStats,
      recentLogs
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
});

// Download SOS Report PDF
router.get('/reports/sos', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { fromDate, toDate, department } = req.query;
    
    let query = {};
    if (department) query.department = department;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const sosAlerts = await SOS.find(query)
      .populate('student', 'name email department')
      .populate('acceptedBy', 'name')
      .sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sos-report.pdf');
    
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('SOS Alert Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total SOS Alerts: ${sosAlerts.length}`);
    doc.text(`Active: ${sosAlerts.filter(s => s.status === 'active').length}`);
    doc.text(`Accepted: ${sosAlerts.filter(s => s.status === 'accepted').length}`);
    doc.text(`Resolved: ${sosAlerts.filter(s => s.status === 'resolved').length}`);
    doc.moveDown();

    // Table header
    doc.fontSize(12).font('Helvetica-Bold').text('SOS Details', { underline: true });
    doc.moveDown(0.5);

    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Date', 50, y);
    doc.text('Student', 130, y);
    doc.text('Department', 230, y);
    doc.text('Status', 320, y);
    doc.text('Resolved By', 390, y);

    doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
    y += 20;

    doc.font('Helvetica');
    sosAlerts.forEach(sos => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(sos.createdAt.toLocaleDateString(), 50, y);
      doc.text(sos.student?.name || 'N/A', 130, y);
      doc.text(sos.department || 'N/A', 230, y);
      doc.text(sos.status, 320, y);
      doc.text(sos.acceptedBy?.name || '-', 390, y);
      y += 15;
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
});

// Download Attendance Report PDF
router.get('/reports/attendance', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { fromDate, toDate, department } = req.query;
    
    let query = {};
    if (department) query.department = department;
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.date = { $gte: today };
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'name email rollNumber')
      .sort({ date: -1 });

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.pdf');
    
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Attendance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    if (department) doc.text(`Department: ${department}`, { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Records: ${attendance.length}`);
    doc.text(`Approved: ${attendance.filter(a => a.status === 'approved').length}`);
    doc.text(`Auto-marked: ${attendance.filter(a => a.isAutoMarked).length}`);
    doc.text(`Rejected: ${attendance.filter(a => a.status === 'rejected').length}`);
    doc.moveDown();

    // Table header
    doc.fontSize(12).font('Helvetica-Bold').text('Attendance Details', { underline: true });
    doc.moveDown(0.5);

    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Date', 50, y);
    doc.text('Student', 120, y);
    doc.text('Roll No', 220, y);
    doc.text('Status', 300, y);
    doc.text('Type', 380, y);
    doc.text('Dept', 440, y);

    doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
    y += 20;

    doc.font('Helvetica');
    attendance.forEach(record => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(record.date.toLocaleDateString(), 50, y);
      doc.text(record.student?.name?.substring(0, 20) || 'N/A', 120, y);
      doc.text(record.student?.rollNumber || '-', 220, y);
      doc.text(record.status, 300, y);
      doc.text(record.isAutoMarked ? 'Auto' : 'Manual', 380, y);
      doc.text(record.department, 440, y);
      y += 15;
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
});

// Download Login/Register Logs PDF
router.get('/reports/logs', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { fromDate, toDate, type } = req.query;
    
    let query = { type: { $in: ['login', 'register'] } };
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const logs = await Log.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(200);

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=logs-report.pdf');
    
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Activity Logs Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Records: ${logs.length}`);
    doc.text(`Logins: ${logs.filter(l => l.type === 'login').length}`);
    doc.text(`Registrations: ${logs.filter(l => l.type === 'register').length}`);
    doc.text(`Successful: ${logs.filter(l => l.status === 'success').length}`);
    doc.text(`Failed: ${logs.filter(l => l.status === 'failed').length}`);
    doc.moveDown();

    // Table header
    doc.fontSize(12).font('Helvetica-Bold').text('Log Details', { underline: true });
    doc.moveDown(0.5);

    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Date/Time', 50, y);
    doc.text('User', 140, y);
    doc.text('Type', 250, y);
    doc.text('Action', 310, y);
    doc.text('Status', 420, y);

    doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
    y += 20;

    doc.font('Helvetica');
    logs.forEach(log => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(log.createdAt.toLocaleString(), 50, y);
      doc.text(log.user?.name?.substring(0, 15) || 'System', 140, y);
      doc.text(log.type, 250, y);
      doc.text(log.action?.substring(0, 15) || '-', 310, y);
      doc.text(log.status, 420, y);
      y += 15;
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
});

// Clear old logs (admin)
router.delete('/logs/clear', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { days } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (days || 30));

    await Log.deleteMany({ createdAt: { $lt: cutoffDate } });

    res.json({ message: 'Old logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear logs', error: error.message });
  }
});

module.exports = router;