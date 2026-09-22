require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Doctor = require('./models/Doctor');
const authRoutes = require('./routes/authRoutes');
const dietRoutes = require('./routes/dietRoutes');
const chatRoute  = require('./routes/chatRoute');
const healthConnectRoutes = require('./routes/healthConnectRoutes');

const mongoUri = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.set('strictQuery', false);
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support base64 image payloads

// ── Routes ──────────────────────────────────────────
// Root & Health check
app.get('/', (req, res) => {
  res.send('NuFi Server is live!');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Existing Doctors API
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await Doctor.find();
    res.json(doctors);
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// Auth routes (register, login, me)
app.use('/api/auth', authRoutes);

// Diet routes (dashboard, scan, log, history)
app.use('/api/diet', dietRoutes);

// NuFi AI chat route
app.use('/api/chat', chatRoute);

// Google Health Connect routes (v1 user-scoped encrypted)
app.use('/api/v1/health-connect', healthConnectRoutes);

// ── Start Server ────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Auth:  POST /api/auth/register, POST /api/auth/login, GET /api/auth/me`);
  console.log(`   Diet:  GET /api/diet/dashboard, POST /api/diet/scan, POST /api/diet/log, GET /api/diet/history`);
  console.log(`   Docs:  GET /api/doctors`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️  Port ${PORT} is already in use!`);
    console.error(`👉 Run this to free it: kill -9 $(lsof -t -i:${PORT})\n`);
  } else {
    console.error('Server error:', err);
  }
});
