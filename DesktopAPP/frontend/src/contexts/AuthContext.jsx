import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('tinku_user');
    try {
      if (saved && saved !== 'undefined') {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error parsing user from localStorage', e);
      localStorage.removeItem('tinku_user');
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get('/me');
      setUser(res.data);
      localStorage.setItem('tinku_user', JSON.stringify(res.data));
      localStorage.setItem('tinku_last_refresh', Date.now().toString());
    } catch {
      localStorage.removeItem('tinku_token');
      localStorage.removeItem('tinku_user');
      localStorage.removeItem('tinku_last_refresh');
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('tinku_token');
    if (token) {
      const lastRefresh = parseInt(localStorage.getItem('tinku_last_refresh') || '0', 10);
      const fiveMinutes = 5 * 60 * 1000;
      const isStale = !lastRefresh || (Date.now() - lastRefresh > fiveMinutes);

      if (isStale) {
        fetchUser().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/login', { email, password });
    if (res.data.otp_required) {
      return { otp_required: true, email: res.data.email };
    }
    localStorage.setItem('tinku_token', res.data.token);
    localStorage.setItem('tinku_user', JSON.stringify(res.data.user));
    localStorage.setItem('tinku_last_refresh', Date.now().toString());
    setUser(res.data.user);
    return res.data.user;
  };

  const verifyOtp = async (email, otp) => {
    const res = await api.post('/login/verify-otp', { email, otp });
    localStorage.setItem('tinku_token', res.data.token);
    localStorage.setItem('tinku_user', JSON.stringify(res.data.user));
    localStorage.setItem('tinku_last_refresh', Date.now().toString());
    setUser(res.data.user);
    return res.data.user;
  };

  const resendOtp = async (email) => {
    await api.post('/login/resend-otp', { email });
  };

  const logout = async () => {
    try { await api.post('/logout'); } catch(e) {}
    localStorage.removeItem('tinku_token');
    localStorage.removeItem('tinku_user');
    localStorage.removeItem('tinku_last_refresh');
    setUser(null);
  };

  const can = (permission) => {
    if (!user) return false;
    if (user.is_owner || user.is_admin) return true;
    return user.permissions?.includes(permission) || false;
  };

  const isOwner = () => user?.is_owner || false;
  const isAdmin = () => user?.is_admin || false;
  const isManager = () => user?.roles?.includes('manager') || false;
  const hasFullAccess = () => user?.is_owner || user?.is_admin || false;
  const hasRole = (role) => user?.roles?.includes(role) || false;

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyOtp, resendOtp, logout, can, isOwner, isAdmin, isManager, hasFullAccess, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
