import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

// Helpers to persist/clear the user object in localStorage for optimistic hydration
const STORAGE_USER_KEY = 'authUser';
const saveUserToStorage = (user) => {
  try { localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)); } catch (_) {}
};
const loadUserFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
};

export function AuthProvider({ children }) {
  // Hydrate user state immediately from localStorage.
  // If user is cached, render immediately (loading = false) so UI is instant.
  const cachedUser = loadUserFromStorage();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(() => !cachedUser && !!token);

  useEffect(() => {
    const currentToken = localStorage.getItem('token');

    // Pre-warm the backend connection asynchronously in the background.
    fetch(`${API_URL}/warmup`).catch(() => {});

    if (!currentToken) {
      setLoading(false);
      return;
    }

    // Validate token in the background without freezing the UI.
    fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Token expired or invalid');
        return res.json();
      })
      .then(data => {
        if (data && data.id) {
          const freshUser = { ...data, full_name: data.fullName, name: data.fullName };
          setUser(freshUser);
          saveUserToStorage(freshUser);
        } else {
          // Token invalid — clear session
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem(STORAGE_USER_KEY);
        }
      })
      .catch(() => {
        // Network failure / offline: retain optimistic user session
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        throw new Error(`Invalid server response (${response.status}). Is the backend running?`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Login failed with status ${response.status}`);
      }
      
      const authUser = data.user;
      const userState = { ...authUser, full_name: authUser.fullName, name: authUser.fullName };
      
      localStorage.setItem('token', data.token);
      saveUserToStorage(userState);
      setUser(userState);
      return userState;
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please ensure the backend is running.');
      }
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem(STORAGE_USER_KEY);
  };

  const value = { user, login, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
