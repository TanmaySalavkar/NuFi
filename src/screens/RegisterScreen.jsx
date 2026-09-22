import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { HealthConnectContext } from '../context/HealthConnectContext';
import { AlertIcon, EyeIcon, EyeOffIcon } from '../components/Icons';

const LIME = '#C8FF00';
const DARK_BG = '#1A1A2E';

const GOALS = [
  { key: 'lose', label: 'Lose Weight', icon: '🔥', desc: 'Calorie deficit for fat loss' },
  { key: 'maintain', label: 'Maintain', icon: '⚖️', desc: 'Stay at your current weight' },
  { key: 'gain', label: 'Gain Muscle', icon: '💪', desc: 'Calorie surplus for growth' },
];
const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

const StepIndicator = ({ current, total }) => (
  <View style={st.stepRow}>
    {Array.from({ length: total }, (_, i) => (
      <View key={i} style={[st.stepDot, i === current && st.stepDotActive, i < current && st.stepDotCompleted]}>
        {i < current ? (
          <Text style={st.stepCheck}>✓</Text>
        ) : (
          <Text style={[st.stepNum, i === current && st.stepNumActive]}>{i + 1}</Text>
        )}
      </View>
    ))}
    <View style={st.stepLine} />
  </View>
);

const HEALTH_METRICS = [
  { emoji: '👣', label: 'Steps & Distance' },
  { emoji: '❤️', label: 'Heart Rate & HRV' },
  { emoji: '💤', label: 'Sleep Duration' },
  { emoji: '🏃', label: 'Exercise & Calories' },
  { emoji: '⚖️', label: 'Weight & Body Fat' },
  { emoji: '🩸', label: 'Blood Glucose & BP' },
  { emoji: '💧', label: 'Hydration' },
  { emoji: '🫧', label: 'Oxygen Saturation' },
];

const RegisterScreen = ({ navigation }) => {
  const { register } = useContext(AuthContext);
  const healthConnect = useContext(HealthConnectContext);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('25');
  const [weight, setWeight] = useState('70');
  const [height, setHeight] = useState('170');
  const [gender, setGender] = useState('male');
  const [goal, setGoal] = useState('maintain');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hcConnecting, setHcConnecting] = useState(false);
  // Focus states
  const [nameFocus, setNameFocus] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);

  const handleNext = () => {
    setError('');
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!password.trim()) { setError('Please enter a password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setStep(1);
  };

  const handleHealthProfileNext = () => {
    setError('');
    const ageNum = Number(age);
    const weightNum = Number(weight);
    const heightNum = Number(height);
    if (!ageNum || ageNum < 10 || ageNum > 120) { setError('Please enter a valid age (10-120).'); return; }
    if (!weightNum || weightNum < 20 || weightNum > 300) { setError('Please enter a valid weight (20-300 kg).'); return; }
    if (!heightNum || heightNum < 100 || heightNum > 250) { setError('Please enter a valid height (100-250 cm).'); return; }
    setStep(2);
  };

  const handleRegister = async (withHealthConnect = false) => {
    setError('');
    setIsLoading(true);
    try {
      const result = await register({
        name: name.trim(), email: email.trim().toLowerCase(), password,
        profile: { age: Number(age), weight: Number(weight), height: Number(height), gender, goal, activityLevel: 'moderate' },
      });
      if (!result.success) {
        setError(result.error || 'Registration failed.');
        setStep(1);
      }
      // Health Connect request happens after successful register (user is now authenticated)
    } catch (e) {
      setError('An unexpected error occurred. Please try again.');
      setStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectAndFinish = async () => {
    setHcConnecting(true);
    try {
      if (healthConnect?.requestAccess) {
        await healthConnect.requestAccess();
      }
    } catch (_) {}
    setHcConnecting(false);
    await handleRegister(true);
  };

  const handleSkipHealthConnect = async () => {
    await handleRegister(false);
  };

  const renderStep1 = () => (
    <>
      <Text style={s.cardTitle}>Create Your Account</Text>
      {/* <Text style={s.cardSub}>Enter your details to get started with personalized nutrition tracking</Text> */}

      {error ? (
        <View style={s.errBox}>
          <AlertIcon size={16} color="#EF4444" />
          <Text style={s.errText}>{error}</Text>
        </View>
      ) : null}

      <Text style={s.label}>Full Name</Text>
      <View style={[s.inputWrap, nameFocus && s.inputFocused]}>
        <TextInput
          style={s.input} placeholder="Enter your full name" placeholderTextColor="#94A3B8"
          value={name} onChangeText={setName}
          onFocus={() => setNameFocus(true)} onBlur={() => setNameFocus(false)}
          autoCorrect={false}
        />
      </View>

      <Text style={s.label}>Email Address</Text>
      <View style={[s.inputWrap, emailFocus && s.inputFocused]}>
        <TextInput
          style={s.input} placeholder="you@example.com" placeholderTextColor="#94A3B8"
          value={email} onChangeText={setEmail}
          onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        />
      </View>

      <Text style={s.label}>Password</Text>
      <View style={[s.inputWrap, passFocus && s.inputFocused]}>
        <TextInput
          style={s.input} placeholder="Min 6 characters" placeholderTextColor="#94A3B8"
          value={password} onChangeText={setPassword}
          onFocus={() => setPassFocus(true)} onBlur={() => setPassFocus(false)}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {showPassword ? (
            <EyeIcon size={22} color={DARK_BG} />
          ) : (
            <EyeOffIcon size={22} color="#94A3B8" />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.primaryBtn} onPress={handleNext} activeOpacity={0.85}>
        <Text style={s.primaryBtnText}>Continue</Text>
        <Text style={s.primaryBtnArrow}>→</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      <TouchableOpacity
        style={s.topBackBtn}
        onPress={() => { setStep(0); setError(''); }}
        activeOpacity={0.7}
      >
        <Text style={s.topBackBtnText}>← Back</Text>
      </TouchableOpacity>

      <Text style={s.cardTitle}>Health Profile</Text>
      <Text style={s.cardSub}>Help us calculate your ideal daily nutrition targets</Text>

      {error ? (
        <View style={s.errBox}>
          <AlertIcon size={16} color="#EF4444" />
          <Text style={s.errText}>{error}</Text>
        </View>
      ) : null}

      {/* Body Metrics */}
      <Text style={s.sectionLabel}>Body Metrics</Text>
      <View style={s.metricsRow}>
        <View style={s.metricCol}>
          <Text style={s.metricLabel}>Age</Text>
          <View style={s.metricInput}>
            <TextInput style={s.metricValue} value={age} onChangeText={setAge} keyboardType="numeric" maxLength={3} />
            <Text style={s.metricUnit}>yrs</Text>
          </View>
        </View>
        <View style={s.metricCol}>
          <Text style={s.metricLabel}>Weight</Text>
          <View style={s.metricInput}>
            <TextInput style={s.metricValue} value={weight} onChangeText={setWeight} keyboardType="numeric" maxLength={3} />
            <Text style={s.metricUnit}>kg</Text>
          </View>
        </View>
        <View style={s.metricCol}>
          <Text style={s.metricLabel}>Height</Text>
          <View style={s.metricInput}>
            <TextInput style={s.metricValue} value={height} onChangeText={setHeight} keyboardType="numeric" maxLength={3} />
            <Text style={s.metricUnit}>cm</Text>
          </View>
        </View>
      </View>

      {/* Gender */}
      <Text style={s.sectionLabel}>Gender</Text>
      <View style={s.genderRow}>
        {GENDERS.map(g => (
          <TouchableOpacity
            key={g.key}
            style={[s.genderChip, gender === g.key && s.genderChipActive]}
            onPress={() => setGender(g.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.genderText, gender === g.key && s.genderTextActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Goal */}
      <Text style={s.sectionLabel}>Your Goal</Text>
      {GOALS.map(g => (
        <TouchableOpacity
          key={g.key}
          style={[s.goalCard, goal === g.key && s.goalCardActive]}
          onPress={() => setGoal(g.key)}
          activeOpacity={0.7}
        >
          <Text style={s.goalIcon}>{g.icon}</Text>
          <View style={s.goalInfo}>
            <Text style={[s.goalLabel, goal === g.key && s.goalLabelActive]}>{g.label}</Text>
            <Text style={s.goalDesc}>{g.desc}</Text>
          </View>
          <View style={[s.goalRadio, goal === g.key && s.goalRadioActive]}>
            {goal === g.key && <View style={s.goalRadioDot} />}
          </View>
        </TouchableOpacity>
      ))}

      {/* Next: Health Connect Step */}
      <TouchableOpacity
        style={[s.primaryBtn, { marginTop: 22 }]}
        onPress={handleHealthProfileNext}
        activeOpacity={0.85}
      >
        <Text style={s.primaryBtnText}>Continue</Text>
        <Text style={s.primaryBtnArrow}>→</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep3 = () => (
    <>
      <TouchableOpacity
        style={s.topBackBtn}
        onPress={() => { setStep(1); setError(''); }}
        activeOpacity={0.7}
      >
        <Text style={s.topBackBtnText}>← Back</Text>
      </TouchableOpacity>

      {/* HC Hero */}
      <View style={hc.hero}>
        <View style={hc.iconRing}>
          <Text style={hc.iconEmoji}>❤️‍🔥</Text>
        </View>
        <Text style={s.cardTitle}>Connect Health Data</Text>
        <Text style={s.cardSub}>Let NuFi read your activity and biometrics to give smarter nutrition advice</Text>
      </View>

      {/* Privacy pill */}
      <View style={hc.privacyPill}>
        <Text style={hc.privacyIcon}>🔒</Text>
        <Text style={hc.privacyText}>Read-only · No background access · Encrypted at rest</Text>
      </View>

      {/* Metrics grid */}
      <View style={hc.metricsGrid}>
        {HEALTH_METRICS.map((m, i) => (
          <View key={i} style={hc.metricChip}>
            <Text style={hc.metricEmoji}>{m.emoji}</Text>
            <Text style={hc.metricText}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Connect button */}
      <TouchableOpacity
        style={[s.primaryBtn, { marginTop: 20 }, (isLoading || hcConnecting) && { opacity: 0.7 }]}
        onPress={handleConnectAndFinish}
        disabled={isLoading || hcConnecting}
        activeOpacity={0.85}
      >
        {(isLoading || hcConnecting) ? (
          <ActivityIndicator size="small" color={LIME} />
        ) : (
          <>
            <Text style={hc.connectIcon}>⚡</Text>
            <Text style={s.primaryBtnText}>Connect Google Health</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Skip */}
      <TouchableOpacity
        style={hc.skipBtn}
        onPress={handleSkipHealthConnect}
        disabled={isLoading || hcConnecting}
        activeOpacity={0.7}
      >
        <Text style={hc.skipText}>Skip for now</Text>
      </TouchableOpacity>

      <Text style={hc.disclaimer}>You can connect Health Connect anytime from your Profile settings.</Text>
    </>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scroll, step === 0 && s.scrollStep0]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Branded Header */}
          <View style={s.logoArea}>
            <Image
              source={require('../assets/logo.png')}
              style={s.logoImage}
              resizeMode="contain"
            />
            <Image
              source={require('../assets/NuFi-text.png')}
              style={s.brandTextImage}
              resizeMode="contain"
            />
          </View>

          {/* Step Indicator */}
          <StepIndicator current={step} total={3} />

          {/* Form Card */}
          <View style={s.card}>
            {step === 0 ? renderStep1() : step === 1 ? renderStep2() : renderStep3()}
          </View>

          {/* Sign In Link */}
          <View style={s.linkRow}>
            <Text style={s.linkText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={s.linkAction}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const st = StyleSheet.create({
  stepRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40, marginBottom: 24, position: 'relative' },
  stepLine: { position: 'absolute', height: 2, backgroundColor: '#E2E8F0', width: 40, top: '50%' },
  stepDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', zIndex: 1 },
  stepDotActive: { backgroundColor: DARK_BG, borderColor: DARK_BG },
  stepDotCompleted: { backgroundColor: LIME, borderColor: DARK_BG },
  stepNum: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  stepNumActive: { color: LIME },
  stepCheck: { fontSize: 14, fontWeight: '800', color: DARK_BG },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingVertical: 32 },
  scrollStep0: { paddingTop: 56 },

  // Header
  logoArea: { alignItems: 'center', marginBottom: 20 },
  logoImage: {
    width: 90,
    height: 74,
    marginBottom: 12,
  },
  brandTextImage: {
    width: 120,
    height: 40,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8E8EC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  topBackBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topBackBtnText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
  },
  cardTitle: { fontSize: 22, fontWeight: '900', color: DARK_BG, letterSpacing: -0.4, marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 19 },

  // Error
  errBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FEE2E2', gap: 10 },
  errText: { color: '#EF4444', fontSize: 13, fontWeight: '600', flex: 1 },

  // Labels & Inputs
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 10 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 16, marginBottom: 4 },
  inputFocused: { borderColor: DARK_BG, backgroundColor: '#FFFFFF' },
  input: { flex: 1, color: DARK_BG, fontSize: 15, paddingVertical: 14, fontWeight: '600' },
  eyeBtn: { padding: 4 },

  // Section Label (Step 2)
  sectionLabel: { fontSize: 12, fontWeight: '800', color: DARK_BG, marginTop: 16, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Metrics Row
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCol: { flex: 1 },
  metricLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, textAlign: 'center' },
  metricInput: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 18, fontWeight: '800', color: DARK_BG, textAlign: 'center', paddingVertical: 8, minWidth: 40 },
  metricUnit: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginLeft: 2 },

  // Gender
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  genderChipActive: { backgroundColor: DARK_BG, borderColor: DARK_BG },
  genderText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  genderTextActive: { color: LIME, fontWeight: '800' },

  // Goal Cards
  goalCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 8, gap: 12 },
  goalCardActive: { backgroundColor: '#FFFFFF', borderColor: DARK_BG, borderWidth: 2 },
  goalIcon: { fontSize: 24 },
  goalInfo: { flex: 1 },
  goalLabel: { fontSize: 15, fontWeight: '700', color: DARK_BG },
  goalLabelActive: { color: DARK_BG, fontWeight: '800' },
  goalDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  goalRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  goalRadioActive: { borderColor: DARK_BG },
  goalRadioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: DARK_BG },

  // Buttons
  primaryBtn: { flexDirection: 'row', backgroundColor: DARK_BG, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 8, shadowColor: DARK_BG, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: LIME, letterSpacing: 0.3 },
  primaryBtnArrow: { fontSize: 18, fontWeight: '800', color: LIME },

  // Footer
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 20 },
  linkText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  linkAction: { color: DARK_BG, fontSize: 14, fontWeight: '800', marginLeft: 5, textDecorationLine: 'underline' },
});

const hc = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 16 },
  iconRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#FFD6D6' },
  iconEmoji: { fontSize: 32 },
  privacyPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FFF4', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 16, gap: 8, borderWidth: 1, borderColor: '#BBF7D0', alignSelf: 'stretch' },
  privacyIcon: { fontSize: 14 },
  privacyText: { fontSize: 12, color: '#15803D', fontWeight: '600', flex: 1 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  metricChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, gap: 6, borderWidth: 1, borderColor: '#E2E8F0', width: '47%' },
  metricEmoji: { fontSize: 16 },
  metricText: { fontSize: 12, color: DARK_BG, fontWeight: '600', flex: 1 },
  connectIcon: { fontSize: 16, marginRight: 2 },
  skipBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  skipText: { fontSize: 14, color: '#64748B', fontWeight: '700', textDecorationLine: 'underline' },
  disclaimer: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 12, lineHeight: 16 },
});

export default RegisterScreen;
