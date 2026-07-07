import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ users: {}, sos: {}, attendance: {}, recentLogs: [] });
  const [users, setUsers] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/admin/stats`);
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/users`);
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  // Fetch SOS alerts
  useEffect(() => {
    const fetchSOSAlerts = async () => {
      try {
        const response = await axios.get(`${API_URL}/sos/all`);
        setSosAlerts(response.data);
      } catch (error) {
        console.error('Failed to fetch SOS alerts:', error);
      }
    };

    if (activeTab === 'sos') {
      fetchSOSAlerts();
    }
  }, [activeTab]);

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get(`${API_URL}/admin/logs`);
        setLogs(response.data.logs);
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };

    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  // Toggle user active status
  const toggleUserStatus = async (userId) => {
    try {
      await axios.put(`${API_URL}/auth/users/${userId}/toggle-active`);
      setUsers(prev => prev.map(u => 
        u._id === userId ? { ...u, isActive: !u.isActive } : u
      ));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update user status');
    }
  };

  // Download PDF reports
  const downloadPDF = async (type) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/reports/${type}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Failed to download report');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="glass sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">⚙️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm text-gray-400">Welcome, {user?.name}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'users', label: '👥 Users' },
            { id: 'sos', label: '🚨 SOS Logs' },
            { id: 'logs', label: '📜 Activity Logs' },
            { id: 'reports', label: '📄 Reports' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                  : 'glass text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">👥</span>
                    <span className="text-green-400 text-sm">Total Users</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.users?.total || 0}</p>
                  <div className="mt-2 text-sm text-gray-400">
                    Students: {stats.users?.students || 0} | Faculty: {stats.users?.faculty || 0}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">🚨</span>
                    <span className="text-red-400 text-sm">SOS Alerts</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.sos?.total || 0}</p>
                  <div className="mt-2 text-sm text-gray-400">
                    Active: {stats.sos?.active || 0} | Resolved: {stats.sos?.resolved || 0}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">✅</span>
                    <span className="text-blue-400 text-sm">Attendance</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.attendance?.today || 0}</p>
                  <div className="mt-2 text-sm text-gray-400">Today's Records</div>
                </div>

                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">✅</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{stats.users?.active || 0}</p>
                  <div className="mt-2 text-sm text-gray-400">
                    Inactive: {stats.users?.inactive || 0}
                  </div>
                </div>
              </div>

              {/* Recent Logs */}
              <div className="glass-card p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {stats.recentLogs?.map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {log.type === 'login' ? '🔐' : log.type === 'register' ? '📝' : log.type === 'sos' ? '🚨' : '📋'}
                        </span>
                        <div>
                          <p className="text-white">{log.action}</p>
                          <p className="text-gray-400 text-sm">{log.user?.name || 'System'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">{new Date(log.createdAt).toLocaleString()}</p>
                        <span className={`text-xs ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!stats.recentLogs || stats.recentLogs.length === 0) && (
                    <p className="text-gray-400 text-center py-4">No recent activity</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-white">User Management</h2>

              <div className="glass-card p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-white/10">
                        <th className="pb-4">Name</th>
                        <th className="pb-4">Email</th>
                        <th className="pb-4">Role</th>
                        <th className="pb-4">Department</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u._id} className="border-b border-white/5">
                          <td className="py-4 text-white">{u.name}</td>
                          <td className="py-4 text-gray-400">{u.email}</td>
                          <td className="py-4">
                            <span className="px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-400">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-4 text-gray-400">{u.department || 'N/A'}</td>
                          <td className="py-4">
                            <span className={`px-3 py-1 rounded-full text-sm ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-4">
                            <button
                              onClick={() => toggleUserStatus(u._id)}
                              className="px-4 py-2 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20"
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No users found</p>
                  )}
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
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-white">SOS Alert Logs</h2>

              <div className="glass-card p-6">
                <div className="space-y-4">
                  {sosAlerts.map(sos => (
                    <div key={sos._id} className="p-4 bg-white/5 rounded-lg">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`status-${sos.status === 'active' ? 'pending' : sos.status === 'resolved' ? 'resolved' : 'active'}`}>
                              {sos.status}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {new Date(sos.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-white font-medium">{sos.student?.name || 'Unknown'}</p>
                          <p className="text-gray-400 text-sm">{sos.department}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-sm">Accepted by: {sos.acceptedBy?.name || '-'}</p>
                          {sos.resolvedAt && (
                            <p className="text-green-400 text-sm">Resolved: {new Date(sos.resolvedAt).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sosAlerts.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No SOS alerts found</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-white">Activity Logs</h2>

              <div className="glass-card p-6">
                <div className="space-y-3">
                  {logs.map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {log.type === 'login' ? '🔐' : 
                           log.type === 'register' ? '📝' : 
                           log.type === 'sos' ? '🚨' : 
                           log.type === 'attendance' ? '✅' : '📋'}
                        </span>
                        <div>
                          <p className="text-white">{log.action}</p>
                          <p className="text-gray-400 text-sm">{log.user?.name || 'System'} - {log.user?.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">{new Date(log.createdAt).toLocaleString()}</p>
                        <span className={`text-xs ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No logs found</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-white">Download Reports</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 text-center">
                  <div className="text-4xl mb-4">🚨</div>
                  <h3 className="text-xl font-semibold text-white mb-2">SOS Report</h3>
                  <p className="text-gray-400 text-sm mb-4">Download all SOS alert history</p>
                  <button
                    onClick={() => downloadPDF('sos')}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium disabled:opacity-50"
                  >
                    {loading ? 'Downloading...' : 'Download PDF'}
                  </button>
                </div>

                <div className="glass-card p-6 text-center">
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Attendance Report</h3>
                  <p className="text-gray-400 text-sm mb-4">Download attendance records</p>
                  <button
                    onClick={() => downloadPDF('attendance')}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium disabled:opacity-50"
                  >
                    {loading ? 'Downloading...' : 'Download PDF'}
                  </button>
                </div>

                <div className="glass-card p-6 text-center">
                  <div className="text-4xl mb-4">📜</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Activity Logs</h3>
                  <p className="text-gray-400 text-sm mb-4">Download login and registration logs</p>
                  <button
                    onClick={() => downloadPDF('logs')}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium disabled:opacity-50"
                  >
                    {loading ? 'Downloading...' : 'Download PDF'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdminDashboard;