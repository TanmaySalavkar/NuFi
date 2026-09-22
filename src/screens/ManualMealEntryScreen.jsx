import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Sparkles, Flame, Dumbbell, Wheat, Droplets } from 'lucide-react-native';
import { DietContext } from '../context/DietContext';
import { SHADOWS } from '../theme';

const LIME = '#C8FF00';
const DARK_BG = '#1A1A2E';
const BG = '#F5F5F7';
const CARD = '#FFFFFF';
const TEXT_PRIMARY = '#1A1A2E';
const TEXT_SEC = '#64748B';
const TEXT_MUTED = '#94A3B8';
const BORDER = '#E8E8EC';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙' },
  { key: 'snack',     label: 'Snack',     emoji: '🍎' },
];

function calculateNutriScore(calories, protein, carbs, fat, fiber = 0, sugar = 0, sodium = 0) {
  let score = 0;
  if (calories > 500) score += 4;
  else if (calories > 300) score += 2;

  if (sugar > 15) score += 4;
  else if (sugar > 8) score += 2;

  if (sodium > 800) score += 4;
  else if (sodium > 400) score += 2;

  if (protein > 20) score -= 3;
  else if (protein > 10) score -= 2;

  if (fiber > 5) score -= 3;
  else if (fiber > 2) score -= 1;

  if (score <= 0) return 'A';
  if (score <= 3) return 'B';
  if (score <= 6) return 'C';
  if (score <= 9) return 'D';
  return 'E';
}

function getNutriColor(grade) {
  switch (grade) {
    case 'A': return '#10B981';
    case 'B': return '#34D399';
    case 'C': return '#FBBF24';
    case 'D': return '#F97316';
    case 'E': return '#EF4444';
    default:  return '#10B981';
  }
}

export default function ManualMealEntryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { logMeal } = useContext(DietContext);

  const [name, setName]               = useState('');
  const [mealType, setMealType]       = useState('lunch');
  const [calories, setCalories]       = useState('');
  const [protein, setProtein]         = useState('');
  const [carbs, setCarbs]             = useState('');
  const [fat, setFat]                 = useState('');
  const [fiber, setFiber]             = useState('');
  const [sugar, setSugar]             = useState('');
  const [sodium, setSodium]           = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calNum = Number(calories) || 0;
  const protNum = Number(protein) || 0;
  const carbNum = Number(carbs) || 0;
  const fatNum = Number(fat) || 0;
  const fibNum = Number(fiber) || 0;
  const sugNum = Number(sugar) || 0;
  const sodNum = Number(sodium) || 0;

  const currentNutriScore = calNum > 0
    ? calculateNutriScore(calNum, protNum, carbNum, fatNum, fibNum, sugNum, sodNum)
    : 'C';

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter a meal name.');
      return;
    }
    if (!calories.trim() || isNaN(calNum) || calNum <= 0) {
      Alert.alert('Missing Calories', 'Please enter an estimated calorie count.');
      return;
    }

    setIsSubmitting(true);
    try {
      const mealData = {
        name: name.trim(),
        mealType,
        calories: calNum,
        protein: protNum,
        carbs: carbNum,
        fat: fatNum,
        fiber: fibNum,
        sugar: sugNum,
        sodium: sodNum,
        nutriScore: currentNutriScore,
        ingredients: [],
      };

      const result = await logMeal(mealData);
      if (result && result.success) {
        navigation.goBack();
      } else {
        Alert.alert('Error', result?.error || 'Failed to save meal.');
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to log meal. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={TEXT_PRIMARY} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Meal Manually</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Meal Name */}
        <View style={s.card}>
          <Text style={s.label}>Meal or Food Name *</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Grilled Salmon Bowl, Protein Shake..."
            placeholderTextColor={TEXT_MUTED}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* Meal Type Pills */}
          <Text style={[s.label, { marginTop: 16 }]}>Meal Type</Text>
          <View style={s.typesGrid}>
            {MEAL_TYPES.map((t) => {
              const active = mealType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.typeChip, active && s.typeChipActive]}
                  onPress={() => setMealType(t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={s.typeEmoji}>{t.emoji}</Text>
                  <Text style={[s.typeLabel, active && s.typeLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Nutrition Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Flame size={18} color="#EA580C" />
              <Text style={s.cardTitle}>Nutrition Breakdown</Text>
            </View>
            <View style={[s.nutriBadge, { backgroundColor: getNutriColor(currentNutriScore) }]}>
              <Text style={s.nutriBadgeText}>Score {currentNutriScore}</Text>
            </View>
          </View>

          {/* Calories (Primary) */}
          <Text style={s.label}>Calories (kcal) *</Text>
          <TextInput
            style={[s.input, s.calInput]}
            placeholder="e.g. 450"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
          />

          {/* Macros Grid */}
          <View style={s.macrosRow}>
            <View style={s.macroCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Dumbbell size={13} color="#2563EB" />
                <Text style={s.macroLabel}>Protein (g)</Text>
              </View>
              <TextInput
                style={s.macroInput}
                placeholder="0"
                placeholderTextColor={TEXT_MUTED}
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
              />
            </View>

            <View style={s.macroCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Wheat size={13} color="#D97706" />
                <Text style={s.macroLabel}>Carbs (g)</Text>
              </View>
              <TextInput
                style={s.macroInput}
                placeholder="0"
                placeholderTextColor={TEXT_MUTED}
                keyboardType="numeric"
                value={carbs}
                onChangeText={setCarbs}
              />
            </View>

            <View style={s.macroCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Droplets size={13} color="#16A34A" />
                <Text style={s.macroLabel}>Fat (g)</Text>
              </View>
              <TextInput
                style={s.macroInput}
                placeholder="0"
                placeholderTextColor={TEXT_MUTED}
                keyboardType="numeric"
                value={fat}
                onChangeText={setFat}
              />
            </View>
          </View>

          {/* Optional nutrients toggle */}
          <TouchableOpacity
            style={s.toggleAdv}
            onPress={() => setShowAdvanced(!showAdvanced)}
            activeOpacity={0.7}
          >
            <Sparkles size={14} color={TEXT_SEC} />
            <Text style={s.toggleAdvText}>
              {showAdvanced ? 'Hide micronutrients' : '+ Add fiber, sugar, sodium'}
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={s.advRow}>
              <View style={s.macroCol}>
                <Text style={s.macroLabel}>Fiber (g)</Text>
                <TextInput
                  style={s.macroInput}
                  placeholder="0"
                  placeholderTextColor={TEXT_MUTED}
                  keyboardType="numeric"
                  value={fiber}
                  onChangeText={setFiber}
                />
              </View>
              <View style={s.macroCol}>
                <Text style={s.macroLabel}>Sugar (g)</Text>
                <TextInput
                  style={s.macroInput}
                  placeholder="0"
                  placeholderTextColor={TEXT_MUTED}
                  keyboardType="numeric"
                  value={sugar}
                  onChangeText={setSugar}
                />
              </View>
              <View style={s.macroCol}>
                <Text style={s.macroLabel}>Sodium (mg)</Text>
                <TextInput
                  style={s.macroInput}
                  placeholder="0"
                  placeholderTextColor={TEXT_MUTED}
                  keyboardType="numeric"
                  value={sodium}
                  onChangeText={setSodium}
                />
              </View>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[s.submitBtn, (!name.trim() || !calories.trim() || isSubmitting) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!name.trim() || !calories.trim() || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={DARK_BG} />
          ) : (
            <>
              <Check size={18} color={DARK_BG} strokeWidth={2.8} />
              <Text style={s.submitBtnText}>Save to Diary</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    ...SHADOWS.soft,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerTitle: { fontSize: 17, fontWeight: '900', color: TEXT_PRIMARY },

  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SEC,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: BG,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: BORDER,
  },
  calInput: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK_BG,
    marginBottom: 14,
  },

  typesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  typeChipActive: {
    backgroundColor: DARK_BG,
    borderColor: DARK_BG,
  },
  typeEmoji: { fontSize: 18, marginBottom: 2 },
  typeLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SEC },
  typeLabelActive: { color: LIME },

  macrosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroCol: {
    flex: 1,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SEC,
  },
  macroInput: {
    backgroundColor: BG,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },

  toggleAdv: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
  },
  toggleAdvText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SEC,
  },
  advRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  nutriBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nutriBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIME,
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 6,
    ...SHADOWS.soft,
  },
  submitBtnDisabled: {
    backgroundColor: '#E2E8F0',
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: DARK_BG,
  },
});
