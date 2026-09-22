import { Platform } from 'react-native';

// Try importing react-native-health-connect natively, or fallback gracefully if unsupported
let HealthConnect = null;
try {
  HealthConnect = require('react-native-health-connect');
} catch (e) {
  console.warn('[HealthConnect] Native module not loaded, using fallback');
}

/**
 * 18 Supported Read-Only Metrics Mapping
 */
export const SUPPORTED_METRICS = [
  { key: 'steps',               recordType: 'Steps',                     permission: 'READ_STEPS',                   label: 'Steps',                unit: 'steps' },
  { key: 'heart_rate',          recordType: 'HeartRate',                 permission: 'READ_HEART_RATE',              label: 'Heart Rate',           unit: 'BPM' },
  { key: 'blood_pressure',      recordType: 'BloodPressure',             permission: 'READ_BLOOD_PRESSURE',          label: 'Blood Pressure',       unit: 'mmHg' },
  { key: 'blood_glucose',       recordType: 'BloodGlucose',              permission: 'READ_BLOOD_GLUCOSE',           label: 'Blood Glucose',        unit: 'mg/dL' },
  { key: 'height',              recordType: 'Height',                    permission: 'READ_HEIGHT',                  label: 'Height',               unit: 'cm' },
  { key: 'weight',              recordType: 'Weight',                    permission: 'READ_WEIGHT',                  label: 'Weight',               unit: 'kg' },
  { key: 'sleep',               recordType: 'SleepSession',              permission: 'READ_SLEEP',                   label: 'Sleep',                unit: 'mins' },
  { key: 'distance',            recordType: 'Distance',                  permission: 'READ_DISTANCE',                label: 'Distance',             unit: 'm' },
  { key: 'active_calories',     recordType: 'ActiveCaloriesBurned',      permission: 'READ_ACTIVE_CALORIES_BURNED',   label: 'Active Calories',      unit: 'kcal' },
  { key: 'total_calories',      recordType: 'TotalCaloriesBurned',       permission: 'READ_TOTAL_CALORIES_BURNED',    label: 'Total Calories',       unit: 'kcal' },
  { key: 'basal_calories',      recordType: 'BasalMetabolicRate',        permission: 'READ_BASAL_METABOLIC_RATE',     label: 'Basal Metabolic Rate', unit: 'kcal' },
  { key: 'floors_climbed',      recordType: 'FloorsClimbed',             permission: 'READ_FLOORS_CLIMBED',          label: 'Floors Climbed',       unit: 'floors' },
  { key: 'exercise_sessions',   recordType: 'ExerciseSession',           permission: 'READ_EXERCISE',                label: 'Exercise Sessions',    unit: 'sessions' },
  { key: 'resting_heart_rate',  recordType: 'RestingHeartRate',          permission: 'READ_RESTING_HEART_RATE',       label: 'Resting Heart Rate',   unit: 'BPM' },
  { key: 'hrv_rmssd',           recordType: 'HeartRateVariabilityRmssd', permission: 'READ_HEART_RATE_VARIABILITY', label: 'Heart Rate Variability', unit: 'ms' },
  { key: 'vo2_max',             recordType: 'Vo2Max',                    permission: 'READ_VO2_MAX',                 label: 'VO2 Max',              unit: 'mL/(kg·min)' },
  { key: 'oxygen_saturation',   recordType: 'OxygenSaturation',          permission: 'READ_OXYGEN_SATURATION',       label: 'Oxygen Saturation',    unit: '%' },
  { key: 'respiratory_rate',    recordType: 'RespiratoryRate',           permission: 'READ_RESPIRATORY_RATE',        label: 'Respiratory Rate',     unit: 'breaths/min' },
  { key: 'hydration',           recordType: 'Hydration',                 permission: 'READ_HYDRATION',               label: 'Hydration',            unit: 'mL' },
  { key: 'body_fat',            recordType: 'BodyFat',                   permission: 'READ_BODY_FAT',                label: 'Body Fat',             unit: '%' },
];

const TIMEOUT_MS = 10000; // 10s maximum timeout for any native operation

/**
 * Executes a promise with an enforced timeout
 */
function withTimeout(promise, ms = TIMEOUT_MS, operationName = 'Health Connect operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Checks Health Connect availability status:
 * 'available' | 'unavailable' | 'provider update required' | 'not supported'
 */
export async function getHealthConnectAvailability() {
  if (Platform.OS !== 'android' || !HealthConnect) {
    return 'not supported';
  }

  try {
    const status = await withTimeout(
      HealthConnect.getSdkStatus(),
      TIMEOUT_MS,
      'Checking Health Connect SDK status'
    );

    // HealthConnect.SdkAvailabilityStatus mapping:
    // 1: SDK_AVAILABLE
    // 2: SDK_UNAVAILABLE
    // 3: SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
    if (status === 1 || status === HealthConnect.SdkAvailabilityStatus?.SDK_AVAILABLE) {
      return 'available';
    } else if (status === 3 || status === HealthConnect.SdkAvailabilityStatus?.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'provider update required';
    } else if (status === 2 || status === HealthConnect.SdkAvailabilityStatus?.SDK_UNAVAILABLE) {
      return 'unavailable';
    }
    return 'not supported';
  } catch (err) {
    console.warn('[HealthConnect] getSdkStatus error:', err.message);
    return 'unavailable';
  }
}

/**
 * Initializes Health Connect before every permission or read operation
 */
export async function initHealthConnect() {
  if (Platform.OS !== 'android' || !HealthConnect?.initialize) {
    return false;
  }
  try {
    const isInit = await withTimeout(HealthConnect.initialize(), 5000, 'Health Connect initialize');
    return !!isInit;
  } catch (err) {
    console.warn('[HealthConnect] initialize error:', err.message);
    return false;
  }
}

/**
 * Requests read permissions for the specified metrics (NEVER write permissions)
 */
export async function requestHealthPermissions(metricsToRequest = SUPPORTED_METRICS) {
  if (Platform.OS !== 'android' || !HealthConnect?.requestPermission) {
    return [];
  }

  await initHealthConnect();

  const permissions = metricsToRequest.map(m => ({
    accessType: 'read',
    recordType: m.recordType,
  }));

  try {
    const granted = await withTimeout(
      HealthConnect.requestPermission(permissions),
      20000,
      'Requesting Health Connect permissions'
    );
    // Returns array of granted permissions
    return Array.isArray(granted) ? granted : [];
  } catch (err) {
    console.warn('[HealthConnect] requestPermission error:', err.message);
    throw err;
  }
}

/**
 * Gets currently granted permissions from Health Connect
 */
export async function getGrantedPermissions() {
  if (Platform.OS !== 'android' || !HealthConnect?.getGrantedPermissions) {
    return [];
  }

  await initHealthConnect();

  try {
    const perms = await withTimeout(
      HealthConnect.getGrantedPermissions(),
      TIMEOUT_MS,
      'Reading granted permissions'
    );
    return Array.isArray(perms) ? perms : [];
  } catch (err) {
    console.warn('[HealthConnect] getGrantedPermissions error:', err.message);
    return [];
  }
}

/**
 * Opens the native Health Connect app or settings screen
 */
export async function openHealthConnectManager() {
  if (Platform.OS !== 'android' || !HealthConnect?.openHealthConnectSettings) {
    return false;
  }
  try {
    await HealthConnect.openHealthConnectSettings();
    return true;
  } catch (err) {
    console.warn('[HealthConnect] openHealthConnectSettings error:', err.message);
    return false;
  }
}

/**
 * Unit normalization helpers
 */
export function normalizeValue(metricKey, record) {
  if (!record) return null;

  switch (metricKey) {
    case 'weight': {
      // Return kg
      const mass = record.weight || record.mass;
      if (typeof mass === 'number') return Math.round(mass * 10) / 10;
      if (mass?.inKilograms != null) return Math.round(mass.inKilograms * 10) / 10;
      if (mass?.inPounds != null) return Math.round((mass.inPounds * 0.453592) * 10) / 10;
      return null;
    }
    case 'height': {
      // Return centimeters
      const length = record.height || record.length;
      if (typeof length === 'number') {
        return length < 3 ? Math.round(length * 100) : Math.round(length);
      }
      if (length?.inMeters != null) return Math.round(length.inMeters * 100);
      if (length?.inInches != null) return Math.round(length.inInches * 2.54);
      return null;
    }
    case 'distance': {
      // Return meters
      const dist = record.distance;
      if (typeof dist === 'number') return Math.round(dist);
      if (dist?.inMeters != null) return Math.round(dist.inMeters);
      if (dist?.inKilometers != null) return Math.round(dist.inKilometers * 1000);
      return null;
    }
    case 'blood_glucose': {
      // Return mg/dL
      const level = record.level;
      if (typeof level === 'number') return Math.round(level);
      if (level?.inMilligramsPerDeciliter != null) return Math.round(level.inMilligramsPerDeciliter);
      if (level?.inMillimolesPerLiter != null) return Math.round(level.inMillimolesPerLiter * 18.0182);
      return null;
    }
    case 'sleep': {
      // Return minutes
      if (record.startTime && record.endTime) {
        const start = new Date(record.startTime).getTime();
        const end = new Date(record.endTime).getTime();
        return Math.max(0, Math.round((end - start) / (1000 * 60)));
      }
      return null;
    }
    case 'hydration': {
      // Return mL
      const vol = record.volume;
      if (typeof vol === 'number') return Math.round(vol);
      if (vol?.inMilliliters != null) return Math.round(vol.inMilliliters);
      if (vol?.inLiters != null) return Math.round(vol.inLiters * 1000);
      return null;
    }
    case 'steps':
      return record.count != null ? Number(record.count) : null;

    case 'floors_climbed':
      return record.floors != null ? Number(record.floors) : null;

    case 'active_calories':
    case 'total_calories':
    case 'basal_calories': {
      const energy = record.energy;
      if (typeof energy === 'number') return Math.round(energy);
      if (energy?.inKilocalories != null) return Math.round(energy.inKilocalories);
      if (energy?.inCalories != null) return Math.round(energy.inCalories / 1000);
      return null;
    }
    case 'heart_rate':
    case 'resting_heart_rate': {
      if (record.beatsPerMinute != null) return Math.round(record.beatsPerMinute);
      if (Array.isArray(record.samples) && record.samples.length > 0) {
        const sum = record.samples.reduce((acc, s) => acc + (s.beatsPerMinute || 0), 0);
        return Math.round(sum / record.samples.length);
      }
      return null;
    }
    case 'blood_pressure': {
      const sys = record.systolic?.inMillimetersOfMercury ?? (typeof record.systolic === 'number' ? record.systolic : null);
      const dia = record.diastolic?.inMillimetersOfMercury ?? (typeof record.diastolic === 'number' ? record.diastolic : null);
      if (sys != null && dia != null) {
        return { systolic: Math.round(sys), diastolic: Math.round(dia) };
      }
      return null;
    }
    case 'hrv_rmssd':
      return record.heartRateVariabilityMillis != null ? Math.round(record.heartRateVariabilityMillis) : null;

    case 'vo2_max':
      return record.vo2MillilitersPerMinuteKilogram != null
        ? Math.round(record.vo2MillilitersPerMinuteKilogram * 10) / 10
        : null;

    case 'oxygen_saturation':
      return record.percentage != null ? Math.round(record.percentage * 10) / 10 : null;

    case 'respiratory_rate':
      return record.rate != null ? Math.round(record.rate * 10) / 10 : null;

    case 'body_fat':
      return record.percentage != null ? Math.round(record.percentage * 10) / 10 : null;

    case 'exercise_sessions':
      return {
        title: record.title || 'Workout',
        exerciseType: record.exerciseType || 'exercise',
        durationMinutes: record.startTime && record.endTime
          ? Math.max(0, Math.round((new Date(record.endTime) - new Date(record.startTime)) / 60000))
          : 0,
      };

    default:
      return null;
  }
}

/**
 * Paginated read for a specific record type
 */
async function readRecordsPaginated(recordType, timeRangeFilter) {
  if (!HealthConnect?.readRecords) return [];

  let allRecords = [];
  let pageToken = undefined;

  do {
    const options = {
      timeRangeFilter,
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    };

    const res = await withTimeout(
      HealthConnect.readRecords(recordType, options),
      TIMEOUT_MS,
      `Reading ${recordType} records`
    );

    if (Array.isArray(res?.records)) {
      allRecords.push(...res.records);
    }
    pageToken = res?.pageToken;
  } while (pageToken && allRecords.length < 1000);

  return allRecords;
}

/**
 * Formats a Date object to YYYY-MM-DD in given timezone
 */
export function formatDateInTimezone(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Executes an array of async tasks with bounded concurrency (concurrency limit = 4)
 */
async function runWithConcurrency(tasks, limit = 4) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);

    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

/**
 * Builds the canonical 30-day + today snapshot:
 * {
 *   "timezone": "Asia/Kolkata",
 *   "granted_metrics": [],
 *   "source_apps": [],
 *   "latest": {},
 *   "daily_summaries": [],
 *   "history_refreshed_on": "YYYY-MM-DD",
 *   "sync_errors": {}
 * }
 */
export async function buildCanonicalSnapshot(options = {}) {
  const { previousSnapshot = null } = options;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const now = new Date();
  const todayStr = formatDateInTimezone(now, timezone);

  // Calculate 30 days ago at LOCAL midnight (setHours uses device-local time, i.e. IST midnight for IST users).
  // DO NOT use UTC day truncation — that gives UTC midnight = 05:30 AM IST, dropping early-morning data.
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0); // device-local midnight

  // Use 'after' operator to read all records from startDate onwards.
  // This completely avoids any native "startTime must be before endTime" exceptions.
  const timeRangeFilter = {
    operator: 'after',
    startTime: startDate.toISOString(),
  };

  const isInit = await initHealthConnect();
  if (!isInit) {
    return {
      timezone,
      granted_metrics: [],
      source_apps: [],
      latest: previousSnapshot?.latest || {},
      daily_summaries: previousSnapshot?.daily_summaries || [],
      history_refreshed_on: todayStr,
      sync_errors: { general: 'Health Connect native service unavailable' },
    };
  }

  // Get currently granted permissions
  const grantedPerms = await getGrantedPermissions();
  const grantedRecordTypes = new Set(
    grantedPerms
      .filter(p => p.accessType === 'read')
      .map(p => p.recordType)
  );

  const grantedMetricKeys = SUPPORTED_METRICS
    .filter(m => grantedRecordTypes.has(m.recordType))
    .map(m => m.key);

  const sourceAppsSet = new Set(previousSnapshot?.source_apps || []);
  const syncErrors = {};
  const metricRecords = {};

  // Build task list for reading each granted metric with bounded concurrency
  const readTasks = SUPPORTED_METRICS
    .filter(m => grantedRecordTypes.has(m.recordType))
    .map(m => async () => {
      try {
        const records = await readRecordsPaginated(m.recordType, timeRangeFilter);
        metricRecords[m.key] = records;

        // Collect source apps
        for (const r of records) {
          const pkg = r.metadata?.dataOrigin || r.metadata?.clientRecordId;
          if (pkg && typeof pkg === 'string' && pkg.includes('.')) {
            sourceAppsSet.add(pkg);
          }
        }
      } catch (err) {
        console.warn(`[HealthConnect] Sync error for ${m.key}:`, err.message);
        syncErrors[m.key] = err.message || 'Read failed';
        // Preserve previous records if available
        if (previousSnapshot?.latest?.[m.key] != null) {
          metricRecords[m.key] = null; // Will fallback to previous
        }
      }
    });

  await runWithConcurrency(readTasks, 4);

  // Initialize 31 days (30 days ago through today)
  const daysMap = {};
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateInTimezone(d, timezone);
    daysMap[dateStr] = {
      date: dateStr,
      steps: null,
      active_calories: null,
      distance: null,
      floors_climbed: null,
      sleep_minutes: null,
      hydration_ml: null,
      avg_heart_rate: null,
      resting_heart_rate: null,
      blood_glucose: null,
      blood_pressure: null,
      oxygen_saturation: null,
      exercise_sessions: 0,
    };
  }

  const latest = { ...(previousSnapshot?.latest || {}) };

  // Process readings into daily summaries and latest readings
  for (const metric of SUPPORTED_METRICS) {
    const key = metric.key;
    const records = metricRecords[key];

    if (!records || !Array.isArray(records) || records.length === 0) {
      continue;
    }

    // Sort by startTime or time ascending
    records.sort((a, b) => {
      const tA = new Date(a.startTime || a.time || 0).getTime();
      const tB = new Date(b.startTime || b.time || 0).getTime();
      return tA - tB;
    });

    // Determine latest reading
    const lastRecord = records[records.length - 1];
    const normLast = normalizeValue(key, lastRecord);
    if (normLast !== null) {
      latest[key] = {
        value: normLast,
        unit: metric.unit,
        recorded_at: lastRecord.startTime || lastRecord.time || now.toISOString(),
        source: lastRecord.metadata?.dataOrigin || 'Health Connect',
      };
    }

    // Aggregate into daily buckets
    for (const r of records) {
      const recDate = new Date(r.startTime || r.time || 0);
      const dStr = formatDateInTimezone(recDate, timezone);
      const bucket = daysMap[dStr];
      if (!bucket) continue;

      const norm = normalizeValue(key, r);
      if (norm === null) continue;

      switch (key) {
        case 'steps':
          // Simple sum — correct when there is one source per day (Google Fit).
          // Multi-source deduplication is handled for TODAY by aggregateRecord() below.
          bucket.steps = (bucket.steps ?? 0) + norm;
          break;
        case 'active_calories':
          bucket.active_calories = (bucket.active_calories ?? 0) + norm;
          break;
        case 'distance':
          bucket.distance = (bucket.distance ?? 0) + norm;
          break;
        case 'floors_climbed':
          bucket.floors_climbed = (bucket.floors_climbed ?? 0) + norm;
          break;
        case 'sleep':
          bucket.sleep_minutes = (bucket.sleep_minutes ?? 0) + norm;
          break;
        case 'hydration':
          bucket.hydration_ml = (bucket.hydration_ml ?? 0) + norm;
          break;
        case 'heart_rate':
          bucket.avg_heart_rate = norm; // latest of day
          break;
        case 'resting_heart_rate':
          bucket.resting_heart_rate = norm;
          break;
        case 'blood_glucose':
          bucket.blood_glucose = norm;
          break;
        case 'blood_pressure':
          bucket.blood_pressure = norm;
          break;
        case 'oxygen_saturation':
          bucket.oxygen_saturation = norm;
          break;
        case 'exercise_sessions':
          bucket.exercise_sessions = (bucket.exercise_sessions ?? 0) + 1;
          break;
      }
    }
  }

  const todayBucket = daysMap[todayStr];

  // ── Native Aggregations for Today (total steps & active burn) ──
  // Use LOCAL midnight (setHours) so the window matches the user's day in their timezone.
  // UTC midnight truncation is WRONG for IST: it gives 05:30 AM IST as window start,
  // dropping all steps walked between midnight and 5:30 AM IST.
  const aggNow = new Date();
  const todayLocalStart = new Date(aggNow);
  todayLocalStart.setHours(0, 0, 0, 0); // device-local midnight (IST 00:00 for IST users)
  const todayRange = {
    operator: 'after',
    startTime: todayLocalStart.toISOString(),
  };

  if (HealthConnect?.aggregateRecord) {
    if (grantedRecordTypes.has('Steps')) {
      try {
        const aggRes = await withTimeout(
          HealthConnect.aggregateRecord({
            recordType: 'Steps',
            timeRangeFilter: todayRange,
          }),
          5000,
          'Aggregate steps for today'
        );
        let bestSteps = typeof aggRes?.COUNT_TOTAL === 'number' ? aggRes.COUNT_TOTAL : null;

        // Trust aggregateRecord exclusively — it is Health Connect's native deduplicated count
        // and will match what Google Fit displays. Do NOT override with manual per-record sums.
        if (todayBucket && bestSteps !== null) {
          todayBucket.steps = bestSteps;
        }
      } catch (err) {
        console.warn('[HealthConnect] aggregateRecord Steps error, fallback to bucket sum:', err.message);
      }
    }

    if (grantedRecordTypes.has('ActiveCaloriesBurned')) {
      try {
        const aggRes = await withTimeout(
          HealthConnect.aggregateRecord({
            recordType: 'ActiveCaloriesBurned',
            timeRangeFilter: todayRange,
          }),
          5000,
          'Aggregate active calories for today'
        );
        // Health Connect may return the energy under ACTIVE_CALORIES_TOTAL or ENERGY_TOTAL depending on version
        const energy = aggRes?.ACTIVE_CALORIES_TOTAL ?? aggRes?.ENERGY_TOTAL;
        let cals = null;
        if (typeof energy?.inKilocalories === 'number') {
          cals = Math.round(energy.inKilocalories);
        } else if (typeof energy?.inCalories === 'number') {
          cals = Math.round(energy.inCalories / 1000);
        } else if (typeof energy === 'number') {
          cals = Math.round(energy);
        }
        if (cals != null && cals > 0 && todayBucket) {
          todayBucket.active_calories = cals;
        } else if (todayBucket && todayBucket.active_calories == null) {
          // Aggregation returned nothing — fall back to bucket sum from the 30-day read
          const bucketSum = (metricRecords['active_calories'] || [])
            .filter(r => formatDateInTimezone(new Date(r.startTime || r.time || 0), timezone) === todayStr)
            .reduce((acc, r) => acc + (normalizeValue('active_calories', r) ?? 0), 0);
          if (bucketSum > 0) todayBucket.active_calories = bucketSum;
        }
      } catch (err) {
        console.warn('[HealthConnect] aggregateRecord ActiveCalories error, fallback to bucket sum:', err.message);
        // Explicit fallback: sum today's records already fetched in the 30-day read
        if (todayBucket && !todayBucket.active_calories) {
          const bucketSum = (metricRecords['active_calories'] || [])
            .filter(r => formatDateInTimezone(new Date(r.startTime || r.time || 0), timezone) === todayStr)
            .reduce((acc, r) => acc + (normalizeValue('active_calories', r) ?? 0), 0);
          if (bucketSum > 0) todayBucket.active_calories = bucketSum;
        }
      }
    }
    if (grantedRecordTypes.has('TotalCaloriesBurned')) {
      try {
        const aggRes = await withTimeout(
          HealthConnect.aggregateRecord({
            recordType: 'TotalCaloriesBurned',
            timeRangeFilter: todayRange,
          }),
          5000,
          'Aggregate total calories for today'
        );
        const energy = aggRes?.ENERGY_TOTAL;
        let cals = null;
        if (typeof energy?.inKilocalories === 'number') {
          cals = Math.round(energy.inKilocalories);
        } else if (typeof energy?.inCalories === 'number') {
          cals = Math.round(energy.inCalories / 1000);
        }
        if (cals != null && todayBucket) {
          todayBucket.total_calories = cals;
        }
      } catch (err) {
        console.warn('[HealthConnect] aggregateRecord TotalCalories error:', err.message);
      }
    }

    if (grantedRecordTypes.has('HeartRate')) {
      try {
        const aggRes = await withTimeout(
          HealthConnect.aggregateRecord({
            recordType: 'HeartRate',
            timeRangeFilter: todayRange,
          }),
          5000,
          'Aggregate heart rate for today'
        );
        if (typeof aggRes?.BPM_AVG === 'number' && aggRes.BPM_AVG > 0) {
          if (todayBucket) todayBucket.avg_heart_rate = Math.round(aggRes.BPM_AVG);
        }
      } catch (err) {
        console.warn('[HealthConnect] aggregateRecord HeartRate error:', err.message);
      }
    }

    if (grantedRecordTypes.has('RestingHeartRate')) {
      try {
        const aggRes = await withTimeout(
          HealthConnect.aggregateRecord({
            recordType: 'RestingHeartRate',
            timeRangeFilter: todayRange,
          }),
          5000,
          'Aggregate resting heart rate for today'
        );
        if (typeof aggRes?.BPM_AVG === 'number' && aggRes.BPM_AVG > 0) {
          if (todayBucket) todayBucket.resting_heart_rate = Math.round(aggRes.BPM_AVG);
        }
      } catch (err) {
        console.warn('[HealthConnect] aggregateRecord RestingHeartRate error:', err.message);
      }
    }

    if (grantedRecordTypes.has('SleepSession')) {
      try {
        const sleepStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const aggRes = await withTimeout(
          HealthConnect.aggregateRecord({
            recordType: 'SleepSession',
            timeRangeFilter: {
              operator: 'after',
              startTime: sleepStart.toISOString(),
            },
          }),
          5000,
          'Aggregate sleep session'
        );
        if (typeof aggRes?.SLEEP_DURATION_TOTAL === 'number' && aggRes.SLEEP_DURATION_TOTAL > 0) {
          const sleepMins = Math.round(aggRes.SLEEP_DURATION_TOTAL / 60);
          if (todayBucket) todayBucket.sleep_minutes = sleepMins;
        }
      } catch (err) {
        console.warn('[HealthConnect] aggregateRecord SleepSession error:', err.message);
      }
    }
  }

  const todayTotals = {
    steps: todayBucket?.steps ?? 0,
    active_calories: todayBucket?.active_calories ?? 0,
    total_calories: todayBucket?.total_calories ?? null,
    distance: todayBucket?.distance ?? 0,
    sleep_minutes: todayBucket?.sleep_minutes ?? latest.sleep?.value ?? 0,
    avg_heart_rate: todayBucket?.avg_heart_rate ?? latest.heart_rate?.value ?? null,
    resting_heart_rate: todayBucket?.resting_heart_rate ?? latest.resting_heart_rate?.value ?? null,
  };

  const daily_summaries = Object.values(daysMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    timezone,
    granted_metrics: grantedMetricKeys,
    source_apps: Array.from(sourceAppsSet),
    latest,
    today: todayTotals,
    daily_summaries,
    history_refreshed_on: todayStr,
    sync_errors: syncErrors,
  };
}
