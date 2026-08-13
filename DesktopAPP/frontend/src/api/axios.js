import axios from 'axios';
import pinGate from '../utils/pinGate';

const api = axios.create({
  // Use relative /api in dev (Vite proxy handles forwarding to :8000)
  // In production set VITE_API_URL to your domain e.g. https://tinkumobiles.com/api
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tinku_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // If a PIN was just verified, attach the one-time proof token to this
  // (the very next) request. Call sites always call pinGate.confirm()
  // immediately before the actual protected request, so this lines up —
  // it's consumed here either way so it's never reused for a later,
  // unrelated request.
  const pinToken = pinGate.consumeToken();
  if (pinToken) {
    config.headers['X-Pin-Token'] = pinToken;
  }

  return config;
});

// Auto-handle 401 → logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tinku_token');
      localStorage.removeItem('tinku_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
