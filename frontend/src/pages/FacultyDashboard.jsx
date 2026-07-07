import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ThemeToggle from '../components/ThemeToggle';
import LiveMap from '../components/LiveMap';

const API_URL = '/api';

const FacultyDashboard = () => {
  const { user, logout, socket } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('sos');
  const [sosAlerts, setSosAlerts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [processingAttendance, setProcessingAttendance] = useState({});
  const [newTimetableEntry, setNewTimetableEntry] = useState({
    department: '',
    day: '',
    timeSlot: '',
    subject: '',
    room: ''
  });

  const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AI & DS', 'MBA'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const TIME_SLOTS = ['9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4', '4-5'];
  const { success, error } = useToast();

  // Fetch SOS alerts
  useEffect(() => {
    const fetchSOSAlerts = async () => {
      try {
        const response = await axios.get(`${API_URL}/sos/active`);
        setSosAlerts(response.data);
      } catch (error) {
        console.error('Failed to fetch SOS alerts:', error);
      }
    };

    fetchSOSAlerts();
    const interval = setInterval(fetchSOSAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch attendance for department
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await axios.get(`${API_URL}/attendance/department/${user?.department}`);
        setAttendance(response.data);
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
      }
    };

    if (user?.department) {
      fetchAttendance();
    }
  }, [user?.department]);

  const fetchPendingAttendance = useCallback(async () => {
    if (!user?.department) {
      setPendingAttendance([]);
      setPendingLoading(false);
      return;
    }

    setPendingLoading(true);
    try {
      const response = await axios.get(`${API_URL}/attendance/pending`);
      setPendingAttendance(response.data);
    } catch (fetchError) {
      error(fetchError.response?.data?.message || 'Failed to load pending requests');
    } finally {
      setPendingLoading(false);
    }
  }, [user?.department, error]);

  useEffect(() => {
    if (user?.department && activeTab === 'attendance') {
      fetchPendingAttendance();
    }
  }, [user?.department, activeTab, fetchPendingAttendance]);

  useEffect(() => {
    if (!socket) return;

    const handleAttendanceRequest = () => {
      fetchPendingAttendance();
    };

    socket.on('attendanceRequest', handleAttendanceRequest);

    return () => {
      socket.off('attendanceRequest', handleAttendanceRequest);
    };
  }, [socket, fetchPendingAttendance]);

  const handleAttendanceAction = useCallback(async (id, status) => {
    setProcessingAttendance(prev => ({ ...prev, [id]: true }));
    try {
      await axios.patch(`${API_URL}/attendance/${id}`, { status });
      success('Attendance updated');
      await fetchPendingAttendance();
    } catch (actionError) {
      error(actionError.response?.data?.message || 'Failed to update attendance');
    } finally {
      setProcessingAttendance(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [fetchPendingAttendance, success, error]);

  // Fetch timetable
  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        const response = await axios.get(`${API_URL}/timetable`);
        setTimetable(response.data);
      } catch (error) {
        console.error('Failed to fetch timetable:', error);
      }
    };

    fetchTimetable();
  }, []);

  // Listen for real-time SOS
  useEffect(() => {
    if (socket) {
      socket.on('new-sos', (data) => {
        setSosAlerts(prev => [data.sos, ...prev]);
        // Play notification sound
        new Audio('/notification.mp3').play().catch(() => {});
      });

      socket.on('sos-resolved', () => {
        setSosAlerts(prev => prev.filter(s => s.status !== 'resolved'));
      });
    }

    return () => {
      if (socket) {
        socket.off('new-sos');
        socket.off('sos-resolved');
      }
    };
  }, [socket]);

  // Accept SOS
  const acceptSOS = async (sosId) => {
    try {
      await axios.put(`${API_URL}/sos/${sosId}/accept`);
      setSosAlerts(prev => prev.map(s => 
        s._id === sosId ? { ...s, status: 'accepted', acceptedBy: { _id: user._id, name: user.name } } : s
      ));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to accept SOS');
    }
  };

  // Resolve SOS
  const resolveSOS = async (sosId) => {
    try {
      await axios.put(`${API_URL}/sos/${sosId}/resolve`);
      setSosAlerts(prev => prev.filter(s => s._id !== sosId));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to resolve SOS');
    }
  };

  // Approve attendance
  const approveAttendance = async (attendanceId) => {
    try {
      await axios.put(`${API_URL}/attendance/${attendanceId}/approve`);
      setAttendance(prev => prev.map(a => 
        a._id === attendanceId ? { ...a, status: 'approved' } : a
      ));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve attendance');
    }
  };

  // Reject attendance
  const rejectAttendance = async (attendanceId) => {
    try {
      await axios.put(`${API_URL}/attendance/${attendanceId}/reject`);
      setAttendance(prev => prev.map(a => 
        a._id === attendanceId ? { ...a, status: 'rejected' } : a
      ));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to reject attendance');
    }
  };

  // Create timetable entry
  const createTimetable = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/timetable`, newTimetableEntry);
      alert('Timetable entry created successfully!');
      setNewTimetableEntry({ department: '', day: '', timeSlot: '', subject: '', room: '' });
      // Refresh timetable
      const response = await axios.get(`${API_URL}/timetable`);
      setTimetable(response.data);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create timetable');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeSOS = sosAlerts.filter(s => s.status === 'active').length;
  const latestSOS = sosAlerts.find(s => s.status === 'active') ?? sosAlerts[0];
  const sosLocation = latestSOS?.location;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-purple-100 to-pink-100 text-slate-900 transition-colors duration-500 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 dark:text-white">
      {/* Header */}
      <header className="glass sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">👨‍🏫</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Faculty Dashboard</h1>
              <p className="text-sm text-gray-400">Welcome, {user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* SOS Alert Badge */}
            {activeSOS > 0 && (
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="px-4 py-2 bg-red-500 rounded-full flex items-center gap-2"
              >
                <span className="text-lg">🚨</span>
                <span className="text-white font-bold">{activeSOS} Active SOS</span>
              </motion.div>
            )}
            
            <div className="glass px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-300">Dept: </span>
              <span className="text-white font-medium">{user?.department}</span>
            </div>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {[
            { id: 'sos', label: '🚨 SOS Alerts', badge: activeSOS },
            { id: 'attendance', label: '✅ Attendance' },
            { id: 'timetable', label: '📅 Timetable' },
            { id: 'location', label: '📍 Student Location' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-xl font-medium transition-all relative ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                  : 'glass text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-xs flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'sos' && (
            <motion.div
              key="sos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-white">Emergency SOS Alerts</h2>
              
              {sosAlerts.length > 0 ? (
                <div className="space-y-4">
                  {sosAlerts.map(sos => (
                    <div key={sos._id} className="glass-card p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`status-${sos.status === 'active' ? 'pending' : sos.status === 'accepted' ? 'active' : 'resolved'}`}>
                              {sos.status}
                            </span>
                            <span className="text-gray-400">
                              {new Date(sos.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-white font-semibold">{sos.student?.name}</p>
                          <p className="text-gray-400">{sos.student?.email}</p>
                          <p className="text-gray-400">Department: {sos.department}</p>
                          <p className="text-gray-400 text-sm mt-1">
                            Location: {sos.location?.latitude?.toFixed(4)}, {sos.location?.longitude?.toFixed(4)}
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          {sos.status === 'active' && (
                            <button
                              onClick={() => acceptSOS(sos._id)}
                              className="px-6 py-2 rounded-lg bg-yellow-500 text-white font-medium hover:bg-yellow-600"
                            >
                              Accept
                            </button>
                          )}
                          {(sos.status === 'active' || sos.status === 'accepted') && (
                            <button
                              onClick={() => resolveSOS(sos._id)}
                              className="px-6 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center">
                  <p className="text-4xl mb-4">✅</p>
                  <p className="text-gray-400 text-lg">No active SOS alerts</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'attendance' && (
            <motion.div
              key="attendance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Today's Attendance - {user?.department}
                </h2>
                <p className="text-gray-400">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Pending Attendance Requests</h3>
                {pendingLoading ? (
                  <p className="text-center text-gray-400">Loading pending requests...</p>
                ) : pendingAttendance.length > 0 ? (
                  <div className="space-y-3">
                    {pendingAttendance.map(record => (
                      <div
                        key={record._id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white/5 rounded-lg"
                      >
                        <div>
                          <p className="text-white font-semibold">{record.student?.name || 'Unknown student'}</p>
                          <p className="text-gray-400 text-sm">Department: {record.student?.department || 'N/A'}</p>
                          <p className="text-gray-400 text-sm">
                            {record.timeSlot
                              ? `Time: ${record.timeSlot}`
                              : new Date(record.markedAt || record.date).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAttendanceAction(record._id, 'PRESENT')}
                            disabled={processingAttendance[record._id]}
                            className="px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold disabled:opacity-50"
                          >
                            {processingAttendance[record._id] ? 'Updating...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleAttendanceAction(record._id, 'ABSENT')}
                            disabled={processingAttendance[record._id]}
                            className="px-4 py-2 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold disabled:opacity-50"
                          >
                            {processingAttendance[record._id] ? 'Updating...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400">No pending requests</p>
                )}
              </div>

              {attendance.length > 0 ? (
                <div className="grid gap-4">
                  {attendance.map(record => (
                    <div key={record._id} className="glass-card p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{record.student?.name}</p>
                        <p className="text-gray-400 text-sm">{record.student?.email}</p>
                        <p className="text-gray-400 text-sm">Roll: {record.student?.rollNumber || 'N/A'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {record.isAutoMarked && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Auto</span>
                        )}
                        <span className={`status-${record.status === 'approved' ? 'active' : record.status === 'rejected' ? 'pending' : 'pending'}`}>
                          {record.status}
                        </span>
                        {record.status === 'auto-marked' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveAttendance(record._id)}
                              className="px-4 py-1 rounded-lg bg-green-500 text-white text-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectAttendance(record._id)}
                              className="px-4 py-1 rounded-lg bg-red-500 text-white text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center">
                  <p className="text-gray-400 text-lg">No attendance records for today</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'timetable' && (
            <motion.div
              key="timetable"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Add Timetable Entry */}
              <div className="glass-card p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Add Timetable Entry</h3>
                <form onSubmit={createTimetable} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Department</label>
                    <select
                      value={newTimetableEntry.department}
                      onChange={(e) => setNewTimetableEntry({ ...newTimetableEntry, department: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl glass-input"
                      required
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept} className="bg-slate-800">{dept}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Day</label>
                      <select
                        value={newTimetableEntry.day}
                        onChange={(e) => setNewTimetableEntry({ ...newTimetableEntry, day: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        required
                      >
                        <option value="">Select</option>
                        {DAYS.map(day => (
                          <option key={day} value={day} className="bg-slate-800">{day}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Time Slot</label>
                      <select
                        value={newTimetableEntry.timeSlot}
                        onChange={(e) => setNewTimetableEntry({ ...newTimetableEntry, timeSlot: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl glass-input"
                        required
                      >
                        <option value="">Select</option>
                        {TIME_SLOTS.map(slot => (
                          <option key={slot} value={slot} className="bg-slate-800">{slot}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Subject</label>
                    <input
                      type="text"
                      value={newTimetableEntry.subject}
                      onChange={(e) => setNewTimetableEntry({ ...newTimetableEntry, subject: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl glass-input"
                      placeholder="Enter subject name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Room (Optional)</label>
                    <input
                      type="text"
                      value={newTimetableEntry.room}
                      onChange={(e) => setNewTimetableEntry({ ...newTimetableEntry, room: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl glass-input"
                      placeholder="Enter room number"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Add Timetable Entry'}
                  </button>
                </form>
              </div>

              {/* View Timetable */}
              <div className="glass-card p-6">
                <h3 className="text-xl font-semibold text-white mb-4">All Timetable Entries</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {timetable.map((entry, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <p className="text-white font-medium">{entry.subject}</p>
                          <p className="text-gray-400 text-sm">{entry.department} - {entry.day}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-purple-400">{entry.timeSlot}</p>
                          <p className="text-gray-400 text-sm">{entry.room || 'No room'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {timetable.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No timetable entries</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'location' && (
            <motion.div
              key="location"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <LiveMap
                title="Live SOS Location"
                description="The latest SOS alert from your students will appear here."
                primaryLocation={sosLocation}
                primaryLabel="SOS"
                fallbackMessage="Waiting for SOS alerts..."
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default FacultyDashboard;
