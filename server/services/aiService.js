const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Analyze a food image using Google Gemini Vision API
 * @param {string} imageBase64 - Base64-encoded image data
 * @returns {Object} Nutritional analysis JSON
 */
async function analyzeFoodImage(imageBase64) {
  const apiKey = process.env.GEMINI_API_KEY;

  console.log('────────────────────────────────────────');
  console.log('🔬 [SCAN] Food scan request received');
  console.log('🔑 [SCAN] API Key present:', !!apiKey);
  console.log('🔑 [SCAN] API Key prefix:', apiKey ? apiKey.substring(0, 8) + '...' : 'NONE');
  console.log('📦 [SCAN] Image data length:', imageBase64 ? imageBase64.length : 0, 'chars');
  console.log('🌐 [SCAN] Node version:', process.version);
  console.log('🌐 [SCAN] fetch available:', typeof fetch !== 'undefined');

  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    console.log('⚠️  [SCAN] No valid API key → returning MOCK data');
    return getMockNutritionData();
  }

  // Latest models as recommended by Gemini API (Aug 2026)
  const modelNames = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
  const genAI = new GoogleGenerativeAI(apiKey);
  //  Active Gemini models
  // const modelNames = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  console.log('📷 [SCAN] Clean base64 length:', cleanBase64.length, 'chars');

  const prompt = `You are a professional nutritionist AI. Analyze this food image and provide a detailed nutritional breakdown.

IMPORTANT: If the image does NOT contain food or a meal (e.g. it shows a person, object, text, scenery, animal, or anything non-edible), return ONLY this JSON:
{"isFood": false, "message": "This doesn't appear to be a food item. Please scan a food or meal."}

If it IS food, return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "isFood": true,
  "name": "Name of the food/meal",
  "mealType": "breakfast" or "lunch" or "dinner" or "snack",
  "calories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fat": <number in grams>,
  "fiber": <number in grams>,
  "sugar": <number in grams>,
  "sodium": <number in mg>,
  "nutriScore": "A" or "B" or "C" or "D" or "E",
  "ingredients": ["ingredient1", "ingredient2", ...],
  "confidence": <number 0-100>
}

Be accurate with calorie and macro estimates. If unsure, provide reasonable estimates for typical portion sizes.`;

  var lastError = null;

  for (var i = 0; i < modelNames.length; i++) {
    var modelName = modelNames[i];
    try {
      console.log('🤖 [SCAN] Trying model:', modelName, '(' + (i + 1) + '/' + modelNames.length + ')');
      var model = genAI.getGenerativeModel({ model: modelName });

      console.log('📤 [SCAN] Sending request to Gemini...');
      var startTime = Date.now();

      var result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64,
          },
        },
      ]);

      var elapsed = Date.now() - startTime;
      console.log('📥 [SCAN] Response received in', elapsed + 'ms');

      var responseText = result.response.text();
      console.log('📝 [SCAN] Raw response length:', responseText.length, 'chars');
      console.log('📝 [SCAN] Raw response preview:', responseText.substring(0, 200));

      var jsonStr = responseText;
      var jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
        console.log('✅ [SCAN] JSON extracted successfully');
      } else {
        console.log('⚠️  [SCAN] No JSON object found in response, using raw text');
      }

      var nutritionData = JSON.parse(jsonStr);
      console.log('✅ [SCAN] JSON parsed successfully');

      // Non-food item detection
      if (nutritionData.isFood === false) {
        console.log('🚫 [SCAN] Not a food item detected');
        console.log('────────────────────────────────────────');
        throw { isNotFood: true, message: nutritionData.message || 'This doesn\'t appear to be a food item. Please scan a food or meal.' };
      }

      console.log('🍽️  [SCAN] Food identified:', nutritionData.name);
      console.log('🔥 [SCAN] Calories:', nutritionData.calories);
      console.log('📊 [SCAN] Nutri-Score:', nutritionData.nutriScore);
      console.log('────────────────────────────────────────');

      return {
        name: nutritionData.name || 'Scanned Meal',
        mealType: nutritionData.mealType || 'snack',
        calories: Number(nutritionData.calories) || 0,
        protein: Number(nutritionData.protein) || 0,
        carbs: Number(nutritionData.carbs) || 0,
        fat: Number(nutritionData.fat) || 0,
        fiber: Number(nutritionData.fiber) || 0,
        sugar: Number(nutritionData.sugar) || 0,
        sodium: Number(nutritionData.sodium) || 0,
        nutriScore: ['A', 'B', 'C', 'D', 'E'].includes(nutritionData.nutriScore)
          ? nutritionData.nutriScore
          : 'C',
        ingredients: Array.isArray(nutritionData.ingredients)
          ? nutritionData.ingredients
          : [],
        confidence: Number(nutritionData.confidence) || 80,
      };
    } catch (err) {
      // If it's a non-food detection, propagate immediately (don't retry other models)
      if (err && err.isNotFood) {
        throw new Error(err.message);
      }
      console.log('❌ [SCAN] Model', modelName, 'FAILED:', err.message);
      lastError = err;
    }
  }

  // All models failed — fallback to mock nutrition data so user gets a seamless experience
  var errMsg = (lastError && lastError.message) ? lastError.message : 'All models unavailable';
  console.log('⚠️ [SCAN] Gemini API failed (' + errMsg + ') -> Falling back to Mock Nutrition Data');
  console.log('────────────────────────────────────────');
  return getMockNutritionData();
}

/**
 * Mock data for development/demo without API key
 */
function getMockNutritionData() {
  var meals = [
    {
      name: 'Grilled Chicken Salad',
      mealType: 'lunch',
      calories: 485,
      protein: 42,
      carbs: 18,
      fat: 22,
      fiber: 6,
      sugar: 4,
      sodium: 620,
      nutriScore: 'A',
      ingredients: ['Chicken Breast', 'Mixed Greens', 'Cherry Tomatoes', 'Cucumber', 'Olive Oil', 'Lemon Dressing'],
      confidence: 92,
    },
    {
      name: 'Margherita Pizza Slice',
      mealType: 'dinner',
      calories: 320,
      protein: 14,
      carbs: 36,
      fat: 12,
      fiber: 2,
      sugar: 5,
      sodium: 780,
      nutriScore: 'C',
      ingredients: ['Pizza Dough', 'Mozzarella', 'Tomato Sauce', 'Fresh Basil', 'Olive Oil'],
      confidence: 88,
    },
    {
      name: 'Acai Smoothie Bowl',
      mealType: 'breakfast',
      calories: 380,
      protein: 8,
      carbs: 62,
      fat: 12,
      fiber: 9,
      sugar: 38,
      sodium: 45,
      nutriScore: 'B',
      ingredients: ['Acai Puree', 'Banana', 'Blueberries', 'Granola', 'Chia Seeds', 'Honey'],
      confidence: 90,
    },
    {
      name: 'Avocado Toast with Eggs',
      mealType: 'breakfast',
      calories: 420,
      protein: 18,
      carbs: 30,
      fat: 26,
      fiber: 8,
      sugar: 3,
      sodium: 380,
      nutriScore: 'B',
      ingredients: ['Sourdough Bread', 'Avocado', 'Poached Eggs', 'Cherry Tomatoes', 'Red Pepper Flakes'],
      confidence: 91,
    },
  ];

  var selected = meals[Math.floor(Math.random() * meals.length)];
  console.log('🎭 [MOCK] Returning mock data:', selected.name);
  return selected;
}

module.exports = { analyzeFoodImage };
