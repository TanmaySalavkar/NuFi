const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  profile: {
    age: { type: Number, default: 25 },
    weight: { type: Number, default: 70 },       // kg
    height: { type: Number, default: 170 },      // cm
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    goal: { type: String, enum: ['lose', 'maintain', 'gain'], default: 'maintain' },
    activityLevel: {
      type: String,
      enum: ['sedentary', 'light', 'moderate', 'active'],
      default: 'moderate',
    },
  },
  dailyTargets: {
    calories: { type: Number, default: 2000 },
    protein: { type: Number, default: 115 },     // grams
    carbs: { type: Number, default: 250 },
    fat: { type: Number, default: 65 },
    fiber: { type: Number, default: 30 },
    sugar: { type: Number, default: 50 },
    sodium: { type: Number, default: 2300 },     // mg
  },
  habits: {
    type: [
      {
        title: String,
        completed: { type: Boolean, default: false },
        icon: { type: String, default: '✅' },
      },
    ],
    default: [
      { title: 'Drink 8 glasses of water', completed: false, icon: '💧' },
      { title: 'Take daily vitamins', completed: false, icon: '💊' },
      { title: 'Eat 5 servings of fruits/veggies', completed: false, icon: '🥗' },
      { title: '30 min exercise', completed: false, icon: '🏃' },
      { title: 'No sugary drinks', completed: false, icon: '🚫' },
    ],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Compute daily calorie & macro targets using Mifflin-St Jeor equation
 * BMR = 10*weight(kg) + 6.25*height(cm) - 5*age(years) + s  (s = +5 male, -161 female)
 */
function computeDailyTargets(profile) {
  const { age, weight, height, gender, goal, activityLevel } = profile;

  // Mifflin-St Jeor BMR
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  bmr += gender === 'female' ? -161 : 5;

  // Activity multiplier
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  let tdee = bmr * (activityMultipliers[activityLevel] || 1.55);

  // Goal adjustment
  if (goal === 'lose') tdee -= 500;
  if (goal === 'gain') tdee += 400;

  const calories = Math.round(tdee);

  // Macro split: 30% protein, 40% carbs, 30% fat
  const protein = Math.round((calories * 0.30) / 4);   // 4 cal per gram
  const carbs = Math.round((calories * 0.40) / 4);
  const fat = Math.round((calories * 0.30) / 9);       // 9 cal per gram

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: 30,
    sugar: Math.round(calories * 0.05 / 4),  // ~5% of calories
    sodium: 2300,
  };
}

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Compute daily targets only for new users — updates via /api/diet/targets are explicit
  if (this.isNew) {
    this.dailyTargets = computeDailyTargets(this.profile);
  }

  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});


// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
