const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  approvalStatus: {
    type: String,
    enum: ['PENDING', 'PRESENT', 'ABSENT'],
    default: 'PENDING'
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'auto-marked', 'approved', 'rejected'],
    default: 'present'
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  isAutoMarked: {
    type: Boolean,
    default: false
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  timeSlot: {
    type: String,
    default: null
  }
}, { timestamps: true });

attendanceSchema.index({ student: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
