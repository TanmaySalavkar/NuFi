'use strict';

const express = require('express');
const { Agent } = require('@mastra/core/agent');
const authMiddleware = require('../middleware/authMiddleware');
const { makeMastraNutritionTools } = require('../tools/mastraNutritionTools');

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

function getSystemInstructions(timezoneOffset) {
  const defaultOffset = process.env.DEFAULT_TIMEZONE_OFFSET !== undefined
    ? Number(process.env.DEFAULT_TIMEZONE_OFFSET)
    : -330;
  const offset = Number.isFinite(Number(timezoneOffset)) ? Number(timezoneOffset) : defaultOffset;
  const now = new Date();
  const clientTimeMs = now.getTime() - (offset * 60 * 1000);
  const clientDate = new Date(clientTimeMs);
  const dateStr = clientDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  return `You are NuFi, a friendly, encouraging, and proactive personal nutrition coach and health companion built into the NuFi app.

Your Superpowers:
1. DIRECT MEAL LOGGING: When a user tells you what they ate or drank (e.g. "I had 2 eggs and toast for breakfast", "Log a chicken salad for lunch", "Add a snack of 1 apple"), YOU MUST call the \`logMeal\` tool immediately!
   - If exact calorie or macro counts are not provided, estimate them accurately and realistically based on standard portion sizes.
   - Assign the appropriate mealType: 'breakfast', 'lunch', 'dinner', or 'snack'.
   - Confirm what was logged with estimated calories, protein, carbs, and fat, plus their updated daily score and remaining budget.
2. PERSONALIZED NUTRITION & ACTIVITY COACHING:
   - Use \`getTodaySummary\`, \`getMealHistory\`, \`getUserTargets\`, or \`getWeeklyProgress\` whenever the user asks about their intake, targets, or health score.
   - Use \`getHealthConnectSummary\` when the user asks about their steps, workouts, heart rate, sleep, or physical activity metrics.
   - Never make up user data — always check using tools.
3. HEALTH CONNECT BIOMETRIC SAFETY:
   - Health Connect data represents device sensor readings, NOT clinical diagnoses. Never diagnose, prescribe, or claim clinical authority.
   - If Health Connect data is stale (>24h), state the sync timestamp clearly.
   - If today's reading for a metric is missing, explicitly say it hasn't synced yet today — NEVER silently substitute an older reading as today's.
4. TONE & STYLE:
   - Warm, positive, supportive, and motivating — never shame food choices.
   - Keep responses clean and concise with bullet points (* item) and **bold** numbers/foods.
   - Date today is: ${dateStr}.`;
}

/**
 * POST /api/chat
 * Body: { message: string, history: [{role: 'user'|'assistant', content: string}][] }
 * Returns: { reply: string, loggedMeal?: Object }
 */
router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ error: 'Message is too long (max 1000 characters).' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if ((!groqKey || groqKey === 'your-groq-api-key-here') && (!geminiKey || geminiKey === 'your-gemini-api-key-here')) {
      return res.status(503).json({
        error: 'AI service is not configured. Please add GROQ_API_KEY or GEMINI_API_KEY to server/.env.'
      });
    }

    // Determine model string for Mastra
    let modelString = 'groq/llama-3.3-70b-versatile';
    if (groqKey && groqKey !== 'your-groq-api-key-here') {
      const gModel = process.env.GROQ_MODEL || process.env.groq_model || 'llama-3.3-70b-versatile';
      modelString = `groq/${gModel}`;
    } else if (geminiKey && geminiKey !== 'your-gemini-api-key-here') {
      const gemModel = process.env.GEMINI_MODEL || process.env.gemini_model || 'gemini-2.5-flash';
      modelString = `google/${gemModel}`;
    }

    const rawOffset = req.query.timezoneOffset ?? req.headers['x-timezone-offset'] ?? req.body.timezoneOffset;
    const timezoneOffset = rawOffset !== undefined ? Number(rawOffset) : -330;

    const userId = req.user.id;
    const tools = makeMastraNutritionTools(userId, timezoneOffset);

    // Initialize Mastra Agent for NuFi
    const agent = new Agent({
      name: 'NuFi',
      instructions: getSystemInstructions(timezoneOffset),
      model: modelString,
      tools,
    });

    // Build message list (last 8 history messages + current prompt)
    const formattedMessages = [
      ...history.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: String(m.content || ''),
      })),
      {
        role: 'user',
        content: message.trim(),
      },
    ];

    console.log(`[NuFi Agent] Processing message from user ${userId} with model ${modelString}`);
    let response;
    try {
      response = await agent.generate(formattedMessages, {
        maxSteps: 5,
        modelSettings: {
          maxOutputTokens: 600,
        },
      });
    } catch (primaryErr) {
      if (primaryErr?.message?.includes('rate_limit') || primaryErr?.message?.includes('OTPM') || primaryErr?.status === 429) {
        console.warn('[NuFi Agent] Output token limit hit, retrying with tighter maxOutputTokens (350)...');
        response = await agent.generate(formattedMessages, {
          maxSteps: 3,
          modelSettings: {
            maxOutputTokens: 350,
          },
        });
      } else {
        throw primaryErr;
      }
    }

    const reply = (response.text || '').trim();

    // Check if a meal was logged during tool execution
    let loggedMeal = null;
    if (Array.isArray(response.toolResults)) {
      for (const tr of response.toolResults) {
        if (tr.toolName === 'logMeal' && tr.payload?.success && tr.payload?.loggedMeal) {
          loggedMeal = tr.payload.loggedMeal;
          break;
        }
      }
    }

    res.json({
      reply: reply || 'I updated your nutrition log and details!',
      loggedMeal,
    });
  } catch (err) {
    console.error('[NuFi Agent] Chat error:', err?.message || err);

    if (err?.status === 401 || err?.message?.includes('API_KEY') || err?.message?.includes('api_key') || err?.message?.includes('Invalid API Key')) {
      return res.status(503).json({ error: 'AI API Key configuration error. Please check GROQ_API_KEY in server/.env.' });
    }
    if (err?.status === 429 || err?.message?.toLowerCase().includes('quota') || err?.message?.toLowerCase().includes('rate limit')) {
      return res.status(429).json({ error: 'NuFi is receiving high traffic right now. Please try again in a few seconds.' });
    }
    res.status(500).json({ error: err?.message || 'NuFi encountered an error. Please try again.' });
  }
});

module.exports = router;
