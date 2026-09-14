import React, { useState, useContext, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DietContext } from '../context/DietContext';

const { width } = Dimensions.get('window');
const LIME = '#C8FF00';
const LIME_DIM = '#A8D600';
const DARK_BG = '#1A1A2E';

const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isToday = (d) => formatDate(d) === formatDate(new Date());
const isSameDay = (a, b) => formatDate(a) === formatDate(b);

const isFuture = (d) => {
  const check = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return check > todayZero;
};

// Generate a range of dates centered around refDate
const getDateRange = (refDate, count = 7) => {
  const d = new Date(refDate);
  const half = Math.floor(count / 2);
  const dates = [];
  for (let i = -half; i <= half; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    dates.push(dd);
  }
  return dates;
};

const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

const MealHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { fetchHistory } = useContext(DietContext);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dateRange = getDateRange(selectedDate, 7);

  const loadMeals = useCallback(async (date) => {
    setLoading(true);
    try {
      const result = await fetchHistory(formatDate(date));
      if (result && result.success && Array.isArray(result.meals)) {
        setMeals(result.meals);
      } else {
        setMeals([]);
      }
    } catch (e) {
      console.error('Error loading meal history:', e);
      setMeals([]);
    } finally {
      setLoading(false);
    }
  }, [fetchHistory]);

  useFocusEffect(useCallback(() => {
    loadMeals(selectedDate);
  }, [selectedDate, loadMeals]));

  const onSelectDate = (date) => {
    if (!isFuture(date)) {
      setSelectedDate(date);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeals(selectedDate);
    setRefreshing(false);
  };

  // Calculate daily totals
  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (Number(m.calories) || 0),
    protein: acc.protein + (Number(m.protein) || 0),
    carbs: acc.carbs + (Number(m.carbs) || 0),
    fat: acc.fat + (Number(m.fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <View style={[s.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME_DIM} colors={[LIME_DIM]} />}
      >
        {/* ═══ Date Strip ═══ */}
        <View style={s.dateStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateScrollContent}>
            {dateRange.map((d, i) => {
              const selected = isSameDay(d, selectedDate);
              const today = isToday(d);
              const future = isFuture(d);
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.dateItem, selected && s.dateItemActive]}
                  onPress={() => onSelectDate(d)}
                  activeOpacity={future ? 1 : 0.7}
                  disabled={future}
                >
                  <Text style={[s.dateNum, selected && s.dateNumActive, future && s.dateFuture]}>
                    {d.getDate()}
                  </Text>
                  {today && <View style={[s.todayDot, selected && s.todayDotActive]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ═══ Section Header ═══ */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Your meal</Text>
          <Text style={s.sectionTotal}>{Math.round(totals.calories)} / 2000 kcal</Text>
        </View>

        {/* ═══ Meal Cards ═══ */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={LIME_DIM} />
            <Text style={s.loadingText}>Loading meals...</Text>
          </View>
        ) : meals.length > 0 ? (
          meals.map((m, i) => (
            <View key={m._id || i} style={s.mealCard}>
              <View style={s.mealCardTop}>
                {/* Meal Icon */}
                <View style={s.mealIconWrap}>
                  <Text style={s.mealEmoji}>{MEAL_ICONS[m.mealType] || '🍽️'}</Text>
                </View>

                {/* Meal Info */}
                <View style={s.mealInfo}>
                  <Text style={s.mealName} numberOfLines={1}>{m.name || 'Unnamed Meal'}</Text>
                  {/* Macro Tags */}
                  <View style={s.macroTags}>
                    <View style={s.macroTag}>
                      <Text style={s.macroTagText}>P {Math.round(Number(m.protein) || 0)}g</Text>
                    </View>
                    <View style={s.macroTag}>
                      <Text style={s.macroTagText}>C {Math.round(Number(m.carbs) || 0)}g</Text>
                    </View>
                    <View style={s.macroTag}>
                      <Text style={s.macroTagText}>F {Math.round(Number(m.fat) || 0)}g</Text>
                    </View>
                  </View>
                </View>

                {/* Calories */}
                <View style={s.mealCalWrap}>
                  <Text style={s.mealCalNum}>{m.calories || 0}</Text>
                  <Text style={s.mealCalUnit}>kcal</Text>
                </View>
              </View>

              {/* Meal time */}
              <View style={s.mealCardBottom}>
                <Text style={s.mealTimeText}>
                  {(m.mealType || 'meal').charAt(0).toUpperCase() + (m.mealType || 'meal').slice(1)}
                  {m.loggedAt ? ' · ' + new Date(m.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
                {m.nutriScore && (
                  <View style={[s.nutriBadge, { backgroundColor: getNutriColor(m.nutriScore) + '20' }]}>
                    <Text style={[s.nutriBadgeText, { color: getNutriColor(m.nutriScore) }]}>Nutri {m.nutriScore}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          /* Empty State */
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🍽️</Text>
            <Text style={s.emptyTitle}>No Meals Logged</Text>
            <Text style={s.emptySub}>
              {isToday(selectedDate)
                ? 'Tap the + button to scan your first meal today'
                : 'No meals were logged on this day'
              }
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const getNutriColor = (score) => {
  const colors = { A: '#16A34A', B: '#2563EB', C: '#F59E0B', D: '#EA580C', E: '#EF4444' };
  return colors[score] || '#94A3B8';
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  // ─ Date Strip ─
  dateStrip: { marginBottom: 20, marginTop: 8 },
  dateScrollContent: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  dateItem: {
    width: 48, height: 64,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8EC',
  },
  dateItemActive: {
    backgroundColor: DARK_BG,
    borderColor: DARK_BG,
  },
  dateNum: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  dateNumActive: { color: '#FFFFFF' },
  dateFuture: { opacity: 0.3 },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: LIME_DIM, marginTop: 4 },
  todayDotActive: { backgroundColor: LIME },

  // ─ Section Header ─
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A2E' },
  sectionTotal: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },

  // ─ Meal Card ─
  mealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  mealCardTop: { flexDirection: 'row', alignItems: 'center' },
  mealIconWrap: {
    width: 48, height: 48,
    borderRadius: 14,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealEmoji: { fontSize: 22 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  macroTags: { flexDirection: 'row', gap: 4 },
  macroTag: {
    backgroundColor: '#F0F0F4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  macroTagText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  mealCalWrap: { alignItems: 'flex-end', marginLeft: 8 },
  mealCalNum: { fontSize: 28, fontWeight: '900', color: '#1A1A2E', letterSpacing: -1 },
  mealCalUnit: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: -2 },

  // Card bottom
  mealCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F7' },
  mealTimeText: { fontSize: 12, fontWeight: '500', color: '#94A3B8' },
  nutriBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  nutriBadgeText: { fontSize: 11, fontWeight: '700' },

  // ─ Loading ─
  loadingWrap: { alignItems: 'center', paddingTop: 60 },
  loadingText: { color: '#94A3B8', fontSize: 14, marginTop: 12 },

  // ─ Empty ─
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#94A3B8', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#C0C0C0', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});

export default MealHistoryScreen;
