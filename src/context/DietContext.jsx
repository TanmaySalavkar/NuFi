import React, { createContext, useState, useContext, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext';

export const DietContext = createContext();

export const DietProvider = ({ children }) => {
  const { apiClient, isAuthenticated } = useContext(AuthContext);

  const [dashboard, setDashboard] = useState({
    targets: { calories: 2000, protein: 115, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 },
    consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    meals: [],
    habits: [],
    healthScore: 0,
    userName: '',
  });

  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const lastFetchTime = useRef(0); // timestamp of last successful dashboard fetch
  const CACHE_TTL = 60 * 1000;    // 60 seconds — treat data as fresh within this window

  /**
   * Fetch dashboard data from backend.
   * @param {boolean} force - bypass cache and always fetch (default: false)
   */
  const fetchDashboard = useCallback(async ({ force = false } = {}) => {
    if (!isAuthenticated || !apiClient) return;
    // Skip network call if data is still fresh and no force refresh requested
    if (!force && Date.now() - lastFetchTime.current < CACHE_TTL) return;
    setIsDashboardLoading(true);
    try {
      const response = await apiClient.get('/api/diet/dashboard');
      if (response && response.data) {
        setDashboard(response.data);
        lastFetchTime.current = Date.now();
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err && err.message ? err.message : 'Unknown error');
    } finally {
      setIsDashboardLoading(false);
    }
  }, [isAuthenticated, apiClient]);

  /**
   * Scan food image using AI Vision
   */
  const scanFood = useCallback(async (imageBase64) => {
    if (!apiClient) return { success: false, error: 'Not connected to server' };
    setIsScanning(true);
    setScanResult(null);
    try {
      const response = await apiClient.post('/api/diet/scan', { imageBase64 });
      const result = response && response.data ? response.data.nutrition : null;
      if (!result) return { success: false, error: 'No nutrition data returned from server' };
      setScanResult(result);
      return { success: true, nutrition: result };
    } catch (err) {
      console.error('Error scanning food:', err && err.message ? err.message : 'Unknown error');
      const errorMsg = (err && err.response && err.response.data && err.response.data.error) || 'Scan failed. Please check your connection and try again.';
      return { success: false, error: errorMsg };
    } finally {
      setIsScanning(false);
    }
  }, [apiClient]);

  /**
   * Log a meal to the database
   */
  const logMeal = useCallback(async (mealData) => {
    setIsLogging(true);
    try {
      const response = await apiClient.post('/api/diet/log', mealData);
      // Force refresh after logging so new meal appears immediately
      await fetchDashboard({ force: true });
      return { success: true, meal: response.data.meal };
    } catch (err) {
      console.error('Error logging meal:', err.message);
      return { success: false, error: err.response?.data?.error || 'Failed to log meal' };
    } finally {
      setIsLogging(false);
    }
  }, [apiClient, fetchDashboard]);

  /**
   * Fetch meal history for a specific date
   */
  const fetchHistory = useCallback(async (date) => {
    try {
      const params = date ? { date } : {};
      const response = await apiClient.get('/api/diet/history', { params });
      return { success: true, meals: response.data.meals };
    } catch (err) {
      console.error('Error fetching history:', err.message);
      return { success: false, error: 'Failed to fetch history' };
    }
  }, [apiClient]);

  /**
   * Update user's daily nutrition targets and/or profile
   */
  const updateTargets = useCallback(async (data) => {
    try {
      const response = await apiClient.put('/api/diet/targets', data);
      // Force refresh so updated targets show immediately
      await fetchDashboard({ force: true });
      return { success: true, ...response.data };
    } catch (err) {
      console.error('Error updating targets:', err.message);
      return { success: false, error: err.response?.data?.error || 'Failed to update targets' };
    }
  }, [apiClient, fetchDashboard]);

  /**
   * Clear scan result
   */
  const clearScanResult = useCallback(() => {
    setScanResult(null);
  }, []);

  return (
    <DietContext.Provider
      value={{
        dashboard,
        scanResult,
        isScanning,
        setIsScanning,
        isLogging,
        isDashboardLoading,
        fetchDashboard,
        scanFood,
        logMeal,
        fetchHistory,
        updateTargets,
        clearScanResult,
        setScanResult,
      }}
    >
      {children}
    </DietContext.Provider>
  );
};

