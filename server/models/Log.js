const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['login', 'register', 'sos', 'attendance', 'timetable', 'admin_action'],
    required: true
  },
  action: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  }
}, { timestamps: true });

logSchema.index({ createdAt: -1 });
logSchema.index({ type: 1 });

module.exports = mongoose.model('Log', logSchema);