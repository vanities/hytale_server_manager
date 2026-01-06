/**
 * Login Page Component
 *
 * Handles user authentication with JWT authentication. Features include
 * remember me functionality and comprehensive error handling.
 *
 * @module pages/auth/LoginPage
 */

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input, Card } from '../../components/ui';
import { LogIn, User, Lock, Gamepad2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { env } from '../../config';

/**
 * LoginPage Component
 *
 * Provides a complete authentication interface with:
 * - Username/email and password login form
 * - Remember me functionality
 * - Error display
 */
export const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Clear errors when form changes
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [identifier, password]);

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const result = await login({ identifier, password, rememberMe });

    if (result.success) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-bg via-primary-bg-secondary to-primary-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card variant="glass">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.div
              className="flex justify-center mb-4"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-16 h-16 bg-accent-primary rounded-lg flex items-center justify-center shadow-lg shadow-accent-primary/30">
                <Gamepad2 size={32} className="text-black" />
              </div>
            </motion.div>
            <h1 className="text-3xl font-heading font-bold text-gradient">HytalePanel</h1>
            <p className="text-text-light-muted dark:text-text-muted mt-2">Server Management Dashboard</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Username or Email"
              placeholder="Enter your username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              icon={<User size={18} />}
              required
              autoComplete="username"
              disabled={isLoading}
            />

            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={18} />}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-primary-bg text-accent-primary focus:ring-accent-primary focus:ring-2"
                />
                <label
                  htmlFor="remember"
                  className="ml-2 text-sm text-text-light-muted dark:text-text-muted cursor-pointer"
                >
                  Remember me
                </label>
              </div>

              <button
                type="button"
                className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
                onClick={() => {/* TODO: Implement forgot password */}}
              >
                Forgot password?
              </button>
            </div>

            {/* Error Display */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="p-3 bg-danger/20 border border-danger/30 rounded-lg flex items-start gap-2"
                >
                  <AlertCircle size={18} className="text-danger flex-shrink-0 mt-0.5" />
                  <span className="text-danger text-sm">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={isLoading}
              icon={<LogIn size={20} />}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-text-light-muted dark:text-text-muted">
          <p>{env.app.name} &copy; {new Date().getFullYear()}</p>
          <p className="mt-1">Version {env.app.version}</p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
