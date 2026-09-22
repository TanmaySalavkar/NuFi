import React, { useContext, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, ActivityIndicator, Alert, Dimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { ChevronLeft, Flame, Check, Utensils, Sun, Moon, Coffee } from 'lucide-react-native';
import { DietContext } from '../context/DietContext';

const { width, height } = Dimensions.get('window');

const NUTRI_COLORS = { A: '#16A34A', B: '#2563EB', C: '#F59E0B', D: '#EA580C', E: '#EF4444' };
const NUTRI_LABELS = { A: 'Excellent Choice', B: 'Balanced Meal', C: 'Moderate', D: 'Less Healthy', E: 'Poor Choice' };

// ── Reusable Circular SVG Progress Ring (12 o'clock, clockwise) ──
const CircularRing = ({ percentage = 0, size = 62, strokeWidth = 5.5, color = '#E05A27', trackColor = '#EFECE6', children }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        {children}
      </View>
    </View>
  );
};

const MealNutritionDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { logMeal, isLogging, dashboard } = useContext(DietContext);
  const params = route.params || {};
  const nutrition = params.nutrition || null;
  const imageBase64 = params.imageBase64 || null;
  const [logged, setLogged] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState(nutrition?.mealType || 'snack');

  if (!nutrition) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🍽️</Text>
        <Text style={s.errText}>No nutrition data available</Text>
        <TouchableOpacity
          style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 14, backgroundColor: '#1C1C24', borderRadius: 14 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const n = nutrition;
  const targets = (dashboard && dashboard.targets) || { calories: 2000, protein: 115, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };
  const consumed = (dashboard && dashboard.consumed) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const scoreLetter = (n.nutriScore || 'B').toUpperCase();
  const scoreLabel = NUTRI_LABELS[scoreLetter] || 'Balanced meal';

  // Percentage calculations
  const calVal = Number(n.calories) || 0;
  const calPct = Math.round((calVal / targets.calories) * 100);

  const proteinVal = Number(n.protein) || 0;
  const proteinPct = Math.round((proteinVal / targets.protein) * 100);

  const carbsVal = Number(n.carbs) || 0;
  const carbsPct = Math.round((carbsVal / targets.carbs) * 100);

  const fatVal = Number(n.fat) || 0;
  const fatPct = Math.round((fatVal / targets.fat) * 100);

  const fiberVal = Number(n.fiber) || 0;
  const fiberPct = Math.round((fiberVal / targets.fiber) * 100);

  const sugarVal = Number(n.sugar) || 0;
  const sugarPct = Math.round((sugarVal / targets.sugar) * 100);

  const sodiumVal = Number(n.sodium) || 0;
  const sodiumPct = Math.round((sodiumVal / targets.sodium) * 100);

  // Meal Image Source
  const imageSource = imageBase64
    ? (imageBase64.startsWith('data:') ? { uri: imageBase64 } : { uri: `data:image/jpeg;base64,${imageBase64}` })
    : { uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80' };

  const handleLogMeal = async () => {
    try {
      const result = await logMeal({
        name: n.name || 'Scanned Meal',
        mealType: selectedMealType || 'snack',
        calories: calVal,
        protein: proteinVal,
        carbs: carbsVal,
        fat: fatVal,
        fiber: fiberVal,
        sugar: sugarVal,
        sodium: sodiumVal,
        nutriScore: scoreLetter,
        ingredients: Array.isArray(n.ingredients) ? n.ingredients : [],
        imageBase64: imageBase64 || null,
      });

      if (result && result.success) {
        setLogged(true);
        Alert.alert('Meal Logged! 🎉', `${n.name || 'Meal'} has been added to your daily log.`, [
          { text: 'View Dashboard', onPress: () => navigation.navigate('Main', { screen: 'DietDashboard' }) },
        ]);
      } else {
        Alert.alert('Error', (result && result.error) || 'Failed to log meal. Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred while logging the meal.');
    }
  };

  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        style={s.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 30, 40) }}
      >
        {/* ═══ 1. Top Food Image Banner ═══ */}
        <View style={s.imageBannerContainer}>
          <Image source={imageSource} style={s.foodImage} resizeMode="cover" />

          {/* Top Floating Back Button */}
          <TouchableOpacity
            style={[s.floatingBackBtn, { top: Math.max(insets.top, 16) + 8 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ChevronLeft size={24} color="#1C1C24" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Nutri-Score Bottom Right Overlay Badge */}
          <View style={s.nutriBadgeContainer}>
            <Text style={s.nutriBadgeLetter}>{scoreLetter}</Text>
            <View style={s.nutriBadgeTextWrap}>
              <Text style={s.nutriBadgeHeader}>NUTRI-SCORE</Text>
              <Text style={s.nutriBadgeTitle}>{scoreLabel}</Text>
            </View>
          </View>
        </View>

        {/* ═══ 2. Sliding White Sheet Card ═══ */}
        <View style={s.sheetCard}>
          {/* Handle bar */}
          <View style={s.handleBar} />

          {/* Timestamp Subtitle */}
          <Text style={s.identifiedTime}>IDENTIFIED • {formattedTime}</Text>

          {/* Main Dish Name */}
          <Text style={s.dishTitle}>{n.name}</Text>

          {/* ═══ 3. Calories Summary Card ═══ */}
          <View style={s.cardBox}>
            <View style={s.calRowTop}>
              {/* Flame Ring */}
              <CircularRing percentage={calPct} size={64} strokeWidth={6} color="#E05A27" trackColor="#F0ECE6">
                <Flame size={24} color="#E05A27" fill="#E05A27" />
              </CircularRing>

              {/* Calorie Stats */}
              <View style={s.calStats}>
                <View style={s.calNumberRow}>
                  <Text style={s.calMainNum}>{calVal}</Text>
                  <Text style={s.calKcalUnit}>kcal</Text>
                </View>
                <Text style={s.calGoalDesc}>{calPct}% of daily goal • {targets.calories} kcal</Text>
              </View>
            </View>

            {/* Dual Track Progress Bar */}
            <View style={s.barTrackContainer}>
              <View
                style={[
                  s.barTrackConsumed,
                  { width: `${Math.min(((consumed.calories) / targets.calories) * 100, 100)}%` },
                ]}
              />
              <View
                style={[
                  s.barTrackNewMeal,
                  { width: `${Math.min((calVal / targets.calories) * 100, 100)}%` },
                ]}
              />
            </View>

            {/* Bar Footer Labels */}
            <View style={s.barFooterRow}>
              <Text style={s.barFooterLeft}>logged {Math.round(consumed.calories)}</Text>
              <Text style={s.barFooterCenter}>+{calVal}</Text>
              <Text style={s.barFooterRight}>{Math.round(consumed.calories + calVal)}/{targets.calories}</Text>
            </View>
          </View>

          {/* ═══ 4. Macronutrients Grid (3 Columns) ═══ */}
          <View style={s.gridRow}>
            {/* Protein */}
            <View style={s.macroTile}>
              <CircularRing percentage={proteinPct} size={54} strokeWidth={5} color="#78C800" trackColor="#EFECE6">
                <Text style={s.ringPctText}>{proteinPct}%</Text>
              </CircularRing>
              <Text style={s.macroLabel}>PROTEIN</Text>
              <Text style={s.macroSubVal}>{proteinPct}%</Text>
              <Text style={s.macroGoalText}>of {targets.protein}g goal</Text>
            </View>

            {/* Carbs */}
            <View style={s.macroTile}>
              <CircularRing percentage={carbsPct} size={54} strokeWidth={5} color="#818CF8" trackColor="#EFECE6">
                <Text style={s.ringPctText}>{carbsPct}%</Text>
              </CircularRing>
              <Text style={s.macroLabel}>CARBS</Text>
              <Text style={s.macroSubVal}>{carbsPct}%</Text>
              <Text style={s.macroGoalText}>of {targets.carbs}g goal</Text>
            </View>

            {/* Fat */}
            <View style={s.macroTile}>
              <CircularRing percentage={fatPct} size={54} strokeWidth={5} color="#F87171" trackColor="#EFECE6">
                <Text style={s.ringPctText}>{fatPct}%</Text>
              </CircularRing>
              <Text style={s.macroLabel}>FAT</Text>
              <Text style={s.macroSubVal}>{fatPct}%</Text>
              <Text style={s.macroGoalText}>of {targets.fat}g goal</Text>
            </View>
          </View>

          {/* ═══ 5. Micronutrients Grid (3 Columns) ═══ */}
          <View style={[s.gridRow, { marginTop: 10 }]}>
            {/* Fiber */}
            <View style={s.macroTile}>
              <CircularRing percentage={fiberPct} size={50} strokeWidth={4.5} color="#34D399" trackColor="#EFECE6">
                <Text style={s.ringMicroVal}>{fiberVal}g</Text>
              </CircularRing>
              <Text style={s.macroLabel}>FIBER</Text>
              <Text style={s.macroGoalText}>of {targets.fiber}g goal</Text>
            </View>

            {/* Sugar */}
            <View style={s.macroTile}>
              <CircularRing percentage={sugarPct} size={50} strokeWidth={4.5} color="#FBBF24" trackColor="#EFECE6">
                <Text style={s.ringMicroVal}>{sugarVal}g</Text>
              </CircularRing>
              <Text style={s.macroLabel}>SUGAR</Text>
              <Text style={s.macroGoalText}>of {targets.sugar}g limit</Text>
            </View>

            {/* Sodium */}
            <View style={s.macroTile}>
              <CircularRing percentage={sodiumPct} size={50} strokeWidth={4.5} color="#60A5FA" trackColor="#EFECE6">
                <Text style={s.ringMicroVal}>{sodiumVal}</Text>
              </CircularRing>
              <Text style={s.macroLabel}>SODIUM</Text>
              <Text style={s.macroGoalText}>of {targets.sodium}mg limit</Text>
            </View>
          </View>

          {/* ═══ 6. Logged As (Meal Type Picker) ═══ */}
          <View style={[s.cardBox, { marginTop: 14 }]}>
            <Text style={s.cardBoxHeader}>LOG MEAL AS</Text>
            <View style={s.mealTypeRow}>
              {[
                { key: 'breakfast', label: 'Breakfast', icon: Sun },
                { key: 'lunch', label: 'Lunch', icon: Utensils },
                { key: 'dinner', label: 'Dinner', icon: Moon },
                { key: 'snack', label: 'Snack', icon: Coffee },
              ].map(({ key, label, icon: IconComponent }) => {
                const active = selectedMealType === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.typeChip, active && s.typeChipActive]}
                    onPress={() => setSelectedMealType(key)}
                    activeOpacity={0.7}
                  >
                    <IconComponent size={14} color={active ? '#1C1C24' : '#8A857B'} />
                    <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ═══ 7. Detected Ingredients ═══ */}
          {n.ingredients && n.ingredients.length > 0 && (
            <View style={[s.cardBox, { marginTop: 12 }]}>
              <Text style={s.cardBoxHeader}>DETECTED INGREDIENTS</Text>
              <View style={s.ingredRow}>
                {n.ingredients.map((ing, idx) => (
                  <View key={idx} style={s.ingredChip}>
                    <Text style={s.ingredChipText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ═══ 8. Log Meal Action Button ═══ */}
          <TouchableOpacity
            style={[s.mainActionBtn, logged && s.mainActionBtnDone, isLogging && { opacity: 0.7 }]}
            onPress={handleLogMeal}
            disabled={isLogging || logged}
            activeOpacity={0.85}
          >
            {isLogging ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : logged ? (
              <View style={s.btnContent}>
                <Check size={20} color="#FFFFFF" strokeWidth={3} />
                <Text style={s.mainActionBtnText}>Meal Logged to Dashboard</Text>
              </View>
            ) : (
              <Text style={s.mainActionBtnText}>Log Meal to Dashboard</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F5',
  },
  scroll: {
    flex: 1,
  },
  errText: {
    color: '#8A857B',
    fontSize: 16,
    textAlign: 'center',
  },

  /* Top Food Image Banner */
  imageBannerContainer: {
    height: height * 0.42,
    width: width,
    position: 'relative',
    backgroundColor: '#1C1C24',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  floatingBackBtn: {
    position: 'absolute',
    left: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  nutriBadgeContainer: {
    position: 'absolute',
    bottom: 36,
    right: 18,
    backgroundColor: 'rgba(18, 18, 24, 0.88)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nutriBadgeLetter: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  nutriBadgeTextWrap: {
    justifyContent: 'center',
  },
  nutriBadgeHeader: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  nutriBadgeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 1,
  },

  /* Sliding White Card Sheet */
  sheetCard: {
    backgroundColor: '#FAF9F5',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4D0C7',
    alignSelf: 'center',
    marginBottom: 16,
  },
  identifiedTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A857B',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  dishTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#1C1C24',
    lineHeight: 29,
    marginBottom: 18,
  },

  /* Summary Card Boxes */
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  calRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  calStats: {
    flex: 1,
  },
  calNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  calMainNum: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1C1C24',
    letterSpacing: -0.5,
  },
  calKcalUnit: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666666',
  },
  calGoalDesc: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },

  /* Dual Progress Track Bar */
  barTrackContainer: {
    height: 6,
    backgroundColor: '#EFECE6',
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 8,
  },
  barTrackConsumed: {
    height: '100%',
    backgroundColor: '#8A857B',
    borderRadius: 3,
  },
  barTrackNewMeal: {
    height: '100%',
    backgroundColor: '#E05A27',
    borderRadius: 3,
  },
  barFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barFooterLeft: {
    fontSize: 11,
    color: '#8A857B',
    fontWeight: '500',
  },
  barFooterCenter: {
    fontSize: 11,
    color: '#E05A27',
    fontWeight: '700',
  },
  barFooterRight: {
    fontSize: 11,
    color: '#1C1C24',
    fontWeight: '700',
  },

  /* Grid Layout (3 Columns) */
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  ringPctText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1C24',
  },
  ringMicroVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C24',
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1C1C24',
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 2,
  },
  macroSubVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A857B',
  },
  macroGoalText: {
    fontSize: 10,
    color: '#8A857B',
    textAlign: 'center',
  },

  /* Logged As Picker */
  cardBoxHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8A857B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF9F5',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  typeChipActive: {
    backgroundColor: '#C8FF00',
    borderColor: '#C8FF00',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A857B',
  },
  typeChipTextActive: {
    color: '#1C1C24',
    fontWeight: '700',
  },

  /* Ingredients */
  ingredRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredChip: {
    backgroundColor: '#FAF9F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  ingredChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#1C1C24',
  },

  /* Main Action Button */
  mainActionBtn: {
    backgroundColor: '#1C1C24',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#1C1C24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainActionBtnDone: {
    backgroundColor: '#16A34A',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainActionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default MealNutritionDetailScreen;
