import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../services/AuthApi';
import { getToken, removeToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await getMe();
      setUser(data.user);
    } catch (err) {
      // Token is invalid or expired
      if (err.status === 401 || err.status === 403) {
        removeToken();
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  const onAuthSuccess = useCallback((userData) => {
    setUser(userData || null);
    // If no user data was returned (login only returns token), fetch it
    if (!userData) {
      loadUser();
    }
  }, [loadUser]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, onAuthSuccess, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
