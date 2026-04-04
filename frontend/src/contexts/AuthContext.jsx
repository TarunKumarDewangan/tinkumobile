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

  useEffect(() => {
    const token = localStorage.getItem('tinku_token');
    if (token) {
      api.get('/me')
        .then(res => { setUser(res.data); localStorage.setItem('tinku_user', JSON.stringify(res.data)); })
        .catch(() => { localStorage.removeItem('tinku_token'); localStorage.removeItem('tinku_user'); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/login', { email, password });
    localStorage.setItem('tinku_token', res.data.token);
    localStorage.setItem('tinku_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post('/logout'); } catch(e) {}
    localStorage.removeItem('tinku_token');
    localStorage.removeItem('tinku_user');
    setUser(null);
  };

  const can = (permission) => {
    if (!user) return false;
    if (user.is_owner || user.is_admin) return true;
    return user.permissions?.includes(permission) || false;
  };

  const isOwner = () => user?.is_owner || false;
  const isAdmin = () => user?.is_admin || false;
  const hasFullAccess = () => user?.is_owner || user?.is_admin || false;
  const hasRole = (role) => user?.roles?.includes(role) || false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, isOwner, isAdmin, hasFullAccess, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
