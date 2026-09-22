'use strict';

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const HealthConnectSnapshot = require('../models/HealthConnectSnapshot');
const { encryptData, decryptData, sanitizeForLog } = require('../utils/cryptoUtil');

const router = express.Router();

// All Health Connect endpoints are user-scoped and require authentication
router.use(authMiddleware);

const VALID_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates timezone string using Intl.DateTimeFormat
 */
function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * GET /api/v1/health-connect
 * Fetches and decrypts the authenticated user's Health Connect snapshot
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const doc = await HealthConnectSnapshot.findOne({ userId });

    if (!doc) {
      return res.status(404).json({ error: 'No Health Connect snapshot found.' });
    }

    // Decrypt sensitive biometric data
    let latest = {};
    let daily_summaries = [];

    if (doc.encrypted_latest && doc.iv && doc.auth_tag) {
      try {
        latest = decryptData(doc.encrypted_latest, doc.iv, doc.auth_tag) || {};
      } catch (err) {
        console.error('[HealthConnect] Failed to decrypt latest metrics:', err.message);
      }
    }

    // Use dedicated daily_iv/daily_auth_tag if present (new envelope), fallback to shared iv/auth_tag for legacy docs
    if (doc.encrypted_daily_summaries) {
      const dailyIv = doc.daily_iv || doc.iv;
      const dailyAuthTag = doc.daily_auth_tag || doc.auth_tag;
      if (dailyIv && dailyAuthTag) {
        try {
          daily_summaries = decryptData(doc.encrypted_daily_summaries, dailyIv, dailyAuthTag) || [];
        } catch (err) {
          console.error('[HealthConnect] Failed to decrypt daily summaries:', err.message);
        }
      }
    }

    res.json({
      success: true,
      snapshot: {
        connected: doc.connected,
        sync_enabled: doc.sync_enabled,
        assistant_access_enabled: doc.assistant_access_enabled,
        granted_metrics: doc.granted_metrics || [],
        source_apps: doc.source_apps || [],
        latest,
        daily_summaries,
        synced_at: doc.synced_at,
        history_refreshed_on: doc.history_refreshed_on,
        sync_errors: doc.sync_errors || {},
      },
    });
  } catch (err) {
    console.error('[HealthConnect] GET error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve Health Connect data.' });
  }
});

/**
 * PUT /api/v1/health-connect
 * Upserts a validated, encrypted Health Connect snapshot for the authenticated user
 */
router.put('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      timezone,
      history_refreshed_on,
      granted_metrics = [],
      source_apps = [],
      latest = {},
      daily_summaries = [],
      sync_errors = {},
      connected = true,
      sync_enabled = true,
      assistant_access_enabled = true,
    } = req.body;

    // 1. Validation
    if (timezone && !isValidTimezone(timezone)) {
      return res.status(400).json({ error: `Invalid timezone: ${timezone}` });
    }

    if (!history_refreshed_on || !VALID_DATE_REGEX.test(history_refreshed_on)) {
      return res.status(400).json({ error: 'history_refreshed_on must be formatted as YYYY-MM-DD.' });
    }

    if (!Array.isArray(granted_metrics) || granted_metrics.length > 50) {
      return res.status(400).json({ error: 'Invalid granted_metrics array.' });
    }

    if (!Array.isArray(daily_summaries) || daily_summaries.length > 40) {
      return res.status(400).json({ error: 'daily_summaries exceeds maximum allowed length of 40 days.' });
    }

    // Validate daily summaries structure & ranges
    for (const day of daily_summaries) {
      if (!day.date || !VALID_DATE_REGEX.test(day.date)) {
        return res.status(400).json({ error: `Invalid date format in daily summary: ${day.date}` });
      }
      if (day.steps != null && (typeof day.steps !== 'number' || day.steps < 0 || day.steps > 200000)) {
        return res.status(400).json({ error: `Invalid steps value in summary for ${day.date}` });
      }
      if (day.active_calories != null && (typeof day.active_calories !== 'number' || day.active_calories < 0 || day.active_calories > 30000)) {
        return res.status(400).json({ error: `Invalid calories value in summary for ${day.date}` });
      }
    }

    // 2. Encrypt sensitive payloads at rest using AES-256-GCM
    // IMPORTANT: each encryptData() call generates a fresh IV+authTag — they MUST be stored separately
    const encLatest = encryptData(latest);
    const encDaily = encryptData(daily_summaries);

    // Notice we sanitize before logging: NEVER log raw health metrics or decrypted payloads
    console.log(`[HealthConnect] Upserting encrypted snapshot for user: ${userId}`, sanitizeForLog({
      granted_metrics,
      source_apps,
      history_refreshed_on,
    }));

    const updateDoc = {
      connected: Boolean(connected),
      sync_enabled: Boolean(sync_enabled),
      assistant_access_enabled: Boolean(assistant_access_enabled),
      granted_metrics,
      source_apps,
      history_refreshed_on,
      synced_at: new Date(),
      // latest envelope
      encrypted_latest: encLatest.ciphertext,
      iv: encLatest.iv,
      auth_tag: encLatest.authTag,
      // daily_summaries envelope — separate IV+authTag so GCM tag verification succeeds
      encrypted_daily_summaries: encDaily.ciphertext,
      daily_iv: encDaily.iv,
      daily_auth_tag: encDaily.authTag,
      sync_errors: typeof sync_errors === 'object' && sync_errors !== null ? sync_errors : {},
    };

    const updated = await HealthConnectSnapshot.findOneAndUpdate(
      { userId },
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    // Return authoritative updated snapshot
    res.json({
      success: true,
      snapshot: {
        connected: updated.connected,
        sync_enabled: updated.sync_enabled,
        assistant_access_enabled: updated.assistant_access_enabled,
        granted_metrics: updated.granted_metrics,
        source_apps: updated.source_apps,
        latest,
        daily_summaries,
        synced_at: updated.synced_at,
        history_refreshed_on: updated.history_refreshed_on,
        sync_errors: updated.sync_errors,
      },
    });
  } catch (err) {
    console.error('[HealthConnect] PUT error:', err.message);
    res.status(500).json({ error: 'Failed to update Health Connect snapshot.' });
  }
});

/**
 * PATCH /api/v1/health-connect
 * Updates user synchronization preferences (connected, sync_enabled, assistant_access_enabled)
 */
router.patch('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { connected, sync_enabled, assistant_access_enabled } = req.body;

    const updateFields = {};
    if (connected !== undefined) updateFields.connected = Boolean(connected);
    if (sync_enabled !== undefined) updateFields.sync_enabled = Boolean(sync_enabled);
    if (assistant_access_enabled !== undefined) updateFields.assistant_access_enabled = Boolean(assistant_access_enabled);

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No valid setting fields provided to update.' });
    }

    const updated = await HealthConnectSnapshot.findOneAndUpdate(
      { userId },
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'No Health Connect snapshot found to update.' });
    }

    res.json({
      success: true,
      settings: {
        connected: updated.connected,
        sync_enabled: updated.sync_enabled,
        assistant_access_enabled: updated.assistant_access_enabled,
      },
    });
  } catch (err) {
    console.error('[HealthConnect] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update Health Connect settings.' });
  }
});

/**
 * DELETE /api/v1/health-connect
 * Permanently removes the authenticated user's synced Health Connect snapshot
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    await HealthConnectSnapshot.deleteOne({ userId });

    console.log(`[HealthConnect] Permanently deleted snapshot for user: ${userId}`);
    res.json({
      success: true,
      message: 'Health Connect data permanently deleted.',
    });
  } catch (err) {
    console.error('[HealthConnect] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete Health Connect data.' });
  }
});

module.exports = router;
