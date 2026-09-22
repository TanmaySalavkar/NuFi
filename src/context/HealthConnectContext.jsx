import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';
import {
  SUPPORTED_METRICS,
  getHealthConnectAvailability,
  initHealthConnect,
  requestHealthPermissions,
  getGrantedPermissions,
  openHealthConnectManager,
  buildCanonicalSnapshot,
} from '../services/healthConnectService';

export const HealthConnectContext = createContext({
  availability: 'checking',
  isConnected: false,
  isSyncing: false,
  syncEnabled: true,
  assistantAccessEnabled: true,
  grantedMetrics: [],
  missingMetrics: [],
  lastSyncedAt: null,
  syncErrors: {},
  latest: {},
  today: {},
  dailySummaries: [],
  sourceApps: [],
  syncNow: async () => ({ success: false }),
  requestAccess: async () => ({ success: false }),
  updateSettings: async () => {},
  disconnect: async () => {},
  deleteCloudData: async () => {},
  openSettings: async () => {},
});

const STORAGE_SNAPSHOT_KEY = '@health_connect_snapshot';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const HealthConnectProvider = ({ children }) => {
  const { apiClient, isAuthenticated, user } = useContext(AuthContext);

  const [availability, setAvailability]         = useState('checking'); // 'available' | 'unavailable' | 'provider update required' | 'not supported'
  const [isConnected, setIsConnected]           = useState(false);
  const [syncEnabled, setSyncEnabled]           = useState(true);
  const [assistantAccessEnabled, setAssistantAccessEnabled] = useState(true);
  const [isSyncing, setIsSyncing]               = useState(false);
  const [grantedMetrics, setGrantedMetrics]     = useState([]);
  const [lastSyncedAt, setLastSyncedAt]         = useState(null);
  const [syncErrors, setSyncErrors]             = useState({});
  const [latest, setLatest]                     = useState({});
  const [today, setToday]                       = useState({});
  const [dailySummaries, setDailySummaries]     = useState([]);
  const [sourceApps, setSourceApps]             = useState([]);

  const isSyncingRef    = useRef(false);
  const lastSyncTimeRef = useRef(0);
  const appStateRef     = useRef(AppState.currentState);

  const stateRef = useRef({
    latest,
    dailySummaries,
    sourceApps,
    syncEnabled,
    assistantAccessEnabled,
  });

  useEffect(() => {
    stateRef.current = {
      latest,
      dailySummaries,
      sourceApps,
      syncEnabled,
      assistantAccessEnabled,
    };
  });

  // Compute missing metrics from supported list
  const missingMetrics = SUPPORTED_METRICS
    .map(m => m.key)
    .filter(k => !grantedMetrics.includes(k));

  // Check device availability on mount
  const checkAvailability = useCallback(async () => {
    try {
      const status = await getHealthConnectAvailability();
      setAvailability(status);
      return status;
    } catch (err) {
      setAvailability('unavailable');
      return 'unavailable';
    }
  }, []);

  // Load saved local and server snapshot
  const loadSavedState = useCallback(async () => {
    try {
      // 1. Try local cache first
      const cached = await AsyncStorage.getItem(STORAGE_SNAPSHOT_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          setIsConnected(!!parsed.connected);
          setSyncEnabled(parsed.sync_enabled ?? true);
          setAssistantAccessEnabled(parsed.assistant_access_enabled ?? true);
          setGrantedMetrics(parsed.granted_metrics || []);
          setLatest(parsed.latest || {});
          setToday(parsed.today || {});
          setDailySummaries(parsed.daily_summaries || []);
          setSourceApps(parsed.source_apps || []);
          if (parsed.synced_at) {
            setLastSyncedAt(parsed.synced_at);
            lastSyncTimeRef.current = new Date(parsed.synced_at).getTime();
          }
        }
      }

      // 2. Fetch authoritative snapshot from backend if authenticated
      if (isAuthenticated && apiClient) {
        try {
          const res = await apiClient.get('/api/v1/health-connect');
          if (res?.data && res.data.snapshot) {
            const snap = res.data.snapshot;
            setIsConnected(!!snap.connected);
            setSyncEnabled(snap.sync_enabled ?? true);
            setAssistantAccessEnabled(snap.assistant_access_enabled ?? true);
            setGrantedMetrics(snap.granted_metrics || []);
            setLatest(snap.latest || {});
            setToday(snap.today || {});
            setDailySummaries(snap.daily_summaries || []);
            setSourceApps(snap.source_apps || []);
            if (snap.synced_at) {
              setLastSyncedAt(snap.synced_at);
              lastSyncTimeRef.current = new Date(snap.synced_at).getTime();
            }
            await AsyncStorage.setItem(STORAGE_SNAPSHOT_KEY, JSON.stringify(snap));
          }
        } catch (serverErr) {
          // 404 means no snapshot saved yet for this user — normal state
          if (serverErr.response?.status !== 404) {
            console.warn('[HealthConnect] Server fetch warning:', serverErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('[HealthConnect] Error loading saved state:', e);
    }
  }, [isAuthenticated, apiClient]);

  useEffect(() => {
    checkAvailability();
    loadSavedState();
  }, [checkAvailability, loadSavedState]);

  /**
   * Performs sync with Health Connect and backend API
   */
  const syncNow = useCallback(async (opts = {}) => {
    if (isSyncingRef.current) {
      return { success: false, reason: 'Sync already in progress' };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    const syncStartTime = Date.now();

    try {
      // Build canonical snapshot
      const snapshot = await buildCanonicalSnapshot({
        previousSnapshot: {
          latest: stateRef.current.latest,
          daily_summaries: stateRef.current.dailySummaries,
          source_apps: stateRef.current.sourceApps,
        },
      });

      if (opts.forceGranted) {
        snapshot.granted_metrics = opts.forceGranted;
      }

      setGrantedMetrics(snapshot.granted_metrics || []);
      setLatest(snapshot.latest || {});
      setToday(snapshot.today || {});
      setDailySummaries(snapshot.daily_summaries || []);
      setSourceApps(snapshot.source_apps || []);
      setSyncErrors(snapshot.sync_errors || {});

      // Prevent race conditions: do not overwrite newer sync response
      if (syncStartTime < lastSyncTimeRef.current) {
        return { success: true, warning: 'Stale sync discarded' };
      }

      const nowIso = new Date().toISOString();
      setLastSyncedAt(nowIso);
      lastSyncTimeRef.current = syncStartTime;

      const payload = {
        ...snapshot,
        connected: true,
        sync_enabled: stateRef.current.syncEnabled,
        assistant_access_enabled: stateRef.current.assistantAccessEnabled,
        synced_at: nowIso,
      };

      // Save locally
      await AsyncStorage.setItem(STORAGE_SNAPSHOT_KEY, JSON.stringify(payload));

      // Push to backend API
      if (isAuthenticated && apiClient) {
        try {
          const res = await apiClient.put('/api/v1/health-connect', payload);
          if (res?.data?.snapshot) {
            setLastSyncedAt(res.data.snapshot.synced_at || nowIso);
          }
        } catch (apiErr) {
          console.warn('[HealthConnect] API sync failed (saved locally):', apiErr.message);
        }
      }

      return { success: true, snapshot };
    } catch (err) {
      console.warn('[HealthConnect] Sync error:', err);
      setSyncErrors(prev => ({ ...prev, general: err.message }));
      return { success: false, error: err.message };
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isAuthenticated, apiClient]);

  // Foreground sync listener (only if connected, enabled, and >5 mins since last sync)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        const timeSince = Date.now() - lastSyncTimeRef.current;
        if (isConnected && syncEnabled && timeSince > FIVE_MINUTES_MS && !isSyncingRef.current) {
          syncNow();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => sub.remove();
  }, [isConnected, syncEnabled, syncNow]);

  /**
   * Request permissions explicitly on user action
   */
  const requestAccess = useCallback(async () => {
    try {
      const avail = await checkAvailability();
      if (avail !== 'available') {
        return { success: false, status: avail, error: `Health Connect is ${avail}` };
      }

      const granted = await requestHealthPermissions();
      const grantedRecordTypes = new Set(
        granted.filter(p => p.accessType === 'read').map(p => p.recordType)
      );

      const newGrantedMetrics = SUPPORTED_METRICS
        .filter(m => grantedRecordTypes.has(m.recordType))
        .map(m => m.key);

      setGrantedMetrics(newGrantedMetrics);

      if (newGrantedMetrics.length > 0) {
        setIsConnected(true);
        // Trigger initial sync upon explicit connection
        syncNow({ forceGranted: newGrantedMetrics });
        return { success: true, grantedMetrics: newGrantedMetrics };
      } else {
        return { success: false, error: 'No permissions were granted by user.' };
      }
    } catch (err) {
      return { success: false, error: err.message || 'Permission request failed' };
    }
  }, [checkAvailability, syncNow]);

  /**
   * Updates user settings (syncEnabled, assistantAccessEnabled)
   */
  const updateSettings = useCallback(async (newSettings) => {
    if (newSettings.sync_enabled !== undefined) {
      setSyncEnabled(newSettings.sync_enabled);
    }
    if (newSettings.assistant_access_enabled !== undefined) {
      setAssistantAccessEnabled(newSettings.assistant_access_enabled);
    }

    if (isAuthenticated && apiClient) {
      try {
        await apiClient.patch('/api/v1/health-connect', newSettings);
      } catch (err) {
        console.warn('[HealthConnect] updateSettings API error:', err.message);
      }
    }
  }, [isAuthenticated, apiClient]);

  /**
   * Disconnects Health Connect (retains saved history on cloud, stops future syncs)
   */
  const disconnect = useCallback(async () => {
    setIsConnected(false);
    setSyncEnabled(false);

    if (isAuthenticated && apiClient) {
      try {
        await apiClient.patch('/api/v1/health-connect', { connected: false, sync_enabled: false });
      } catch (err) {
        console.warn('[HealthConnect] disconnect API error:', err.message);
      }
    }

    // Update local cache
    try {
      const cached = await AsyncStorage.getItem(STORAGE_SNAPSHOT_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.connected = false;
        parsed.sync_enabled = false;
        await AsyncStorage.setItem(STORAGE_SNAPSHOT_KEY, JSON.stringify(parsed));
      }
    } catch (e) {}
  }, [isAuthenticated, apiClient]);

  /**
   * Permanently deletes synced Health Connect data from server and local storage
   */
  const deleteCloudData = useCallback(async () => {
    setIsConnected(false);
    setGrantedMetrics([]);
    setLatest({});
    setDailySummaries([]);
    setSourceApps([]);
    setLastSyncedAt(null);
    setSyncErrors({});
    lastSyncTimeRef.current = 0;

    await AsyncStorage.removeItem(STORAGE_SNAPSHOT_KEY);

    if (isAuthenticated && apiClient) {
      try {
        await apiClient.delete('/api/v1/health-connect');
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  }, [isAuthenticated, apiClient]);

  const value = {
    availability,
    isConnected,
    isSyncing,
    syncEnabled,
    assistantAccessEnabled,
    grantedMetrics,
    missingMetrics,
    lastSyncedAt,
    syncErrors,
    latest,
    today,
    dailySummaries,
    sourceApps,
    supportedMetrics: SUPPORTED_METRICS,
    checkAvailability,
    requestAccess,
    syncNow,
    updateSettings,
    disconnect,
    deleteCloudData,
    openSettings: openHealthConnectManager,
  };

  return (
    <HealthConnectContext.Provider value={value}>
      {children}
    </HealthConnectContext.Provider>
  );
};
