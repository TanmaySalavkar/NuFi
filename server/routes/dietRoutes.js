const express = require('express');
const User = require('../models/User');
const MealLog = require('../models/MealLog');
const authMiddleware = require('../middleware/authMiddleware');
const { analyzeFoodImage } = require('../services/aiService');

const router = express.Router();

// All diet routes require authentication
router.use(authMiddleware);

/**
 * GET /api/diet/dashboard
 * Returns user's daily targets, today's consumed totals, meals, habits, and health score
 */
router.get('/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Get today's date range (start of day to end of day)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Fetch today's meal logs
    const todaysMeals = await MealLog.find({
      userId: req.user.id,
      loggedAt: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ loggedAt: -1 });

    // Calculate consumed totals
    const consumed = todaysMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fat: acc.fat + (meal.fat || 0),
        fiber: acc.fiber + (meal.fiber || 0),
        sugar: acc.sugar + (meal.sugar || 0),
        sodium: acc.sodium + (meal.sodium || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
    );

    if (!user.dailyTargets) {
      user.dailyTargets = { calories: 2000, protein: 115, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };
      await user.save();
    }

    const targets = user.dailyTargets;
    const calorieRatio = Math.min(consumed.calories / targets.calories, 1);
    const proteinRatio = Math.min(consumed.protein / targets.protein, 1);
    const fiberRatio = Math.min(consumed.fiber / targets.fiber, 1);

    // Penalize going over sugar and sodium limits
    const sugarPenalty = consumed.sugar > targets.sugar ? 0.8 : 1;
    const sodiumPenalty = consumed.sodium > targets.sodium ? 0.8 : 1;

    const healthScore = todaysMeals.length === 0 ? 0 : Math.round(
      ((calorieRatio * 0.3 + proteinRatio * 0.25 + fiberRatio * 0.15 + 0.3) *
        sugarPenalty *
        sodiumPenalty) *
        100
    );

    // Calculate week scores for Mon..Sun
    const now = new Date();
    const currentDayOfWeek = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekMeals = await MealLog.find({
      userId: req.user.id,
      loggedAt: { $gte: monday, $lte: sunday },
    });

    const weekScores = [null, null, null, null, null, null, null];
    for (let day = 0; day <= currentDayOfWeek; day++) {
      const dayStart = new Date(monday);
      dayStart.setDate(monday.getDate() + day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dMeals = weekMeals.filter(m => {
        const d = new Date(m.loggedAt);
        return d >= dayStart && d <= dayEnd;
      });

      if (dMeals.length > 0) {
        const dConsumed = dMeals.reduce((acc, m) => {
          acc.calories += m.calories || 0;
          acc.protein += m.protein || 0;
          acc.fiber += m.fiber || 0;
          acc.sugar += m.sugar || 0;
          acc.sodium += m.sodium || 0;
          return acc;
        }, { calories: 0, protein: 0, fiber: 0, sugar: 0, sodium: 0 });

        const calR = Math.min(dConsumed.calories / targets.calories, 1);
        const protR = Math.min(dConsumed.protein / targets.protein, 1);
        const fibR = Math.min(dConsumed.fiber / targets.fiber, 1);
        const sugP = dConsumed.sugar > targets.sugar ? 0.8 : 1;
        const sodP = dConsumed.sodium > targets.sodium ? 0.8 : 1;

        weekScores[day] = Math.min(Math.round(((calR * 0.3 + protR * 0.25 + fibR * 0.15 + 0.3) * sugP * sodP) * 100), 100);
      }
    }

    res.json({
      targets: user.dailyTargets,
      consumed,
      meals: todaysMeals.map((m) => ({
        _id: m._id,
        name: m.name,
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        nutriScore: m.nutriScore,
        loggedAt: m.loggedAt,
      })),
      habits: user.habits,
      healthScore: Math.min(healthScore, 100),
      weekScores,
      userName: user.name,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

/**
 * POST /api/diet/scan
 * Receives food image (base64), runs AI vision analysis, returns nutritional JSON
 */
router.post('/scan', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data (imageBase64) is required.' });
    }

    const nutritionData = await analyzeFoodImage(imageBase64);

    res.json({
      success: true,
      nutrition: nutritionData,
    });
  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(400).json({ error: err.message || 'Unable to analyze food image. Please try again with a clearer photo.' });
  }
});

/**
 * POST /api/diet/log
 * Save a meal to the database linked to the authenticated user
 */
router.post('/log', async (req, res) => {
  try {
    const {
      name,
      mealType,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      nutriScore,
      ingredients,
      imageBase64,
    } = req.body;

    if (!name || calories === undefined) {
      return res.status(400).json({ error: 'Meal name and calories are required.' });
    }

    const mealLog = new MealLog({
      userId: req.user.id,
      name,
      mealType: mealType || 'snack',
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: Number(fiber) || 0,
      sugar: Number(sugar) || 0,
      sodium: Number(sodium) || 0,
      nutriScore: nutriScore || 'C',
      ingredients: ingredients || [],
      // Store a thumbnail version to save space (first 500 chars for reference)
      imageBase64: imageBase64 ? imageBase64.substring(0, 500) : null,
    });

    await mealLog.save();

    res.status(201).json({
      success: true,
      meal: mealLog,
    });
  } catch (err) {
    console.error('Log meal error:', err);
    res.status(500).json({ error: 'Failed to log meal.' });
  }
});

/**
 * GET /api/diet/history
 * Retrieve past meal logs with optional date filtering
 * Query params: ?date=YYYY-MM-DD (optional, defaults to today)
 */
router.get('/history', async (req, res) => {
  try {
    const { date } = req.query;

    let startOfDay, endOfDay;

    if (date) {
      startOfDay = new Date(date);
      endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);
    } else {
      const today = new Date();
      startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
    }

    const meals = await MealLog.find({
      userId: req.user.id,
      loggedAt: { $gte: startOfDay, $lt: endOfDay },
    })
      .sort({ loggedAt: -1 })
      .select('-imageBase64'); // Exclude image data from history listing

    res.json({ meals });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Failed to fetch meal history.' });
  }
});

/**
 * PUT /api/diet/targets
 * Update user's daily nutrition targets and/or health profile
 * Body: { targets?: { calories, protein, carbs, fat, fiber, sugar, sodium }, profile?: { goal, weight, height, age, activityLevel } }
 */
router.put('/targets', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const { targets, profile } = req.body;

    if (profile) {
      Object.assign(user.profile, profile);
    }

    if (targets) {
      Object.assign(user.dailyTargets, targets);
    }

    // If profile changed but no explicit targets provided, let the pre-save hook recompute
    if (profile && !targets) {
      user.markModified('profile');
    } else if (targets) {
      // Prevent pre-save hook from overwriting explicit targets
      user.markModified('dailyTargets');
    }

    await user.save();

    res.json({ success: true, targets: user.dailyTargets, profile: user.profile });
  } catch (err) {
    console.error('Update targets error:', err);
    res.status(500).json({ error: 'Failed to update targets.' });
  }
});

module.exports = router;

