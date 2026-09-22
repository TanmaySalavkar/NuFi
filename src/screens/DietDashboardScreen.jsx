import React, { useContext, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, RefreshControl, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { DietContext } from '../context/DietContext';
import { HealthConnectContext } from '../context/HealthConnectContext';
import {
  Footprints, Activity, Flame, Heart, Moon, Utensils, ChevronRight,
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ── Circular Progress Ring (Vector SVG, 12 o'clock clockwise) ──────────
const CircleProgress = ({ size, strokeWidth, progress, color, bgColor, children }) => {
  const p = Math.min(Math.max(progress, 0), 1);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const strokeDashoffset = c * (1 - p);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={bgColor || 'rgba(255,255,255,0.15)'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        )}
      </Svg>
      {children}
    </View>
  );
};

// ── NuFi Colors ──────────────────────────────────────
const LIME = '#C8FF00';
const LIME_DIM = '#A8D600';
const DARK_BG = '#1A1A2E';
const CARD_BG = '#FFFFFF';

const DietDashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const { dashboard = {}, fetchDashboard = () => {} } = useContext(DietContext) || {};
  const [refreshing, setRefreshing] = useState(false);
  const hcContext = useContext(HealthConnectContext) || {};
  const {
    isConnected = false,
    latest = {},
    dailySummaries = [],
    today: todayData = {},
    syncNow = async () => {},
  } = hcContext;

  // Current day index (Mon=0 ... Sun=6)
  const today = new Date();
  const activeDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const lastFocusSyncRef = useRef(0);

  useFocusEffect(useCallback(() => {
    // Delay so the navigation animation (300ms) finishes before hitting the network
    const timer = setTimeout(() => {
      fetchDashboard();
      const now = Date.now();
      if (isConnected && now - lastFocusSyncRef.current > 60000) {
        lastFocusSyncRef.current = now;
        syncNow({ silent: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [fetchDashboard, isConnected, syncNow]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDashboard({ force: true }),
      isConnected ? syncNow() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const targets = dashboard.targets || { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };
  const consumed = dashboard.consumed || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  const meals = Array.isArray(dashboard.meals) ? dashboard.meals : [];
  const healthScore = Number(dashboard.healthScore) || 0;
  const userName = dashboard.userName || '';
  const calPct = targets.calories > 0 ? (Number(consumed.calories) || 0) / targets.calories : 0;
  const bottomInset = Math.max(insets.bottom + 16, 24);

  // ── Health Connect / Google Fit Meaningful Metrics (Today's Totals) ──
  const now = new Date();
  const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const todaySummary = Array.isArray(dailySummaries)
    ? (dailySummaries.find(d => d.date === localTodayStr) || dailySummaries[dailySummaries.length - 1])
    : null;

  // 1. Steps: total accumulated today
  const stepsVal = (typeof todayData?.steps === 'number' && todayData.steps > 0)
    ? todayData.steps
    : (typeof todaySummary?.steps === 'number' && todaySummary.steps > 0)
    ? todaySummary.steps
    : (typeof todayData?.steps === 'number' ? todayData.steps : null);
  const stepsDisplay = stepsVal != null ? Math.round(stepsVal).toLocaleString() : (isConnected ? '0' : '—');
  const stepsGoal = 10000;
  const stepsProgress = stepsVal ? Math.min(stepsVal / stepsGoal, 1) : 0;

  // 2. Calories Burned: Total burned today (matching Google Fit's "Cal" display)
  // Google Fit tracks Total Calories = Basal Metabolic Rate (BMR) so far + Active movement
  const userWeight = Number(dashboard?.profile?.weight) || Number(user?.profile?.weight) || 75;
  const userHeight = Number(dashboard?.profile?.height) || Number(user?.profile?.height) || 170;
  const userAge = Number(dashboard?.profile?.age) || Number(user?.profile?.age) || 22;
  const dailyBMR = Math.round((10 * userWeight) + (6.25 * userHeight) - (5 * userAge) + 5);

  const hoursElapsed = now.getHours() + (now.getMinutes() / 60);
  const bmrBurnedSoFar = Math.round(dailyBMR * (hoursElapsed / 24));
  const activeCaloriesFromSteps = Math.round((stepsVal || 0) * 0.04);
  const activeBurn = (todayData?.active_calories && todayData.active_calories > 0)
    ? todayData.active_calories
    : (todaySummary?.active_calories && todaySummary.active_calories > 0)
    ? todaySummary.active_calories
    : activeCaloriesFromSteps;

  const totalCaloriesBurned = (typeof todayData?.total_calories === 'number' && todayData.total_calories > 0)
    ? todayData.total_calories
    : (typeof todaySummary?.total_calories === 'number' && todaySummary.total_calories > 0)
    ? todaySummary.total_calories
    : (bmrBurnedSoFar + activeBurn);

  const caloriesDisplay = isConnected ? totalCaloriesBurned.toLocaleString() : '—';

  // 3. Heart Rate: latest or average
  const hrVal = (typeof todayData?.avg_heart_rate === 'number' && todayData.avg_heart_rate > 0)
    ? todayData.avg_heart_rate
    : (typeof todayData?.resting_heart_rate === 'number' && todayData.resting_heart_rate > 0)
    ? todayData.resting_heart_rate
    : (typeof latest?.heart_rate?.value === 'number' ? latest.heart_rate.value : null)
    ?? (typeof latest?.resting_heart_rate?.value === 'number' ? latest.resting_heart_rate.value : null)
    ?? todaySummary?.avg_heart_rate
    ?? todaySummary?.resting_heart_rate;
  const hrDisplay = hrVal != null && hrVal > 0 ? Math.round(hrVal) : '—';

  // 4. Sleep Duration: total duration tracked (today, last night, or latest)
  const sleepMinutes = (() => {
    if (typeof todayData?.sleep_minutes === 'number' && todayData.sleep_minutes > 0) {
      return todayData.sleep_minutes;
    }
    if (typeof todaySummary?.sleep_minutes === 'number' && todaySummary.sleep_minutes > 0) {
      return todaySummary.sleep_minutes;
    }
    if (typeof latest?.sleep?.value === 'number' && latest.sleep.value > 0) {
      return latest.sleep.value;
    }
    if (Array.isArray(dailySummaries)) {
      for (let i = dailySummaries.length - 1; i >= 0; i--) {
        if (dailySummaries[i]?.sleep_minutes && dailySummaries[i].sleep_minutes > 0) {
          return dailySummaries[i].sleep_minutes;
        }
      }
    }
    return null;
  })();

  const formatSleepDuration = (mins) => {
    if (mins == null || mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
  };
  const sleepDisplay = formatSleepDuration(sleepMinutes);

  return (
    <View style={[s.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME_DIM} colors={[LIME_DIM]} />}
      >
        {/* ═══ Header ═══ */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.brandName}>NuFi</Text>
            <Text style={s.streakBadge}> ⚡ 1</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={s.avatarCircle}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <Text style={s.avatarText}>{(userName || user?.name || 'U')[0].toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ Daily Score Card (Dark) ═══ */}
        <View style={s.scoreCard}>
          <View style={s.scoreTop}>
            <View style={s.scoreLeft}>
              <Text style={s.scoreLabel}>DAILY SCORE</Text>
              <View style={s.scoreValRow}>
                <Text style={s.scoreNum}>{healthScore}</Text>
                <Text style={s.scoreOf}>/100</Text>
              </View>
              <Text style={s.scoreSub}>Nutrition · Activity · Balance</Text>
            </View>
            <CircleProgress size={64} strokeWidth={5} progress={healthScore / 100} color={LIME} bgColor="rgba(255,255,255,0.12)">
              <Text style={s.scoreRingText}>{Math.round(healthScore)}%</Text>
            </CircleProgress>
          </View>

          {/* Week Strip with scores below each day */}
          <View style={s.weekRow}>
            {DAYS.map((d, i) => {
              const isActive = activeDay === i;
              const weekScores = dashboard.weekScores || [];
              const scoreVal = weekScores[i];
              const displayScore = (scoreVal !== undefined && scoreVal !== null && scoreVal > 0)
                ? scoreVal
                : (isActive && healthScore > 0 ? healthScore : '-');

              return (
                <View key={i} style={s.weekColWrap}>
                  <View style={[s.weekDayCol, isActive && s.weekDayActive]}>
                    <Text style={[s.weekDayText, isActive && s.weekDayTextActive]}>{d}</Text>
                  </View>
                  <Text style={[s.weekScoreText, isActive && s.weekScoreTextActive]}>
                    {displayScore}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ═══ Calories Card (Lime Green) ═══ */}
        <View style={s.calCard}>
          <View style={s.calHeader}>
            <View>
              <Text style={s.calTitle}>Calories</Text>
              <View style={s.calValRow}>
                <Text style={s.calNum}>{Math.round(consumed.calories).toLocaleString()}</Text>
                <Text style={s.calOf}>/{targets.calories.toLocaleString()} kcal</Text>
              </View>
            </View>
            <CircleProgress size={56} strokeWidth={4} progress={Math.min(calPct, 1)} color={DARK_BG} bgColor="rgba(0,0,0,0.12)">
              <Text style={s.calRingText}>{Math.round(calPct * 100)}%</Text>
            </CircleProgress>
          </View>

          {/* Macros Grid */}
          <View style={s.macroGrid}>
            <View style={s.macroCell}>
              <Text style={s.macroName}>Protein</Text>
              <Text style={s.macroVal}>{Math.round(consumed.protein)}<Text style={s.macroTarget}>/{targets.protein}g</Text></Text>
            </View>
            <View style={s.macroCell}>
              <Text style={s.macroName}>Carbs</Text>
              <Text style={s.macroVal}>{Math.round(consumed.carbs)}<Text style={s.macroTarget}>/{targets.carbs}g</Text></Text>
            </View>
            <View style={s.macroCell}>
              <Text style={s.macroName}>Fat</Text>
              <Text style={s.macroVal}>{Math.round(consumed.fat)}<Text style={s.macroTarget}>/{targets.fat}g</Text></Text>
            </View>
            <View style={s.macroCell}>
              <Text style={s.macroName}>Sugar</Text>
              <Text style={s.macroVal}>{Math.round(consumed.sugar)}<Text style={s.macroTarget}>/{targets.sugar}g</Text></Text>
            </View>
            <View style={s.macroCell}>
              <Text style={s.macroName}>Fiber</Text>
              <Text style={s.macroVal}>{Math.round(consumed.fiber)}<Text style={s.macroTarget}>/{targets.fiber}g</Text></Text>
            </View>
            <View style={s.macroCell}>
              <Text style={s.macroName}>Sodium</Text>
              <Text style={s.macroVal}>{Math.round(consumed.sodium)}<Text style={s.macroTarget}>/{targets.sodium}mg</Text></Text>
            </View>
          </View>
        </View>

        {/* ═══ Activity & Biometrics Section (Health Connect) ═══ */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeaderLeft}>
            <Activity size={18} color="#10B981" strokeWidth={2.5} />
            <Text style={s.sectionMainTitle}>Activity & Biometrics</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
            style={[s.hcStatusPill, isConnected ? s.hcStatusPillConnected : s.hcStatusPillDisconnected]}
          >
            <View style={[s.hcStatusDot, { backgroundColor: isConnected ? '#10B981' : '#94A3B8' }]} />
            <Text style={[s.hcStatusText, { color: isConnected ? '#059669' : '#64748B' }]}>
              {isConnected ? 'Fit Synced' : 'Connect Fit'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.biometricGrid}>
          {/* Steps Tile */}
          <View style={s.metricCard}>
            <View style={s.metricTopRow}>
              <View style={[s.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Footprints size={15} color="#10B981" strokeWidth={2.5} />
              </View>
              <Text style={s.metricLabel}>STEPS</Text>
            </View>
            <View style={s.metricValRow}>
              <Text style={s.metricVal}>{stepsDisplay}</Text>
            </View>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: `${Math.round(stepsProgress * 100)}%`, backgroundColor: '#10B981' }]} />
            </View>
            <Text style={s.metricSub}>Goal: {stepsGoal.toLocaleString()}</Text>
          </View>

          {/* Calories Burned Tile */}
          <View style={s.metricCard}>
            <View style={s.metricTopRow}>
              <View style={[s.metricIconWrap, { backgroundColor: '#FFF7ED' }]}>
                <Flame size={15} color="#F97316" strokeWidth={2.5} />
              </View>
              <Text style={s.metricLabel}>CALORIES</Text>
            </View>
            <View style={s.metricValRow}>
              <Text style={s.metricVal}>{caloriesDisplay}</Text>
              {caloriesDisplay !== '—' && <Text style={s.metricUnit}>kcal</Text>}
            </View>
            <Text style={[s.metricSub, { marginTop: 12 }]}>Total burned today</Text>
          </View>

          {/* Heart Rate Tile */}
          <View style={s.metricCard}>
            <View style={s.metricTopRow}>
              <View style={[s.metricIconWrap, { backgroundColor: '#FFF1F2' }]}>
                <Heart size={15} color="#F43F5E" strokeWidth={2.5} />
              </View>
              <Text style={s.metricLabel}>HEART RATE</Text>
            </View>
            <View style={s.metricValRow}>
              <Text style={s.metricVal}>{hrDisplay}</Text>
              {hrDisplay !== '—' && <Text style={s.metricUnit}>bpm</Text>}
            </View>
            <Text style={[s.metricSub, { marginTop: 12 }]}>Resting / Latest</Text>
          </View>

          {/* Sleep Tile */}
          <View style={s.metricCard}>
            <View style={s.metricTopRow}>
              <View style={[s.metricIconWrap, { backgroundColor: '#F5F3FF' }]}>
                <Moon size={15} color="#8B5CF6" strokeWidth={2.5} />
              </View>
              <Text style={s.metricLabel}>SLEEP</Text>
            </View>
            <View style={s.metricValRow}>
              <Text style={s.metricVal}>{sleepDisplay}</Text>
            </View>
            <Text style={[s.metricSub, { marginTop: 12 }]}>Duration tracked</Text>
          </View>
        </View>

        {/* ═══ Meals Section (Bottom Full-Width Card) ═══ */}
        <View style={s.mealsCard}>
          <View style={s.mealsHeader}>
            <View>
              <Text style={s.mealsTitle}>Today's Meals</Text>
              <Text style={s.mealsSubtitle}>
                {meals.length > 0 ? `${meals.length} logged today` : 'No meals logged yet'}
              </Text>
            </View>
            <TouchableOpacity
              style={s.viewHistoryBtn}
              onPress={() => navigation.navigate('MealHistory')}
              activeOpacity={0.7}
            >
              <Text style={s.viewHistoryText}>View History</Text>
              <ChevronRight size={14} color="#1A1A2E" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {meals.length > 0 ? (
            <View style={s.mealsList}>
              {meals.map((m, i) => {
                const mealColor = m.mealType === 'breakfast'
                  ? '#F59E0B'
                  : m.mealType === 'lunch'
                  ? '#3B82F6'
                  : m.mealType === 'dinner'
                  ? '#8B5CF6'
                  : '#10B981';

                return (
                  <View key={m._id || i} style={[s.mealItem, i === meals.length - 1 && s.mealItemLast]}>
                    <View style={[s.mealDot, { backgroundColor: mealColor }]} />
                    <View style={s.mealInfo}>
                      <Text style={s.mealName} numberOfLines={1}>{m.name || 'Meal'}</Text>
                      <Text style={s.mealTypeLabel}>
                        {(m.mealType || 'meal').toUpperCase()}
                      </Text>
                    </View>
                    <View style={s.mealCalBadge}>
                      <Text style={s.mealCalNum}>{Math.round(m.calories || 0)}</Text>
                      <Text style={s.mealCalUnit}>kcal</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <TouchableOpacity
              style={s.emptyMealsBox}
              onPress={() => navigation.navigate('FoodScanner')}
              activeOpacity={0.8}
            >
              <View style={s.emptyMealsIconWrap}>
                <Utensils size={20} color="#94A3B8" strokeWidth={2} />
              </View>
              <Text style={s.emptyMealsTitle}>No meals logged today</Text>
              <Text style={s.emptyMealsSub}>Tap to scan or log your food</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  // ─ Header ─
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 16, paddingHorizontal: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  brandName: { fontSize: 28, fontWeight: '900', color: '#1A1A2E', letterSpacing: -0.5 },
  streakBadge: { fontSize: 16, fontWeight: '700', color: '#F59E0B', marginLeft: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8E8EC', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#1A1A2E', fontSize: 16, fontWeight: '800' },

  // ─ Daily Score Card (Dark) ─
  scoreCard: {
    backgroundColor: DARK_BG,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  scoreTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  scoreLeft: { flex: 1 },
  scoreLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 6 },
  scoreValRow: { flexDirection: 'row', alignItems: 'baseline' },
  scoreNum: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: -2 },
  scoreOf: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginLeft: 2 },
  scoreSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  scoreRingText: { fontSize: 13, fontWeight: '800', color: LIME },

  // Week strip inside dark card
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 4 },
  weekColWrap: { alignItems: 'center', width: 38 },
  weekDayCol: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  weekDayActive: { backgroundColor: LIME },
  weekDayText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  weekDayTextActive: { color: DARK_BG },
  weekScoreText: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.4)', marginTop: 6 },
  weekScoreTextActive: { color: LIME },

  // ─ Calories Card (Lime Green) ─
  calCard: {
    backgroundColor: LIME,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  calTitle: { fontSize: 16, fontWeight: '700', color: DARK_BG, opacity: 0.7, marginBottom: 4 },
  calValRow: { flexDirection: 'row', alignItems: 'baseline' },
  calNum: { fontSize: 44, fontWeight: '900', color: DARK_BG, letterSpacing: -1.5 },
  calOf: { fontSize: 14, fontWeight: '600', color: 'rgba(26,26,46,0.45)', marginLeft: 2 },
  calRingText: { fontSize: 11, fontWeight: '800', color: DARK_BG },

  // Macros grid inside lime card
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  macroCell: {
    width: (width - 72) / 2,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,26,46,0.1)',
  },
  macroName: { fontSize: 13, fontWeight: '600', color: 'rgba(26,26,46,0.55)' },
  macroVal: { fontSize: 18, fontWeight: '800', color: DARK_BG, marginTop: 2 },
  macroTarget: { fontSize: 13, fontWeight: '500', color: 'rgba(26,26,46,0.4)' },

  // ─ Activity & Biometrics Section ─
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionMainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.2,
  },
  hcStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  hcStatusPillConnected: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  hcStatusPillDisconnected: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hcStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hcStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Biometric 2x2 Grid
  biometricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    width: (width - 42) / 2,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  metricSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
  },

  // ─ Meals Full-Width Card (Bottom) ─
  mealsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mealsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  mealsSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  viewHistoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  mealsList: {
    gap: 0,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  mealItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  mealDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  mealTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  mealCalBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mealCalNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  mealCalUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptyMealsBox: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyMealsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyMealsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  emptyMealsSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default DietDashboardScreen;
