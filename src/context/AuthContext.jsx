import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

// Helpers to persist/clear the user object in localStorage for optimistic hydration
const STORAGE_USER_KEY = 'authUser';
const PORTAL_GATEWAY_TOKEN_KEY = 'portalGatewayToken';
const PORTAL_GATEWAY_USER_KEY = 'portalGatewayUser';
const PORTAL_TAB_ACTIVE_KEY = 'portalVerifiedActive';

const saveUserToStorage = (user) => {
  try { localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)); } catch (_) {}
};
const loadUserFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
};

function clearPortalBrowserCaches() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('reports') || k.startsWith('assets') || k.startsWith('employees')) {
        localStorage.removeItem(k);
      }
    });
  } catch (_) {}
}

export function AuthProvider({ children }) {
  // Enforce shared-computer boundary: if unremembered portal user reopened browser, revert to gateway token
  const rawCached = loadUserFromStorage();
  if (
    typeof window !== 'undefined' &&
    rawCached?.isPortalSession &&
    !rawCached?.rememberDevice &&
    !sessionStorage.getItem(PORTAL_TAB_ACTIVE_KEY)
  ) {
    const gwToken = localStorage.getItem(PORTAL_GATEWAY_TOKEN_KEY);
    const gwUserRaw = localStorage.getItem(PORTAL_GATEWAY_USER_KEY);
    if (gwToken && gwUserRaw) {
      localStorage.setItem('token', gwToken);
      localStorage.setItem(STORAGE_USER_KEY, gwUserRaw);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  }

  // Hydrate user state immediately from localStorage.
  // If user is cached, render immediately (loading = false) so UI is instant.
  const cachedUser = loadUserFromStorage();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(() => !cachedUser && !!token);

  const handleSessionExpired = () => {
    const gwToken = localStorage.getItem(PORTAL_GATEWAY_TOKEN_KEY);
    const gwUserRaw = localStorage.getItem(PORTAL_GATEWAY_USER_KEY);
    sessionStorage.removeItem(PORTAL_TAB_ACTIVE_KEY);
    if (gwToken && gwUserRaw && cachedUser?.isPortalSession) {
      try {
        const gwUser = JSON.parse(gwUserRaw);
        localStorage.setItem('token', gwToken);
        saveUserToStorage(gwUser);
        setUser(gwUser);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/portal/identify')) {
          window.location.href = '/portal/identify';
        }
        return;
      } catch (_) {}
    }

    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(PORTAL_GATEWAY_TOKEN_KEY);
    localStorage.removeItem(PORTAL_GATEWAY_USER_KEY);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?expired=1';
    }
  };

  useEffect(() => {
    const onAuthExpired = () => handleSessionExpired();
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

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
        if (res.status === 401 || res.status === 403) {
          handleSessionExpired();
          return null;
        }
        if (!res.ok) throw new Error('Token verification failed');
        return res.json();
      })
      .then(data => {
        if (!data) return;
        if (data && data.id) {
          const freshUser = { ...data, full_name: data.fullName, name: data.fullName };
          setUser(freshUser);
          saveUserToStorage(freshUser);
        } else {
          handleSessionExpired();
        }
      })
      .catch(() => {
        // Network failure / server waking up: retain optimistic cached user session
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
        const errorMsg = data.error || (data.details ? `Server error: ${data.details}` : `Login failed with status ${response.status}`);
        throw new Error(errorMsg);
      }
      
      const authUser = data.user;
      const userState = { ...authUser, full_name: authUser.fullName, name: authUser.fullName };

      sessionStorage.removeItem(PORTAL_TAB_ACTIVE_KEY);
      if (authUser.role === 'PORTAL_ACCESS' || authUser.tokenScope === 'PORTAL_GATEWAY') {
        localStorage.setItem(PORTAL_GATEWAY_TOKEN_KEY, data.token);
        localStorage.setItem(PORTAL_GATEWAY_USER_KEY, JSON.stringify(userState));
      } else {
        localStorage.removeItem(PORTAL_GATEWAY_TOKEN_KEY);
        localStorage.removeItem(PORTAL_GATEWAY_USER_KEY);
      }

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

  const verifyPortalEmployee = (verifyPayload) => {
    const verifiedUser = verifyPayload.user;
    const userState = { ...verifiedUser, full_name: verifiedUser.fullName, name: verifiedUser.fullName };
    clearPortalBrowserCaches();
    localStorage.setItem('token', verifyPayload.token);
    saveUserToStorage(userState);
    if (!verifiedUser.rememberDevice) {
      sessionStorage.setItem(PORTAL_TAB_ACTIVE_KEY, '1');
    } else {
      sessionStorage.removeItem(PORTAL_TAB_ACTIVE_KEY);
    }
    setUser(userState);
    return userState;
  };

  const switchEmployee = async () => {
    const activeToken = localStorage.getItem('token');
    if (activeToken && user?.isPortalSession) {
      try {
        await fetch(`${API_URL}/portal/switch`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
          keepalive: true,
        });
      } catch (_) {}
    }

    sessionStorage.removeItem(PORTAL_TAB_ACTIVE_KEY);
    clearPortalBrowserCaches();

    const gwToken = localStorage.getItem(PORTAL_GATEWAY_TOKEN_KEY);
    const gwUserRaw = localStorage.getItem(PORTAL_GATEWAY_USER_KEY);
    if (gwToken && gwUserRaw) {
      try {
        const gwUser = JSON.parse(gwUserRaw);
        localStorage.setItem('token', gwToken);
        saveUserToStorage(gwUser);
        setUser(gwUser);
        return '/portal/identify';
      } catch (_) {}
    }

    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(PORTAL_GATEWAY_TOKEN_KEY);
    localStorage.removeItem(PORTAL_GATEWAY_USER_KEY);
    return '/login';
  };

  const logout = () => {
    const activeToken = localStorage.getItem('token');
    if (activeToken && user?.isPortalSession) {
      fetch(`${API_URL}/portal/switch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
        keepalive: true,
      }).catch(() => {});
    }
    sessionStorage.removeItem(PORTAL_TAB_ACTIVE_KEY);
    clearPortalBrowserCaches();
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(PORTAL_GATEWAY_TOKEN_KEY);
    localStorage.removeItem(PORTAL_GATEWAY_USER_KEY);
  };

  // Automatic inactivity expiry for portal sessions without Remember My Device
  useEffect(() => {
    if (!user?.isPortalSession || user?.rememberDevice) return;
    const timeoutMs = Math.max(5, Number(user.idleTimeoutMinutes) || 30) * 60 * 1000;
    let timer = null;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const target = await switchEmployee();
        if (typeof window !== 'undefined') {
          window.location.href = target;
        }
      }, timeoutMs);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [user?.isPortalSession, user?.rememberDevice, user?.idleTimeoutMinutes]);

  const value = { user, login, logout, verifyPortalEmployee, switchEmployee, loading };

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
