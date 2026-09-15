'use strict';

const express = require('express');
const { ChatGroq } = require('@langchain/groq');
const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const authMiddleware = require('../middleware/authMiddleware');
const { makeNutritionTools } = require('../tools/nutritionTools');

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

const SYSTEM_PROMPT = `You are NuFi AI, a friendly and knowledgeable personal nutrition assistant built into the NuFi health app.

Your role:
- Help users understand their nutrition, daily health score, and meal history.
- Give personalized, actionable meal and nutrition recommendations based on their actual targets and intake.
- Explain the NuFi Daily Health Score (0-100) using the app's real scoring formula when asked.
- Support natural follow-up questions using the conversation context.

Important rules:
- ALWAYS use the available tools when user-specific data is required. Never fabricate or estimate user data.
- Clearly label nutritional values as estimates when appropriate.
- Be encouraging and supportive — never shame users about their food choices.
- Do NOT diagnose medical conditions or prescribe treatment.
- For serious health concerns, recommend the user consult a qualified healthcare professional.
- Keep responses concise, structured, and conversational. Use bullet points (* item) for lists, **bold** for key names and metrics, and short paragraphs.
- Today's date is: ${new Date().toDateString()}.`;

/**
 * POST /api/chat
 * Body: { message: string, history: [{role: 'user'|'assistant', content: string}][] }
 * Returns: { reply: string }
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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your-groq-api-key-here') {
      return res.status(503).json({ error: 'AI service is not configured. Please add GROQ_API_KEY to server/.env.' });
    }

    // Model configured via GROQ_MODEL in .env
    const groqModel = process.env.GROQ_MODEL || process.env.groq_model || 'llama-3.3-70b-versatile';

    // userId comes from the verified JWT — never from client input
    const userId = req.user.id;

    // Build tools with userId closed in
    const tools = makeNutritionTools(userId);

    // Create Groq LLM via LangChain
    const model = new ChatGroq({
      apiKey,
      model: groqModel,
      temperature: 0.4,
      maxTokens: 1024,
    });

    // LangGraph createReactAgent — messageModifier accepts a system prompt string
    const agent = createReactAgent({
      llm: model,
      tools,
      messageModifier: SYSTEM_PROMPT,
    });

    // Build message list: prior conversation history + current user message
    const historyMessages = history.slice(-10).map(m =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    // Run agent
    const result = await agent.invoke({
      messages: [...historyMessages, new HumanMessage(message.trim())],
    });

    // Extract the final reply text from the last message
    const lastMessage = result.messages[result.messages.length - 1];
    const reply = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : Array.isArray(lastMessage.content)
        ? lastMessage.content.map(c => (typeof c === 'string' ? c : c.text || '')).join('')
        : String(lastMessage.content);

    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error('[NuFi AI] Chat error:', err?.message || err);

    if (err?.status === 401 || err?.message?.includes('API_KEY') || err?.message?.includes('api_key') || err?.message?.includes('Invalid API Key')) {
      return res.status(503).json({ error: 'Groq AI service configuration error. Please check GROQ_API_KEY in server/.env.' });
    }
    if (err?.status === 429 || err?.message?.toLowerCase().includes('quota') || err?.message?.toLowerCase().includes('rate limit') || err?.message?.toLowerCase().includes('resource_exhausted')) {
      return res.status(429).json({ error: 'AI service is busy (rate limit). Please try again in a moment.' });
    }
    res.status(500).json({ error: err?.message || 'NuFi AI encountered an error. Please try again.' });
  }
});

module.exports = router;
