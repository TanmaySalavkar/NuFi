'use strict';

const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const User = require('../models/User');
const MealLog = require('../models/MealLog');

// ── Health score formula — mirrors dietRoutes.js exactly ──────────────────────
function computeHealthScore(consumed, targets, mealCount) {
  if (mealCount === 0) return 0;
  const calR = Math.min(consumed.calories / targets.calories, 1);
  const protR = Math.min(consumed.protein / targets.protein, 1);
  const fibR  = Math.min(consumed.fiber / targets.fiber, 1);
  const sugP  = consumed.sugar  > targets.sugar  ? 0.8 : 1;
  const sodP  = consumed.sodium > targets.sodium  ? 0.8 : 1;
  return Math.min(Math.round(((calR * 0.3 + protR * 0.25 + fibR * 0.15 + 0.3) * sugP * sodP) * 100), 100);
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
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

// ── Tool factory — userId is closed in from the verified JWT, never from client ─
function makeNutritionTools(userId) {

  // 1. getUserProfile
  const getUserProfile = tool(
    async () => {
      const user = await User.findById(userId).select('name email profile').lean();
      if (!user) return 'User not found.';
      return JSON.stringify({
        name:          user.name,
        email:         user.email,
        age:           user.profile.age,
        weight_kg:     user.profile.weight,
        height_cm:     user.profile.height,
        gender:        user.profile.gender,
        goal:          user.profile.goal,
        activityLevel: user.profile.activityLevel,
      });
    },
    {
      name: 'getUserProfile',
      description: 'Returns the user\'s personal profile including name, age, weight, height, gender, fitness goal (lose/maintain/gain), and activity level.',
      schema: z.object({}),
    }
  );

  // 2. getUserTargets
  const getUserTargets = tool(
    async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      if (!user) return 'User not found.';
      return JSON.stringify(user.dailyTargets);
    },
    {
      name: 'getUserTargets',
      description: 'Returns the user\'s personalized daily nutrition targets: calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), sodium (mg). These are computed from their profile using the Mifflin-St Jeor formula.',
      schema: z.object({}),
    }
  );

  // 3. getTodaySummary
  const getTodaySummary = tool(
    async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      if (!user) return 'User not found.';
      const { start, end } = todayRange();
      const meals = await MealLog.find({ userId, loggedAt: { $gte: start, $lt: end } })
        .select('name mealType calories protein carbs fat fiber sugar sodium nutriScore loggedAt')
        .sort({ loggedAt: -1 })
        .lean();
      const consumed = sumMeals(meals);
      const score    = computeHealthScore(consumed, user.dailyTargets, meals.length);
      return JSON.stringify({
        date:        new Date().toDateString(),
        healthScore: score,
        mealCount:   meals.length,
        consumed,
        targets:     user.dailyTargets,
        remaining: {
          calories: Math.max(0, user.dailyTargets.calories - consumed.calories),
          protein:  Math.max(0, user.dailyTargets.protein  - consumed.protein),
          carbs:    Math.max(0, user.dailyTargets.carbs    - consumed.carbs),
          fat:      Math.max(0, user.dailyTargets.fat      - consumed.fat),
        },
        meals: meals.map(m => ({
          name:      m.name,
          mealType:  m.mealType,
          calories:  m.calories,
          protein:   m.protein,
          carbs:     m.carbs,
          fat:       m.fat,
          nutriScore: m.nutriScore,
          time:      new Date(m.loggedAt).toLocaleTimeString(),
        })),
      });
    },
    {
      name: 'getTodaySummary',
      description: 'Returns today\'s full nutrition summary: health score, meals logged, consumed totals, targets, and remaining allowances for calories/macros.',
      schema: z.object({}),
    }
  );

  // 4. getRecentMeals
  const getRecentMeals = tool(
    async ({ limit }) => {
      const n = Math.min(limit || 10, 20);
      const meals = await MealLog.find({ userId })
        .select('name mealType calories protein carbs fat fiber sugar sodium nutriScore ingredients loggedAt')
        .sort({ loggedAt: -1 })
        .limit(n)
        .lean();
      return JSON.stringify(
        meals.map(m => ({
          name:        m.name,
          mealType:    m.mealType,
          calories:    m.calories,
          protein:     m.protein,
          carbs:       m.carbs,
          fat:         m.fat,
          fiber:       m.fiber,
          sugar:       m.sugar,
          sodium:      m.sodium,
          nutriScore:  m.nutriScore,
          ingredients: m.ingredients,
          date:        new Date(m.loggedAt).toLocaleDateString(),
          time:        new Date(m.loggedAt).toLocaleTimeString(),
        }))
      );
    },
    {
      name: 'getRecentMeals',
      description: 'Returns the user\'s most recently logged meals (default 10, max 20) across all dates, newest first.',
      schema: z.object({
        limit: z.number().optional().describe('Number of meals to return (default 10, max 20)'),
      }),
    }
  );

  // 5. getMealHistory
  const getMealHistory = tool(
    async ({ date }) => {
      let start, end;
      if (date) {
        start = new Date(date);
        end   = new Date(date);
        end.setDate(end.getDate() + 1);
      } else {
        ({ start, end } = todayRange());
      }
      if (isNaN(start.getTime())) return 'Invalid date format. Use YYYY-MM-DD.';
      const meals = await MealLog.find({ userId, loggedAt: { $gte: start, $lt: end } })
        .select('name mealType calories protein carbs fat fiber sugar sodium nutriScore ingredients loggedAt')
        .sort({ loggedAt: -1 })
        .lean();
      const consumed = sumMeals(meals);
      return JSON.stringify({
        date:      start.toDateString(),
        mealCount: meals.length,
        consumed,
        meals: meals.map(m => ({
          name:        m.name,
          mealType:    m.mealType,
          calories:    m.calories,
          protein:     m.protein,
          carbs:       m.carbs,
          fat:         m.fat,
          nutriScore:  m.nutriScore,
          ingredients: m.ingredients,
          time:        new Date(m.loggedAt).toLocaleTimeString(),
        })),
      });
    },
    {
      name: 'getMealHistory',
      description: 'Returns all meals logged on a specific date plus daily totals. If no date is provided, returns today\'s meals.',
      schema: z.object({
        date: z.string().optional().describe('Date in YYYY-MM-DD format (e.g. "2026-09-14"). Defaults to today if omitted.'),
      }),
    }
  );

  // 6. getWeeklyProgress
  const getWeeklyProgress = tool(
    async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      if (!user) return 'User not found.';
      const now = new Date();
      const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const weekMeals = await MealLog.find({
        userId,
        loggedAt: { $gte: monday, $lte: sunday },
      }).select('calories protein fiber sugar sodium loggedAt').lean();

      const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const days = DAYS.map((label, i) => {
        const dayStart = new Date(monday);
        dayStart.setDate(monday.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const dMeals = weekMeals.filter(m => {
          const d = new Date(m.loggedAt);
          return d >= dayStart && d <= dayEnd;
        });
        const c = dMeals.reduce((acc, m) => ({
          calories: acc.calories + (m.calories || 0),
          protein:  acc.protein  + (m.protein  || 0),
          fiber:    acc.fiber    + (m.fiber    || 0),
          sugar:    acc.sugar    + (m.sugar    || 0),
          sodium:   acc.sodium   + (m.sodium   || 0),
        }), { calories: 0, protein: 0, fiber: 0, sugar: 0, sodium: 0 });
        const score = dMeals.length > 0
          ? computeHealthScore(c, user.dailyTargets, dMeals.length)
          : null;
        return {
          day:        label,
          date:       dayStart.toLocaleDateString(),
          isPast:     i <= dayOfWeek,
          mealCount:  dMeals.length,
          calories:   c.calories,
          healthScore: score,
        };
      });

      return JSON.stringify({ weekStarting: monday.toDateString(), days });
    },
    {
      name: 'getWeeklyProgress',
      description: 'Returns the user\'s nutrition progress for each day of the current week (Mon–Sun): health score, calorie total, and meal count per day.',
      schema: z.object({}),
    }
  );

  // 7. getHealthScoreBreakdown
  const getHealthScoreBreakdown = tool(
    async () => {
      const user = await User.findById(userId).select('dailyTargets').lean();
      if (!user) return 'User not found.';
      const { start, end } = todayRange();
      const meals = await MealLog.find({ userId, loggedAt: { $gte: start, $lt: end } })
        .select('calories protein fiber sugar sodium')
        .lean();
      const t = user.dailyTargets;
      const c = sumMeals(meals);
      const calR  = Math.min(c.calories / t.calories, 1);
      const protR = Math.min(c.protein  / t.protein,  1);
      const fibR  = Math.min(c.fiber    / t.fiber,    1);
      const sugP  = c.sugar  > t.sugar  ? 0.8 : 1;
      const sodP  = c.sodium > t.sodium ? 0.8 : 1;
      const rawScore = (calR * 0.3 + protR * 0.25 + fibR * 0.15 + 0.3) * sugP * sodP * 100;
      return JSON.stringify({
        explanation: 'NuFi Health Score (0-100) = (calRatio×0.3 + proteinRatio×0.25 + fiberRatio×0.15 + 0.3_base) × sugarPenalty × sodiumPenalty × 100',
        formula_components: {
          calorie_ratio:    `${c.calories} / ${t.calories} = ${calR.toFixed(3)} (weight: 30%)`,
          protein_ratio:    `${c.protein}g / ${t.protein}g = ${protR.toFixed(3)} (weight: 25%)`,
          fiber_ratio:      `${c.fiber}g / ${t.fiber}g = ${fibR.toFixed(3)} (weight: 15%)`,
          base_score:       '0.30 (30% base — rewards any eating at all)',
          sugar_penalty:    c.sugar > t.sugar   ? `×0.8 APPLIED (${c.sugar}g > target ${t.sugar}g)` : `×1.0 (${c.sugar}g ≤ target ${t.sugar}g)`,
          sodium_penalty:   c.sodium > t.sodium ? `×0.8 APPLIED (${c.sodium}mg > target ${t.sodium}mg)` : `×1.0 (${c.sodium}mg ≤ target ${t.sodium}mg)`,
        },
        today: {
          raw_score:        Math.round(rawScore),
          final_score:      Math.min(Math.round(rawScore), 100),
          meals_logged:     meals.length,
          consumed:         c,
          targets:          t,
        },
      });
    },
    {
      name: 'getHealthScoreBreakdown',
      description: 'Returns a detailed breakdown of how today\'s NuFi Health Score was calculated, including each component\'s contribution and any active penalties.',
      schema: z.object({}),
    }
  );

  return [
    getUserProfile,
    getUserTargets,
    getTodaySummary,
    getRecentMeals,
    getMealHistory,
    getWeeklyProgress,
    getHealthScoreBreakdown,
  ];
}

module.exports = { makeNutritionTools };
