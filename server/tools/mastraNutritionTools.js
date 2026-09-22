'use strict';

const { createTool } = require('@mastra/core/tools');
const { z } = require('zod');
const User = require('../models/User');
const MealLog = require('../models/MealLog');
const HealthConnectSnapshot = require('../models/HealthConnectSnapshot');
const { decryptData } = require('../utils/cryptoUtil');

// ── Health score formula — mirrors dietRoutes.js exactly ──────────────────────
function computeHealthScore(consumed, targets, mealCount) {
  if (!targets) return 0;
  if (mealCount === 0) return 0;
  const calR = Math.min(consumed.calories / targets.calories, 1);
  const protR = Math.min(consumed.protein / targets.protein, 1);
  const fibR  = Math.min(consumed.fiber / targets.fiber, 1);
  const sugP  = consumed.sugar  > targets.sugar  ? 0.8 : 1;
  const sodP  = consumed.sodium > targets.sodium  ? 0.8 : 1;
  return Math.min(Math.round(((calR * 0.3 + protR * 0.25 + fibR * 0.15 + 0.3) * sugP * sodP) * 100), 100);
}

// ── Nutri-Score estimator helper ───────────────────────────────────────────────
function estimateNutriScore(calories, protein, sugar, sodium, fiber) {
  let score = 0;
  // Positive factors (penalties)
  if (calories > 500) score += 4;
  else if (calories > 300) score += 2;

  if (sugar > 15) score += 4;
  else if (sugar > 8) score += 2;

  if (sodium > 800) score += 4;
  else if (sodium > 400) score += 2;

  // Negative factors (benefits)
  if (protein > 20) score -= 3;
  else if (protein > 10) score -= 2;

  if (fiber > 5) score -= 3;
  else if (fiber > 2) score -= 1;

  if (score <= 0) return 'A';
  if (score <= 3) return 'B';
  if (score <= 6) return 'C';
  if (score <= 9) return 'D';
  return 'E';
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function getDayRange(timezoneOffset, specificDateStr) {
  const defaultOffset = process.env.DEFAULT_TIMEZONE_OFFSET !== undefined
    ? Number(process.env.DEFAULT_TIMEZONE_OFFSET)
    : -330;
  const parsedOffset = Number(timezoneOffset);
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : defaultOffset;

  let year, month, date, clientTimeMs;
  if (specificDateStr && /^\d{4}-\d{2}-\d{2}$/.test(specificDateStr)) {
    const parts = specificDateStr.split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1;
    date = parts[2];
    clientTimeMs = Date.UTC(year, month, date, 12, 0, 0);
  } else {
    const now = new Date();
    clientTimeMs = now.getTime() - (offset * 60 * 1000);
    const clientDate = new Date(clientTimeMs);
    year = clientDate.getUTCFullYear();
    month = clientDate.getUTCMonth();
    date = clientDate.getUTCDate();
  }

  const startOfDayMs = Date.UTC(year, month, date, 0, 0, 0, 0) + (offset * 60 * 1000);
  const start = new Date(startOfDayMs);
  const end = new Date(startOfDayMs + 24 * 60 * 60 * 1000);
  return { start, end, clientTimeMs, startOfDayMs, offset };
}

function sumMeals(meals) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein:  acc.protein  + (m.protein  || 0),
      carbs:    acc.carbs    + (m.carbs    || 0),
      fat:      acc.fat      + (m.fat      || 0),
      fiber:    acc.fiber    + (m.fiber    || 0),
      sugar:    acc.sugar    + (m.sugar    || 0),
      sodium:   acc.sodium   + (m.sodium   || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
  );
}

/**
 * Factory creating Mastra tools with user context closed in
 * @param {string} userId - MongoDB ObjectId of authenticated user
 * @returns {Object} Mastra tool dictionary keyed by tool ID
 */
function makeMastraNutritionTools(userId, timezoneOffset = -330) {

  // 1. logMeal - Agentic tool to add meals directly from chat
  const logMeal = createTool({
    id: 'logMeal',
    description: 'Logs and saves a meal directly into the user\'s diet log in MongoDB. ALWAYS call this when the user asks to log, track, record, or add food/drinks they consumed.',
    inputSchema: z.object({
      name: z.string().describe('Descriptive name of the food or dish (e.g. "Oatmeal with blueberries & almonds", "Grilled chicken salad")'),
      mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('snack').describe('Meal category: breakfast, lunch, dinner, or snack'),
      calories: z.number().describe('Estimated total energy in kilocalories (kcal)'),
      protein: z.number().describe('Estimated protein content in grams (g)'),
      carbs: z.number().describe('Estimated carbohydrates in grams (g)'),
      fat: z.number().describe('Estimated fat in grams (g)'),
      fiber: z.number().optional().describe('Estimated dietary fiber in grams (g)'),
      sugar: z.number().optional().describe('Estimated sugar in grams (g)'),
      sodium: z.number().optional().describe('Estimated sodium in milligrams (mg)'),
      nutriScore: z.enum(['A', 'B', 'C', 'D', 'E']).optional().describe('Nutritional quality grade: A (healthiest) to E (least healthy)'),
      ingredients: z.array(z.string()).optional().describe('List of key ingredients in the meal'),
    }),
    execute: async (input) => {
      try {
        const cal = Math.max(0, Math.round(Number(input.calories) || 0));
        const prot = Math.max(0, Math.round(Number(input.protein) || 0));
        const carb = Math.max(0, Math.round(Number(input.carbs) || 0));
        const fatVal = Math.max(0, Math.round(Number(input.fat) || 0));
        const fib = Math.max(0, Math.round(Number(input.fiber) || 0));
        const sug = Math.max(0, Math.round(Number(input.sugar) || 0));
        const sod = Math.max(0, Math.round(Number(input.sodium) || 0));
        const grade = input.nutriScore || estimateNutriScore(cal, prot, sug, sod, fib);

        const mealLog = new MealLog({
          userId,
          name: input.name.trim(),
          mealType: input.mealType || 'snack',
          calories: cal,
          protein: prot,
          carbs: carb,
          fat: fatVal,
          fiber: fib,
          sugar: sug,
          sodium: sod,
          nutriScore: grade,
          ingredients: Array.isArray(input.ingredients) ? input.ingredients : [],
          loggedAt: new Date(),
        });

        await mealLog.save();

        // Calculate updated daily totals
        const user = await User.findById(userId).select('dailyTargets').lean();
        const targets = user?.dailyTargets || { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };

        const { start, end } = getDayRange(timezoneOffset);
        const todaysMeals = await MealLog.find({ userId, loggedAt: { $gte: start, $lt: end } }).lean();
        const consumed = sumMeals(todaysMeals);
        const healthScore = computeHealthScore(consumed, targets, todaysMeals.length);

        return {
          success: true,
          message: `Successfully logged "${mealLog.name}" to your ${mealLog.mealType}!`,
          loggedMeal: {
            id: mealLog._id.toString(),
            name: mealLog.name,
            mealType: mealLog.mealType,
            calories: mealLog.calories,
            protein: mealLog.protein,
            carbs: mealLog.carbs,
            fat: mealLog.fat,
            fiber: mealLog.fiber,
            nutriScore: mealLog.nutriScore,
            loggedAt: mealLog.loggedAt,
          },
          todayTotals: {
            consumed,
            remainingCalories: Math.max(0, targets.calories - consumed.calories),
            remainingProtein: Math.max(0, targets.protein - consumed.protein),
            updatedHealthScore: healthScore,
            mealCountToday: todaysMeals.length,
          },
        };
      } catch (err) {
        console.error('[Mastra Tool: logMeal] Error saving meal:', err);
        return { success: false, error: 'Failed to log meal: ' + err.message };
      }
    },
  });

  // 2. getUserProfile
  const getUserProfile = createTool({
    id: 'getUserProfile',
    description: 'Returns the user\'s personal profile including name, age, weight (kg), height (cm), gender, fitness goal, and activity level.',
    inputSchema: z.object({}),
    execute: async () => {
      const user = await User.findById(userId).select('name email profile').lean();
      if (!user) return { error: 'User not found.' };
      return {
        name: user.name,
        email: user.email,
        age: user.profile?.age,
        weight_kg: user.profile?.weight,
        height_cm: user.profile?.height,
        gender: user.profile?.gender,
        goal: user.profile?.goal,
        activityLevel: user.profile?.activityLevel,
      };
    },
  });

  // 3. getUserTargets
  const getUserTargets = createTool({
    id: 'getUserTargets',
    description: 'Returns the user\'s personalized daily nutrition targets: calories, protein, carbs, fat, fiber, sugar, sodium.',
    inputSchema: z.object({}),
    execute: async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      if (!user) return { error: 'User not found.' };
      return user.dailyTargets || { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };
    },
  });

  // 4. getTodaySummary
  const getTodaySummary = createTool({
    id: 'getTodaySummary',
    description: 'Returns today\'s complete nutrition summary: meals logged, consumed calories and macros, remaining allowances, and current NuFi health score.',
    inputSchema: z.object({}),
    execute: async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      const targets = user?.dailyTargets || { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };
      const { start, end, clientTimeMs } = getDayRange(timezoneOffset);
      const meals = await MealLog.find({ userId, loggedAt: { $gte: start, $lt: end } })
        .select('name mealType calories protein carbs fat fiber sugar sodium nutriScore loggedAt')
        .sort({ loggedAt: -1 })
        .lean();

      const consumed = sumMeals(meals);
      const score = computeHealthScore(consumed, targets, meals.length);

      return {
        date: new Date(clientTimeMs).toDateString(),
        healthScore: score,
        mealCount: meals.length,
        consumed,
        targets,
        remaining: {
          calories: Math.max(0, targets.calories - consumed.calories),
          protein:  Math.max(0, targets.protein  - consumed.protein),
          carbs:    Math.max(0, targets.carbs    - consumed.carbs),
          fat:      Math.max(0, targets.fat      - consumed.fat),
        },
        meals: meals.map(m => ({
          name: m.name,
          mealType: m.mealType,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          nutriScore: m.nutriScore,
          time: new Date(m.loggedAt).toLocaleTimeString(),
        })),
      };
    },
  });

  // 5. getRecentMeals
  const getRecentMeals = createTool({
    id: 'getRecentMeals',
    description: 'Returns the user\'s most recently logged meals across all dates (up to 15 meals).',
    inputSchema: z.object({
      limit: z.number().optional().default(10).describe('Max number of meals to return (default 10)'),
    }),
    execute: async ({ limit = 10 }) => {
      const n = Math.min(limit, 20);
      const meals = await MealLog.find({ userId })
        .select('name mealType calories protein carbs fat fiber sugar sodium nutriScore ingredients loggedAt')
        .sort({ loggedAt: -1 })
        .limit(n)
        .lean();

      return meals.map(m => ({
        name: m.name,
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiber: m.fiber,
        nutriScore: m.nutriScore,
        ingredients: m.ingredients,
        date: new Date(m.loggedAt).toLocaleDateString(),
        time: new Date(m.loggedAt).toLocaleTimeString(),
      }));
    },
  });

  // 6. getMealHistory
  const getMealHistory = createTool({
    id: 'getMealHistory',
    description: 'Returns meals logged on a specific date (YYYY-MM-DD) plus daily totals. Defaults to today if omitted.',
    inputSchema: z.object({
      date: z.string().optional().describe('Date in YYYY-MM-DD format (e.g. "2026-09-15")'),
    }),
    execute: async ({ date }) => {
      const { start, end } = getDayRange(timezoneOffset, date);
      if (isNaN(start.getTime())) return { error: 'Invalid date format. Use YYYY-MM-DD.' };

      const meals = await MealLog.find({ userId, loggedAt: { $gte: start, $lt: end } })
        .select('name mealType calories protein carbs fat fiber sugar sodium nutriScore ingredients loggedAt')
        .sort({ loggedAt: -1 })
        .lean();

      const consumed = sumMeals(meals);
      return {
        date: start.toDateString(),
        mealCount: meals.length,
        consumed,
        meals: meals.map(m => ({
          name: m.name,
          mealType: m.mealType,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          nutriScore: m.nutriScore,
          time: new Date(m.loggedAt).toLocaleTimeString(),
        })),
      };
    },
  });

  // 7. getWeeklyProgress
  const getWeeklyProgress = createTool({
    id: 'getWeeklyProgress',
    description: 'Returns the user\'s weekly nutrition progress day by day (Monday to Sunday) including health scores and calorie totals.',
    inputSchema: z.object({}),
    execute: async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      const targets = user?.dailyTargets || { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };

      const { startOfDayMs, clientTimeMs } = getDayRange(timezoneOffset);
      const dayOfWeek = (new Date(clientTimeMs).getUTCDay() + 6) % 7;
      const mondayStartMs = startOfDayMs - (dayOfWeek * 24 * 60 * 60 * 1000);
      const monday = new Date(mondayStartMs);
      const sundayEndMs = mondayStartMs + (7 * 24 * 60 * 60 * 1000) - 1;
      const sunday = new Date(sundayEndMs);

      const weekMeals = await MealLog.find({
        userId,
        loggedAt: { $gte: new Date(mondayStartMs), $lte: new Date(sundayEndMs) },
      }).select('calories protein fiber sugar sodium loggedAt').lean();

      const DAYS = ['Mon' , 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const days = DAYS.map((label, i) => {
        const dayStart = new Date(mondayStartMs + i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(mondayStartMs + (i + 1) * 24 * 60 * 60 * 1000);
        const dMeals = weekMeals.filter(m => {
          const d = new Date(m.loggedAt);
          return d >= dayStart && d < dayEnd;
        });
        const c = sumMeals(dMeals);
        const score = dMeals.length > 0 ? computeHealthScore(c, targets, dMeals.length) : null;
        return {
          day: label,
          date: dayStart.toLocaleDateString(),
          isPast: i <= dayOfWeek,
          mealCount: dMeals.length,
          calories: c.calories,
          healthScore: score,
        };
      });

      return { weekStarting: monday.toDateString(), days };
    },
  });

  // 8. getHealthScoreBreakdown
  const getHealthScoreBreakdown = createTool({
    id: 'getHealthScoreBreakdown',
    description: 'Returns a detailed breakdown of how today\'s NuFi Health Score (0-100) was computed with exact formula and penalty details.',
    inputSchema: z.object({}),
    execute: async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      const targets = user?.dailyTargets || { calories: 2000, protein: 120, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };
      const { start, end, clientTimeMs } = getDayRange(timezoneOffset);
      const meals = await MealLog.find({ userId, loggedAt: { $gte: start, $lt: end } })
        .select('calories protein fiber sugar sodium')
        .lean();

      const c = sumMeals(meals);
      const calR = Math.min(c.calories / targets.calories, 1);
      const protR = Math.min(c.protein / targets.protein, 1);
      const fibR = Math.min(c.fiber / targets.fiber, 1);
      const sugP = c.sugar > targets.sugar ? 0.8 : 1;
      const sodP = c.sodium > targets.sodium ? 0.8 : 1;
      const rawScore = (calR * 0.3 + protR * 0.25 + fibR * 0.15 + 0.3) * sugP * sodP * 100;

      return {
        formula: 'Health Score = (calRatio×0.3 + proteinRatio×0.25 + fiberRatio×0.15 + 0.3_base) × sugarPenalty × sodiumPenalty × 100',
        components: {
          calories: `${c.calories} / ${targets.calories} (${(calR * 100).toFixed(1)}%)`,
          protein: `${c.protein}g / ${targets.protein}g (${(protR * 100).toFixed(1)}%)`,
          fiber: `${c.fiber}g / ${targets.fiber}g (${(fibR * 100).toFixed(1)}%)`,
          sugarPenalty: c.sugar > targets.sugar ? 'Applied (20% penalty)' : 'None',
          sodiumPenalty: c.sodium > targets.sodium ? 'Applied (20% penalty)' : 'None',
        },
        currentScore: Math.min(Math.round(rawScore), 100),
        mealCount: meals.length,
      };
    },
  });

  // ── 9. Get Health Connect Summary (Safe biometric sensor access) ─────────────
  const getHealthConnectSummary = createTool({
    id: 'getHealthConnectSummary',
    description: 'Retrieves verified biometric data from Google Health Connect (e.g. daily steps, resting heart rate, active calories burned, sleep duration, blood pressure). Only use this when the user asks about their activity, steps, workouts, heart rate, or health sensor metrics. Never make clinical medical diagnoses.',
    inputSchema: z.object({}),
    execute: async () => {
      const doc = await HealthConnectSnapshot.findOne({ userId }).lean();

      // Guardrail 1: Must exist and have explicit active consent
      if (!doc || !doc.connected || !doc.sync_enabled || !doc.assistant_access_enabled) {
        return {
          accessible: false,
          reason: 'Google Health Connect is either disconnected or the user has disabled AI assistant access in settings.',
        };
      }

      // Guardrail 2: Freshness check — Reject if older than 30 days
      const syncedDate = new Date(doc.synced_at || 0);
      const ageHours = (Date.now() - syncedDate.getTime()) / (1000 * 60 * 60);
      if (ageHours > 24 * 30) {
        return {
          accessible: false,
          reason: 'Health Connect snapshot is older than 30 days and has expired.',
        };
      }

      // Decrypt latest and daily summaries
      let latest = {};
      let daily = [];
      try {
        if (doc.encrypted_latest && doc.iv && doc.auth_tag) {
          latest = decryptData(doc.encrypted_latest, doc.iv, doc.auth_tag) || {};
        }
        // Use dedicated daily_iv/daily_auth_tag (new envelope); fallback to shared iv/auth_tag for legacy docs
        if (doc.encrypted_daily_summaries) {
          const dailyIv = doc.daily_iv || doc.iv;
          const dailyAuthTag = doc.daily_auth_tag || doc.auth_tag;
          if (dailyIv && dailyAuthTag) {
            daily = decryptData(doc.encrypted_daily_summaries, dailyIv, dailyAuthTag) || [];
          }
        }
      } catch (err) {
        return {
          accessible: false,
          reason: 'Biometric decryption failed on server.',
        };
      }

      // Find today's daily summary — compute date in the USER's local timezone, not server UTC.
      // timezoneOffset is minutes-west (negative = east, e.g. IST = -330).
      // ── Resolve today's date — mirrors DietDashboardScreen.jsx exactly ────────
      // Dashboard uses new Date() on device, formatted as YYYY-MM-DD local time.
      // On server we replicate by shifting by timezoneOffset (minutes-west, IST = -330).
      const clientNow    = new Date(Date.now() - (timezoneOffset * 60 * 1000));
      const todayDateStr = clientNow.toISOString().slice(0, 10);

      // Dashboard fallback: if today not found, use last entry (most recent day with data)
      const todaySummary = daily.find(d => d.date === todayDateStr)
        || (daily.length > 0 ? daily[daily.length - 1] : null);

      // ── Resolve each metric with same fallback chain as dashboard ─────────────

      // Steps
      const stepsVal = (typeof todaySummary?.steps === 'number' && todaySummary.steps > 0)
        ? todaySummary.steps
        : (typeof latest?.steps?.value === 'number' ? latest.steps.value : null);

      // Active calories from HC sensor
      const activeCalsHC = (todaySummary?.active_calories != null && todaySummary.active_calories > 0)
        ? todaySummary.active_calories
        : (typeof latest?.active_calories?.value === 'number' ? latest.active_calories.value : null);

      // Fallback: estimate active burn from steps (dashboard uses steps * 0.04)
      const activeCaloriesFromSteps = stepsVal ? Math.round(stepsVal * 0.04) : 0;
      const activeBurn = activeCalsHC != null ? activeCalsHC : activeCaloriesFromSteps;

      // Total calories burned: prefer HC total_calories, then compute BMR + active burn
      // (mirrors dashboard: bmrBurnedSoFar + activeBurn)
      let totalCaloriesBurned = null;
      if (typeof todaySummary?.total_calories === 'number' && todaySummary.total_calories > 0) {
        totalCaloriesBurned = todaySummary.total_calories;
      } else {
        const userDoc  = await User.findById(userId).select('profile').lean();
        const weight   = Number(userDoc?.profile?.weight) || 75;
        const height   = Number(userDoc?.profile?.height) || 170;
        const age      = Number(userDoc?.profile?.age)    || 22;
        const dailyBMR = Math.round((10 * weight) + (6.25 * height) - (5 * age) + 5);
        const hoursElapsed   = clientNow.getUTCHours() + (clientNow.getUTCMinutes() / 60);
        const bmrBurnedSoFar = Math.round(dailyBMR * (hoursElapsed / 24));
        totalCaloriesBurned  = bmrBurnedSoFar + activeBurn;
      }

      // Heart rate
      const hrVal = (todaySummary?.avg_heart_rate > 0 ? todaySummary.avg_heart_rate : null)
        ?? (todaySummary?.resting_heart_rate > 0 ? todaySummary.resting_heart_rate : null)
        ?? (latest?.heart_rate?.value > 0 ? Math.round(latest.heart_rate.value) : null)
        ?? (latest?.resting_heart_rate?.value > 0 ? Math.round(latest.resting_heart_rate.value) : null);

      // Sleep — dashboard checks today, then walks back through daily, then latest.sleep
      let sleepMinutes = null;
      if (todaySummary?.sleep_minutes > 0) {
        sleepMinutes = todaySummary.sleep_minutes;
      } else if (latest?.sleep?.value > 0) {
        sleepMinutes = latest.sleep.value;
      } else if (Array.isArray(daily)) {
        for (let i = daily.length - 1; i >= 0; i--) {
          if (daily[i]?.sleep_minutes > 0) { sleepMinutes = daily[i].sleep_minutes; break; }
        }
      }
      const sleepFormatted = sleepMinutes
        ? (() => { const h = Math.floor(sleepMinutes / 60); const m = Math.round(sleepMinutes % 60); return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`; })()
        : null;

      return {
        accessible: true,
        stale: ageHours > 24,
        synced_at: doc.synced_at,
        source_apps: doc.source_apps,
        granted_metrics: doc.granted_metrics,
        today: {
          date:                   todaySummary?.date || todayDateStr,
          steps:                  stepsVal,
          active_calories_burned: activeBurn,
          total_calories_burned:  totalCaloriesBurned,
          avg_heart_rate_bpm:     hrVal,
          sleep_minutes:          sleepMinutes,
          sleep_formatted:        sleepFormatted,
          distance_m:             todaySummary?.distance          ?? null,
          floors_climbed:         todaySummary?.floors_climbed    ?? null,
          blood_pressure:         todaySummary?.blood_pressure    ?? latest?.blood_pressure?.value   ?? null,
          blood_glucose:          todaySummary?.blood_glucose     ?? latest?.blood_glucose?.value    ?? null,
          oxygen_saturation:      todaySummary?.oxygen_saturation ?? latest?.oxygen_saturation?.value ?? null,
        },
        latest_readings: latest,
        disclaimer: 'Informational wellness data from connected sensors only. Never provide a clinical medical diagnosis.',
      };
    },
  });

  return {
    logMeal,
    getUserProfile,
    getUserTargets,
    getTodaySummary,
    getRecentMeals,
    getMealHistory,
    getWeeklyProgress,
    getHealthScoreBreakdown,
    getHealthConnectSummary,
  };
}

module.exports = { makeMastraNutritionTools, computeHealthScore };

