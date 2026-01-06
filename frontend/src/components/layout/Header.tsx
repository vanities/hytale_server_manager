import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, User, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { useThemeStore } from '../../stores/themeStore';
import { Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export const Header = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const notifications = useAppStore((state) => state.notifications);
  const markAllAsRead = useAppStore((state) => state.markAllNotificationsAsRead);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="hidden lg:flex h-16 bg-white dark:bg-gray-100 dark:bg-primary-bg-secondary border-b border-gray-300 dark:border-gray-800 px-4 lg:px-6 items-center justify-between sticky top-0 z-10">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light-muted dark:text-text-muted" />
          <input
            type="search"
            placeholder="Search servers, mods, players..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-primary-bg border border-gray-300 dark:border-gray-700 rounded-lg text-text-light-primary dark:text-text-primary placeholder-text-muted text-base focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary min-h-[44px]"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 text-text-light-muted dark:text-text-muted hover:text-text-light-primary dark:text-text-primary hover:bg-gray-200 dark:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger rounded-full text-xs text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-80 sm:w-96 glass-card shadow-xl max-h-96 overflow-auto custom-scrollbar"
              >
                <div className="p-4 border-b border-gray-300 dark:border-gray-800 flex items-center justify-between">
                  <h3 className="font-heading font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-accent-primary hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-800">
                  {notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-200 dark:bg-gray-800/50 cursor-pointer ${
                        !notification.read ? 'bg-accent-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Badge
                          variant={
                            notification.type === 'error'
                              ? 'danger'
                              : notification.type === 'warning'
                              ? 'warning'
                              : notification.type === 'success'
                              ? 'success'
                              : 'info'
                          }
                          size="sm"
                        >
                          {notification.type}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-light-primary dark:text-text-primary">
                            {notification.title}
                          </p>
                          <p className="text-xs text-text-light-muted dark:text-text-muted mt-1">{notification.message}</p>
                          <p className="text-xs text-text-light-muted dark:text-text-muted mt-1">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="p-8 text-center text-text-light-muted dark:text-text-muted">
                      <p>No notifications</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 text-text-light-muted dark:text-text-muted hover:text-text-light-primary dark:hover:text-text-primary hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={theme}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </motion.div>
          </AnimatePresence>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-2 text-text-light-primary dark:text-text-primary hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-accent-primary rounded-full flex items-center justify-center">
              <User size={18} className="text-black" />
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs text-text-light-muted dark:text-text-muted capitalize">{user?.role}</p>
            </div>
            <ChevronDown size={16} className="text-text-light-muted dark:text-text-muted" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-48 glass-card shadow-xl"
              >
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
