import axios from 'axios';

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
