'use strict';

const mongoose = require('mongoose');

const healthConnectSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    connected: {
      type: Boolean,
      default: true,
    },
    sync_enabled: {
      type: Boolean,
      default: true,
    },
    assistant_access_enabled: {
      type: Boolean,
      default: true,
    },
    granted_metrics: {
      type: [String],
      default: [],
    },
    source_apps: {
      type: [String],
      default: [],
    },
    history_refreshed_on: {
      type: String,
      required: true,
    },
    synced_at: {
      type: Date,
      default: Date.now,
    },
    // Sensitive health data is encrypted at rest using AES-256-GCM
    encrypted_latest: {
      type: String,
      default: '',
    },
    encrypted_daily_summaries: {
      type: String,
      default: '',
    },
    iv: {
      type: String,
      default: '',
    },
    auth_tag: {
      type: String,
      default: '',
    },
    // Separate envelope for encrypted_daily_summaries (each encryptData() call generates a fresh IV+authTag)
    daily_iv: {
      type: String,
      default: '',
    },
    daily_auth_tag: {
      type: String,
      default: '',
    },
    sync_errors: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('HealthConnectSnapshot', healthConnectSnapshotSchema);
