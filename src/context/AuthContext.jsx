import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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
  // Hydrate user state immediately from localStorage — no network call needed.
  // This makes the app render instantly on reload instead of showing a blank
  // screen while waiting for /auth/me.
  const [user, setUser] = useState(() => loadUserFromStorage());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    // Pre-warm the Render server + Neon DB connection as soon as the app loads.
    // This runs in the background and does not block the UI or login flow.
    // By the time the user types their credentials, the connection is already warm.
    fetch(`${API_URL}/warmup`).catch(() => {});

    if (!token) {
      setLoading(false);
      return;
    }

    // Validate token in the background. We already have the user from localStorage,
    // so the UI is visible. If the token is invalid, we silently log out.
    fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.id) {
          const freshUser = { ...data, full_name: data.fullName, name: data.fullName };
          setUser(freshUser);
          saveUserToStorage(freshUser);
        } else {
          // Token invalid — clear everything
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem(STORAGE_USER_KEY);
        }
      })
      .catch(() => {
        // Network error — keep the cached user so the UI doesn't break
        // The user will get a proper auth error if they try a protected API call
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
      
      // Store immediately — navigate happens right after this returns
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

