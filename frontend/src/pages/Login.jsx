import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    userId: ''
  });
  const [loading, setLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const credentials = showAdminLogin 
      ? { userId: formData.userId, password: formData.password }
      : { email: formData.email, password: formData.password };

    const result = await login(credentials);
    
    if (result.success) {
      navigate('/');
    } else {
      alert(result.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3 opacity-30"></div>
        
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptLTggNHYyaC0ydjJoMnptLTgtNHYyaC0ydjJoMnptOCA0djJoLTJ2LTJoMnptLTggNHYyaC0ydjJoMnptOCA0djJoLTJ2LTJoMnptLTggNHYyaC0ydjJoMnptOCA0djJoLTJ2LTJoMnptLTggNHYyaC0ydjJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')]"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-4 flex flex-col md:flex-row gap-10">
        {/* Left Side - Welcome */}
        <motion.div 
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex-1 flex flex-col justify-center text-white"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-sm text-gray-300">System Online</span>
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight"
          >
            Smart Campus
            <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">
              Emergency System
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-xl text-gray-300 mb-10 max-w-lg"
          >
            Your safety is our priority. Quick response, real-time alerts, and seamless campus experience.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { icon: '🚨', label: 'SOS Alerts', color: 'from-red-500 to-pink-500' },
              { icon: '📍', label: 'Location Tracking', color: 'from-green-500 to-emerald-500' },
              { icon: '✅', label: 'Auto Attendance', color: 'from-blue-500 to-cyan-500' },
              { icon: '📅', label: 'Smart Timetable', color: 'from-purple-500 to-pink-500' }
            ].map((item, index) => (
              <motion.div 
                key={index}
                whileHover={{ scale: 1.05, y: -5 }}
                className={`glass-heavy p-5 rounded-2xl cursor-pointer bg-gradient-to-br ${item.color} bg-opacity-10`}
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-sm font-semibold text-white">{item.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right Side - Login Form */}
        <motion.div 
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="flex-1 max-w-md md:max-w-none"
        >
          <div className="glass-heavy p-8 md:p-10 rounded-3xl">
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/30"
              >
                <span className="text-3xl">🔐</span>
              </motion.div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Welcome Back
              </h2>
              <p className="text-gray-400">Sign in to access your dashboard</p>
            </div>

            {/* Toggle Login Type */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex mb-8 glass rounded-xl p-1"
            >
              <motion.button
                type="button"
                onClick={() => setShowAdminLogin(false)}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  !showAdminLogin 
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                User Login
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setShowAdminLogin(true)}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  showAdminLogin 
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Admin Login
              </motion.button>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {showAdminLogin ? (
                  <motion.div
                    key="admin"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <label className="form-label">Admin ID</label>
                    <input
                      type="text"
                      name="userId"
                      value={formData.userId}
                      onChange={handleChange}
                      className="w-full px-5 py-4 glass-input text-lg"
                      placeholder="Enter admin ID"
                      required
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="user"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-5 py-4 glass-input text-lg"
                      placeholder="Enter your email"
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-5 py-4 glass-input text-lg"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02, boxShadow: "0 15px 40px rgba(236, 72, 153, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-bold text-lg shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="spinner border-2 border-white/30 border-t-white w-5 h-5"></span>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </motion.button>
            </form>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 text-center"
            >
              <p className="text-gray-400">
                Don't have an account?{' '}
                <Link 
                  to="/register" 
                  className="text-pink-400 hover:text-pink-300 font-semibold transition-colors hover:underline"
                >
                  Register here
                </Link>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;