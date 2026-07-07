import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
import ThemeToggle from '../components/ThemeToggle';

const API_URL = '/api';

const StudentDashboard = () => {
  const { user, logout, socket, updateLocation } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('home');
  const [sosLoading, setSosLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [timetable, setTimetable] = useState([]);
  const [attendance, setAttendance] = useState({ records: [], stats: {} });
  const [currentClass, setCurrentClass] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [sosHistory, setSosHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [timetableLoading, setTimetableLoading] = useState(false);
  
  const locationIntervalRef = useRef(null);

  // Get user location
  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Update location periodically
  useEffect(() => {
    const updateUserLocation = async () => {
      try {
        const loc = await getLocation();
        setLocation(loc);
        setLocationError(null);
        updateLocation(loc.latitude, loc.longitude);
      } catch (error) {
        const isDenied = error?.code === 1;
        setLocationError(isDenied ? 'denied' : error?.message || 'Unable to access location');
        console.error('Location error:', error);
      }
    };

    updateUserLocation();
    locationIntervalRef.current = setInterval(updateUserLocation, 5000);

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  // Fetch timetable
  const fetchTimetable = useCallback(async () => {
    if (!user?.department) return;

    setTimetableLoading(true);
    try {
      const response = await axios.get(`${API_URL}/timetable/${user.department}`);
      setTimetable(response.data);
    } catch (error) {
      console.error('Failed to fetch timetable:', error);
    } finally {
      setTimetableLoading(false);
    }
  }, [user?.department]);

  useEffect(() => {
    if (!user?.department) return;

    fetchTimetable();
    const interval = setInterval(fetchTimetable, 30000);
    return () => clearInterval(interval);
  }, [user?.department, fetchTimetable]);

  // Fetch attendance
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await axios.get(`${API_URL}/attendance/my`);
        setAttendance(response.data);
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
      }
    };

    fetchAttendance();
  }, []);

  useEffect(() => {
    const hasPending = attendance.records?.some(record => record.approvalStatus === 'PENDING');
    setPendingApproval(hasPending);
    setApprovalMessage(hasPending ? 'Waiting for faculty approval...' : '');
  }, [attendance.records]);

  // Fetch current class
  useEffect(() => {
    const fetchCurrentClass = async () => {
      try {
        const response = await axios.get(`${API_URL}/timetable/current/class`);
        setCurrentClass(response.data.currentClass);
      } catch (error) {
        console.error('Failed to fetch current class:', error);
      }
    };

    fetchCurrentClass();
    const interval = setInterval(fetchCurrentClass, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch SOS history
  useEffect(() => {
    const fetchSosHistory = async () => {
      try {
        const response = await axios.get(`${API_URL}/sos/my-history`);
        setSosHistory(response.data);
      } catch (error) {
        console.error('Failed to fetch SOS history:', error);
      }
    };

    fetchSosHistory();
  }, []);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    const handleTimetableUpdate = (data) => {
      setNotifications(prev => [{
        id: Date.now(),
        type: 'timetable',
        message: `Timetable updated for ${data?.department || user?.department}`,
        time: new Date()
      }, ...prev]);
      fetchTimetable();
    };

    socket.on('timetable-updated', handleTimetableUpdate);

    return () => {
      socket.off('timetable-updated', handleTimetableUpdate);
    };
  }, [socket, fetchTimetable, user?.department]);

  // Trigger SOS
  const triggerSOS = async () => {
    if (!location) {
      alert('Unable to get your location. Please enable location services.');
      return;
    }

    setSosLoading(true);
    try {
      await axios.post(`${API_URL}/sos/create`, {
        latitude: location.latitude,
        longitude: location.longitude,
        description: 'Emergency alert from student'
      });
      alert('SOS Alert sent successfully! Help is on the way.');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send SOS');
    }
    setSosLoading(false);
  };

  // Mark attendance
  const markAttendance = async () => {
    if (!location) {
      alert('Unable to get your location. Please enable location services.');
      return;
    }

    setAttendanceLoading(true);
    try {
      const response = await axios.post(`${API_URL}/attendance/auto-mark`, {
        latitude: location.latitude,
        longitude: location.longitude
      });
      alert(response.data.message);
      
      // Refresh attendance
      const attResponse = await axios.get(`${API_URL}/attendance/my`);
      setAttendance(attResponse.data);
      setPendingApproval(true);
      setApprovalMessage('Waiting for faculty approval...');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to mark attendance');
    }
    setAttendanceLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayTimetable = timetable.filter(t => t.day === currentDay);

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-500 dark:bg-slate-950 dark:text-white">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-800 to-purple-950">
        <div className="orb orb-1 opacity-40"></div>
        <div className="orb orb-2 opacity-30"></div>
      </div>

      {/* Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="glass-heavy sticky top-0 z-40 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/30"
            >
              <span className="text-2xl">🎓</span>
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-white">Smart Campus</h1>
              <p className="text-sm text-gray-400">Welcome, <span className="text-pink-400">{user?.name}</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="glass px-5 py-2.5 rounded-xl"
            >
              <span className="text-sm text-gray-300">Dept: </span>
              <span className="text-white font-semibold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">{user?.department}</span>
            </motion.div>
            <ThemeToggle />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 font-medium border border-red-500/30 hover:border-red-500/50 transition-all"
            >
              Logout
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 relative z-10">
        {/* Navigation Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3 mb-8 overflow-x-auto pb-2"
        >
          {[
            { id: 'home', icon: '🏠', label: 'Home' },
            { id: 'sos', icon: '🚨', label: 'SOS' },
            { id: 'attendance', icon: '✅', label: 'Attendance' },
            { id: 'timetable', icon: '📅', label: 'Timetable' }
          ].map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''} flex items-center gap-2 whitespace-nowrap`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {/* Current Class Card */}
              <div className="glass-card p-6 col-span-full">
                <h3 className="text-lg font-semibold text-white mb-4">Current Class</h3>
                {currentClass ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">{currentClass.subject}</p>
                      <p className="text-gray-400">Prof. {currentClass.faculty?.name}</p>
                      <p className="text-gray-400">{currentClass.room || 'Room not assigned'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-purple-400">{currentClass.day}</p>
                      <p className="text-gray-400">{currentClass.timeSlot}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">No class scheduled at this time</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={markAttendance}
                    disabled={attendanceLoading}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium disabled:opacity-50"
                  >
                    {attendanceLoading ? 'Processing...' : 'Mark Attendance'}
                  </button>
                  <button
                    onClick={() => setActiveTab('sos')}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium"
                  >
                    Trigger SOS
                  </button>
                </div>
              </div>

              {pendingApproval && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="glass-card p-6 col-span-full"
                >
                  <h3 className="text-lg font-semibold text-white mb-2">Attendance Approval</h3>
                  <p className="text-gray-300 text-sm">{approvalMessage}</p>
                </motion.div>
              )}

              {/* Location */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Your Location</h3>
                {location ? (
                  <div>
                    <p className="text-gray-400 text-sm">Latitude</p>
                    <p className="text-white font-mono">{location.latitude.toFixed(6)}</p>
                    <p className="text-gray-400 text-sm mt-2">Longitude</p>
                    <p className="text-white font-mono">{location.longitude.toFixed(6)}</p>
                  </div>
                ) : locationError ? (
                  <p className="text-red-300">
                    {locationError === 'denied' ? 'Location access denied' : locationError}
                  </p>
                ) : (
                  <p className="text-gray-400">Fetching location...</p>
                )}
              </div>

              <motion.div
                key="live-map"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="col-span-full"
              >
                <LiveMap
                  title="Live Campus Tracker"
                  description="Map refreshes every 5 seconds"
                  primaryLocation={location}
                  primaryLabel="You"
                  locationError={locationError}
                  fallbackMessage="Waiting for your location..."
                />
              </motion.div>

              {/* Attendance Stats */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Attendance</h3>
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                      <circle 
                        cx="64" cy="64" r="56" 
                        stroke="url(#gradient)" 
                        strokeWidth="8" 
                        fill="none"
                        strokeDasharray={`${(attendance.stats?.percentage || 0) * 3.52} 352`}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">{attendance.stats?.percentage || 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-center mt-4 text-gray-400">
                  {attendance.stats?.present || 0} / {attendance.stats?.total || 0} days
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sos' && (
            <motion.div
              key="sos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* SOS Button */}
              <div className="glass-card p-8 text-center">
                <h2 className="text-2xl font-bold text-white mb-4">Emergency SOS</h2>
                <p className="text-gray-400 mb-8">Press the button below in case of emergency</p>
                
                <motion.button
                  onClick={triggerSOS}
                  disabled={sosLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="sos-button w-64 h-64 rounded-full text-white text-2xl font-bold flex flex-col items-center justify-center shadow-2xl disabled:opacity-50"
                >
                  {sosLoading ? (
                    <div className="spinner border-4 border-white/30 border-t-white"></div>
                  ) : (
                    <>
                      <span className="text-6xl mb-2">🚨</span>
                      SOS
                    </>
                  )}
                </motion.button>
                
                <p className="text-gray-400 mt-6 text-sm">
                  Your location will be sent to faculty immediately
                </p>
              </div>

              {/* SOS History */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">SOS History</h3>
                {sosHistory.length > 0 ? (
                  <div className="space-y-3">
                    {sosHistory.slice(0, 5).map(sos => (
                      <div key={sos._id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                        <div>
                          <p className="text-white">{new Date(sos.createdAt).toLocaleString()}</p>
                          <p className="text-gray-400 text-sm">{sos.department}</p>
                        </div>
                        <span className={`status-${sos.status === 'resolved' ? 'resolved' : sos.status === 'accepted' ? 'active' : 'pending'}`}>
                          {sos.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No SOS history</p>
                )}
              </div>
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
              {/* Mark Attendance Card */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Mark Today's Attendance</h3>
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1">
                    {location ? (
                      <p className="text-gray-400">
                        Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </p>
                    ) : (
                      <p className="text-gray-400">Getting your location...</p>
                    )}
                  </div>
                  <button
                    onClick={markAttendance}
                    disabled={attendanceLoading || !location}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold disabled:opacity-50"
                  >
                    {attendanceLoading ? 'Processing...' : 'Mark Attendance'}
                  </button>
                </div>
              </div>

              {/* Attendance Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Days', value: attendance.stats?.total || 0, color: 'from-blue-500 to-cyan-500' },
                  { label: 'Present', value: attendance.stats?.present || 0, color: 'from-green-500 to-emerald-500' },
                  { label: 'Auto Marked', value: attendance.stats?.autoMarked || 0, color: 'from-purple-500 to-pink-500' },
                  { label: 'Percentage', value: `${attendance.stats?.percentage || 0}%`, color: 'from-orange-500 to-red-500' },
                ].map((stat, index) => (
                  <div key={index} className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-gray-400 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Attendance Records */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Attendance History</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {attendance.records?.slice(0, 20).map(record => (
                    <div key={record._id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="text-white">{new Date(record.date).toLocaleDateString()}</p>
                        <p className="text-gray-400 text-sm">{record.timeSlot}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.isAutoMarked && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Auto</span>
                        )}
                        <span className={`status-${record.status === 'approved' || record.status === 'auto-marked' ? 'active' : record.status === 'rejected' ? 'pending' : 'active'}`}>
                          {record.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'timetable' && (
            <motion.div
              key="timetable"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Timetable - {user?.department}
                </h3>
                
                {/* Day Selector */}
                <div className="flex gap-2 mb-6 overflow-x-auto">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <button
                      key={day}
                      className="px-4 py-2 rounded-lg glass text-sm whitespace-nowrap"
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Timetable Grid */}
                {todayTimetable.length > 0 ? (
                  <div className="space-y-3">
                    {todayTimetable.map((slot, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
                        <div className="w-20 text-gray-400 text-sm">{slot.timeSlot}</div>
                        <div className="flex-1">
                          <p className="text-white font-medium">{slot.subject}</p>
                          <p className="text-gray-400 text-sm">Prof. {slot.faculty?.name}</p>
                        </div>
                        <div className="text-gray-400 text-sm">{slot.room || '-'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No classes scheduled for today</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default StudentDashboard;
