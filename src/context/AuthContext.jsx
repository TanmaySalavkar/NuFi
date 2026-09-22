import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';

export const AuthContext = createContext();

const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';

// Create axios instance for auth
const apiClient = axios.create({
  baseURL: API_URL.replace(/\/api\/?$/, ''),
  timeout: 60000, // 60s — AI food scans can take 20+ seconds
  headers: { 'Content-Type': 'application/json' },
});

// Automatically attach user device timezone offset (e.g. -330 for IST) to all API requests
apiClient.interceptors.request.use((config) => {
  config.headers['x-timezone-offset'] = new Date().getTimezoneOffset();
  return config;
});

// Helper with automatic IP fallback (between 10.0.2.2 for emulator and localhost for physical device with adb reverse)
const postWithFallback = async (endpoint, data) => {
  try {
    return await apiClient.post(endpoint, data);
  } catch (err) {
    if (!err.response) {
      const currentBase = apiClient.defaults.baseURL;
      const altBase = currentBase.includes('10.0.2.2')
        ? 'http://localhost:3000'
        : 'http://10.0.2.2:3000';
      try {
        const response = await axios.post(`${altBase}${endpoint}`, data, {
          headers: { 'Content-Type': 'application/json', ...apiClient.defaults.headers.common },
          timeout: 15000,
        });
        apiClient.defaults.baseURL = altBase;
        return response;
      } catch (altErr) {
        if (altErr.response) throw altErr;
      }
    }
    throw err;
  }
};

const getWithFallback = async (endpoint) => {
  try {
    return await apiClient.get(endpoint);
  } catch (err) {
    if (!err.response) {
      const currentBase = apiClient.defaults.baseURL;
      const altBase = currentBase.includes('10.0.2.2')
        ? 'http://localhost:3000'
        : 'http://10.0.2.2:3000';
      try {
        const response = await axios.get(`${altBase}${endpoint}`, {
          headers: apiClient.defaults.headers.common,
          timeout: 15000,
        });
        apiClient.defaults.baseURL = altBase;
        return response;
      } catch (altErr) {
        if (altErr.response) throw altErr;
      }
    }
    throw err;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!user;

  // Setup axios interceptor when token changes
  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load stored token on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Validate token with server
        try {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const response = await getWithFallback('/api/auth/me');
          setUser(response.data.user);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        } catch (err) {
          console.log('Stored token invalid, logging out');
          await clearAuth();
        }
      }
    } catch (err) {
      console.error('Error loading stored auth:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuth = async () => {
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common['Authorization'];
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    } catch (e) {
      console.log('Error clearing auth from storage:', e);
    }
  };

  const login = useCallback(async (email, password) => {
    try {
      const response = await postWithFallback('/api/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;

      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setToken(newToken);
      setUser(userData);

      await AsyncStorage.setItem(TOKEN_KEY, newToken);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));

      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.error 
        || (err.message?.includes('Network Error') ? 'Cannot connect to server. Ensure backend server (node index.js) is running on port 3000.' : 'Login failed. Please try again.');
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (data) => {
    try {
      const response = await postWithFallback('/api/auth/register', data);
      const { token: newToken, user: userData } = response.data;

      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setToken(newToken);
      setUser(userData);

      await AsyncStorage.setItem(TOKEN_KEY, newToken);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));

      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.error 
        || (err.message?.includes('Network Error') ? 'Cannot connect to server. Ensure backend server (node index.js) is running on port 3000.' : 'Registration failed. Please try again.');
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        apiClient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
