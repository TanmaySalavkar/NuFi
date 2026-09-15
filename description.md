# Smart Health Companion (NuFi) — Comprehensive Project Description

## 1. Executive Summary & Project Vision

**Smart Health Companion (branded as NuFi)** is a full-stack, AI-powered personal health and nutrition tracking mobile application. The platform simplifies dietary management by eliminating tedious manual calorie and macro logging. 

Users can take a photo of their meal or pick an image from their gallery. The backend leverages **Google Gemini Vision multimodal AI** to identify the food, estimate portion sizes, calculate macronutrients (protein, carbs, fat) and micronutrients (fiber, sugar, sodium), assign an internationally standardized **Nutri-Score (A–E)**, and detect individual ingredients.

The system dynamically computes a personalized **Daily Health Score (0–100)**, monitors daily habit completion, tracks weekly adherence across a 7-day strip, and automatically recalibrates daily nutrition targets using the scientific **Mifflin-St Jeor metabolic formula** based on user biometrics (age, weight, height, gender, activity level, and weight goals).

---

## 2. Key Features & Capabilities

### 📷 AI-Powered Food Vision Scanner
- **Direct Camera & Gallery Capture**: Seamlessly capture a meal photo using the device camera or choose an existing photo from the photo library.
- **Multimodal AI Analysis**: Powered by Google Gemini (`gemini-3.5-flash-lite` and `gemini-3.6-flash`). Processes Base64 image payloads and returns structured nutritional metrics.
- **Non-Food Safety Guardrail**: Built-in prompt engineering detects non-food items (e.g., household objects, animals, landscapes) and prompts the user to scan a valid edible item rather than generating hallucinated nutritional values.
- **Nutri-Score Assessment**: Ranks food quality on an A through E scale (green for high nutritional value, amber for moderate, and red for ultra-processed or high-sugar/sodium meals).
- **Interactive Review & Adjust**: Displays parsed macronutrients, calorie breakdown, detected ingredients, and confidence ratings before the user commits the log to the database.

### 📊 Intelligent Diet Dashboard
- **Daily Health Score (0–100)**: Evaluates the balance of calories, protein, and fiber consumed against user targets, penalizing excessive intake of sugar and sodium.
- **Circular Progress Ring**: Displays real-time progress toward daily calorie goals with clear percentage indicators.
- **Weekly Adherence Strip**: Tracks daily health scores from Monday to Sunday, allowing users to spot patterns and monitor dietary consistency.
- **Macronutrient Tracking**: High-contrast, color-coded macro bars for Protein, Carbohydrates, and Fats with both grams consumed and remaining targets.
- **Micronutrient Safeguards**: Dedicated monitoring for Fiber, Sugar, and Sodium to keep intake within healthy boundaries.
- **Daily Meal Feed**: Displays meals logged today with timestamps, meal types (Breakfast, Lunch, Dinner, Snack), and calorie contributions.
- **Daily Habit Checklists**: Interactive tracker for healthy routines (water intake, daily vitamins, vegetable servings, 30-min exercise, sugar-free drinks).

### 📅 Comprehensive Meal History & Calendar
- **Horizontal Date Selector**: Interactive week-based calendar strip to review past nutrition records and inspect individual days.
- **Aggregated Daily Summaries**: Recalculates total calories and macronutrient splits for any historical date.
- **Detailed Meal Cards**: Card-based views of historical meals, including timestamps, nutritional tags, ingredient lists, and color-coded Nutri-Score indicators.
- **Pull-to-Refresh & Empty States**: Clean feedback states when no meals have been logged for a specific day.

### ⚙️ Personalized Biometrics & BMR Calculator
- **Mifflin-St Jeor Target Engine**: Automatically computes Basal Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE) using:
  $$\text{BMR}_{\text{male}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (years)} + 5$$
  $$\text{BMR}_{\text{female}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (years)} - 161$$
- **Goal Modifiers**: Adjusts caloric intake based on user goals:
  - **Lose Weight**: TDEE $- 500\text{ kcal}$
  - **Maintain Weight**: TDEE
  - **Gain Weight**: TDEE $+ 400\text{ kcal}$
- **In-Place Target Overrides**: Direct editing of physical metrics (age, height, weight, activity level) and fine-grained macro/micronutrient goals from the Profile screen.

### 🧭 Frictionless Navigation & UX
- **Stationary Floating Dock Navigation**: Custom bottom navigation bar mounted at the application root, remaining completely fixed during screen transitions.
- **Direction-Aware Slide Transitions**: Tab transitions mirror spatial layout:
  - Navigating to a tab to the right (e.g., Home $\rightarrow$ Meals or Home $\rightarrow$ Profile) slides **right to left**.
  - Navigating to a tab to the left (e.g., Profile $\rightarrow$ Home or Meals $\rightarrow$ Home) slides **left to right**.
- **Snappy Response Times**: Background caching and 60-second Time-To-Live (TTL) eliminate screen loading delays when toggling between tabs.

---

## 3. Technology Stack

### Mobile Frontend
| Layer | Technology |
|---|---|
| **Framework** | React Native 0.85, React 19 |
| **Language** | JavaScript (ES6+ / JSX) |
| **Navigation** | `@react-navigation/native` v7, `@react-navigation/bottom-tabs` v7, `@react-navigation/native-stack` v7 |
| **Navigation Elements** | `@react-navigation/elements` |
| **Networking & HTTP** | Axios (with token injection and automatic network fallback) |
| **Local Storage** | `@react-native-async-storage/async-storage` |
| **Camera & Image Selection** | `react-native-image-picker` |
| **Icons & Visuals** | `lucide-react-native`, `react-native-svg` |
| **Device Adaptation** | `react-native-safe-area-context`, `react-native-screens` |

### Backend API
| Layer | Technology |
|---|---|
| **Runtime & Framework** | Node.js (v20+), Express.js |
| **Database & ODM** | MongoDB Atlas, Mongoose |
| **AI Integration** | Google Generative AI SDK (`@google/generative-ai`) |
| **Authentication & Security** | JSON Web Tokens (JWT), `bcryptjs` for password hashing |
| **Middleware** | CORS, JSON body parser with 50MB payload limits (for Base64 images) |

---

## 4. System Architecture & Component Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Native Mobile App                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                        AppNavigator                            │   │
│   │  ┌─────────────────────────┐   ┌────────────────────────────┐  │   │
│   │  │   AuthStack (Public)    │   │      AppStack (Modal)      │  │   │
│   │  │  - LoginScreen          │   │  - FoodScannerScreen       │  │   │
│   │  │  - RegisterScreen       │   │  - MealNutritionDetail     │  │   │
│   │  └─────────────────────────┘   └─────────────┬──────────────┘  │   │
│   │                                              │                 │   │
│   │  ┌───────────────────────────────────────────┴──────────────┐  │   │
│   │  │           MainTabs (createBottomTabNavigator)            │  │   │
│   │  │   [DietDashboardScreen]  [MealHistoryScreen]  [Profile]  │  │   │
│   │  │   - Direction-aware sceneStyleInterpolator               │  │   │
│   │  │   - Root-mounted stationary BottomNavBar                 │  │   │
│   │  └──────────────────────────────────────────────────────────┘  │   │
│   └────────────────────────────────────────────────────────────────┘   │
│               │                                       │                │
│       [AuthContext]                            [DietContext]           │
│   (JWT, User, Auto-Login)               (Dashboard, Meals, Caching)    │
│               │                                       │                │
│               └───────────────────┬───────────────────┘                │
│                                   ▼                                    │
│                 Axios API Client (Token Interceptor &                  │
│                Dual-Endpoint Emulator/Device Fallback)                 │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ HTTP / REST (Bearer Auth)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Express.js Server                            │
│                                                                        │
│   ┌───────────────────────┐             ┌──────────────────────────┐   │
│   │      authRoutes       │             │        dietRoutes        │   │
│   │  - /api/auth/register │             │  - /api/diet/dashboard   │   │
│   │  - /api/auth/login    │             │  - /api/diet/scan        │   │
│   │  - /api/auth/me       │             │  - /api/diet/log         │   │
│   └───────────────────────┘             │  - /api/diet/history     │   │
│                                         │  - /api/diet/targets     │   │
│                                         │  - /api/diet/habits/toggle│  │
│                                         └─────────────┬────────────┘   │
│                                                       │                │
│                                         ┌─────────────▼────────────┐   │
│                                         │      aiService.js        │   │
│                                         │  (Google Gemini Vision)  │   │
│                                         └─────────────┬────────────┘   │
└───────────────────────┬───────────────────────────────┼────────────────┘
                        │                               │
                        ▼                               ▼
            ┌──────────────────────┐        ┌─────────────────────────┐
            │    MongoDB Atlas     │        │  Google Gemini Vision   │
            │  - User collection   │        │     Flash 3.5 / 3.6     │
            │  - MealLog collection│        └─────────────────────────┘
            └──────────────────────┘
```

---

## 5. Database Schemas

### 1. User (`server/models/User.js`)
- `email`: String, required, unique, lowercase, trimmed.
- `password`: String, hashed via `bcryptjs`.
- `name`: String, required.
- `profile`:
  - `age`: Number (default: 25)
  - `weight`: Number in kg (default: 70)
  - `height`: Number in cm (default: 170)
  - `gender`: Enum (`male`, `female`, `other`)
  - `goal`: Enum (`lose`, `maintain`, `gain`)
  - `activityLevel`: Enum (`sedentary`, `light`, `moderate`, `active`)
- `dailyTargets`:
  - `calories`: Number (default: 2000)
  - `protein`: Number in grams (default: 115)
  - `carbs`: Number in grams (default: 250)
  - `fat`: Number in grams (default: 65)
  - `fiber`: Number in grams (default: 30)
  - `sugar`: Number in grams (default: 50)
  - `sodium`: Number in mg (default: 2300)
- `habits`: Array of `{ title, completed, icon }`.
- `createdAt`: Date.

### 2. MealLog (`server/models/MealLog.js`)
- `userId`: ObjectId referencing `User`, indexed.
- `name`: String (name of the meal/dish).
- `mealType`: Enum (`breakfast`, `lunch`, `dinner`, `snack`).
- `imageBase64`: String (optional preview thumbnail).
- `calories`: Number, required.
- `protein`: Number (grams).
- `carbs`: Number (grams).
- `fat`: Number (grams).
- `fiber`: Number (grams).
- `sugar`: Number (grams).
- `sodium`: Number (mg).
- `nutriScore`: Enum (`A`, `B`, `C`, `D`, `E`).
- `ingredients`: Array of Strings.
- `loggedAt`: Date, indexed (defaults to `Date.now`).

---

## 6. API Endpoints Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Creates user, hashes password, computes Mifflin-St Jeor targets, issues JWT.
- `POST /api/auth/login` — Authenticates email/password, returns JWT and user profile.
- `GET /api/auth/me` — Fetches authenticated user details from bearer token.

### Diet & Health (`/api/diet`)
- `GET /api/diet/dashboard` — Returns current day's consumed totals, targets, meals, habits, and health score.
- `POST /api/diet/scan` — Receives Base64 food photo, invokes Google Gemini Vision API, returns nutrition estimates.
- `POST /api/diet/log` — Persists analyzed meal into `MealLog` collection and updates dashboard totals.
- `GET /api/diet/history?date=YYYY-MM-DD` — Fetches logs and totals for a specific date.
- `PUT /api/diet/targets` — Updates physical metrics (weight, height, age, goal) or custom macro targets.
- `PUT /api/diet/habits/toggle` — Toggles completion status of a daily habit item.

---

## 7. Resilience & Network Engineering

1. **Dual-Endpoint Fallback Engine**:
   - Automatically detects whether the app is executing inside the Android emulator (`http://10.0.2.2:3000`) or on a physical USB device (`http://localhost:3000` via `adb reverse`).
   - If an endpoint fails to respond, the network client automatically switches to the alternative endpoint and persists the working route.

2. **Smart In-Memory Caching (60s TTL)**:
   - Eliminates redundant API re-fetching on rapid tab navigation.
   - Automatically invalidates cache when a meal is logged or during user pull-to-refresh gestures.

3. **Global Token & 401 Interceptors**:
   - Injects the stored JWT into every outbound request.
   - Detects token expiration (HTTP 401) and purges AsyncStorage credentials to transition to the login screen without crashing.

4. **Multi-Model AI Failover**:
   - Iterates through a prioritized list of Gemini models (`gemini-3.5-flash-lite`, `gemini-3.6-flash`) with fallback mock generation in development environments without active API keys.

---

## 8. Directory & File Structure

```
Smart-Health-Companion/
├── src/
│   ├── components/
│   │   ├── BottomNavBar.jsx        # Stationary floating pill navigation bar
│   │   ├── CircleProgress.jsx      # SVG animated circular score and calorie ring
│   │   ├── Icons.jsx               # Custom SVG health, food, and tab icons
│   │   └── NutriTrackLogo.jsx      # Vector branded NuFi application logo
│   ├── context/
│   │   ├── AuthContext.jsx         # Authentication, token persistence, and fallback client
│   │   └── DietContext.jsx         # Diet dashboard state, caching, scanning, and meal logging
│   ├── navigation/
│   │   └── AppNavigator.jsx        # Root Stack + Tab Navigator with directional slide interpolators
│   ├── screens/
│   │   ├── DietDashboardScreen.jsx # Daily score, calorie card, macro progress, meal feed
│   │   ├── FoodScannerScreen.jsx   # Camera capture, gallery selection, and scanning animation
│   │   ├── MealNutritionDetailScreen.jsx # Nutritional breakdown review and confirmation
│   │   ├── MealHistoryScreen.jsx   # Calendar strip and historical meal breakdown
│   │   ├── ProfileScreen.jsx       # Physical stats, Mifflin-St Jeor target editor, logout
│   │   ├── LoginScreen.jsx         # User login form with validation and branding
│   │   └── RegisterScreen.jsx      # Multi-step onboarding and goal selection
│   ├── services/
│   │   └── api.js                  # Axios configuration with interceptors
│   ├── theme.js                    # NuFi design tokens (lime accents, dark themes, typography)
│   └── config.js                   # API base URL configuration
├── server/
│   ├── index.js                    # Express application entrypoint and DB connection
│   ├── middleware/
│   │   └── authMiddleware.js       # JWT extraction and validation middleware
│   ├── models/
│   │   ├── User.js                 # User schema and Mifflin-St Jeor equation logic
│   │   ├── MealLog.js              # Meal logs with nutrients and Nutri-Scores
│   │   └── Doctor.js               # Clinical doctor profiles schema
│   ├── routes/
│   │   ├── authRoutes.js           # Registration and login endpoints
│   │   └── dietRoutes.js           # Dashboard, AI scan, meal log, and target routes
│   ├── services/
│   │   └── aiService.js            # Google Gemini Vision prompt and image analysis
│   └── seed.js                     # Initial database seeding script
├── App.tsx                         # Root React Native component with Context Providers
├── description.md                  # Comprehensive project documentation
└── package.json                    # Project dependencies and execution scripts
```

---

## 9. Local Development & Quick Start

### Prerequisites
- Node.js (v20+ recommended)
- Android Studio / Android SDK (or physical device with USB debugging enabled)
- MongoDB instance (Atlas URI or local `mongodb://localhost:27017/smc`)

### Backend Setup
1. Open a terminal in `server/`:
   ```bash
   cd server
   npm install
   ```
2. Configure `server/.env`:
   ```env
   PORT=3000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/smarthealth?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Start the server:
   ```bash
   node index.js
   ```

### Frontend Setup
1. Open a terminal at the project root:
   ```bash
   npm install
   ```
2. If testing on a physical Android device via USB:
   ```bash
   adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8081 tcp:8081
   ```
3. Start the Metro bundler:
   ```bash
   npm run start -- --reset-cache
   ```
4. In a separate terminal, launch the Android application:
   ```bash
   npx react-native run-android
   ```
