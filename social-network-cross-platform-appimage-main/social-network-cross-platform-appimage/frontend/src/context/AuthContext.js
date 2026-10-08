import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API}/api/auth/check`, { withCredentials: true });
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password }, { withCredentials: true });
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
    setUser(null);
  };

  const register = async (formData) => {
    const res = await axios.post(`${API}/api/auth/register`, formData, {
      withCredentials: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, setUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { API };
