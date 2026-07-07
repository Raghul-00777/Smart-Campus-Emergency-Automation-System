import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
    className="flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-white dark:border-white/40 dark:bg-white/10 dark:text-white"
    >
      <span>{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light' : 'Dark'} Mode</span>
    </motion.button>
  );
};

export default ThemeToggle;
