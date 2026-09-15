import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import {
  EyeIcon,
  EyeOffIcon,
  AlertIcon,
} from '../components/Icons';

const LIME = '#C8FF00';
const DARK_BG = '#1A1A2E';

const LoginScreen = ({ navigation }) => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setIsLoading(false);
    if (!result.success) setError(result.error);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Logo & Brand Header */}
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
            <Text style={s.tagline}>NUTRITION  •  FITNESS  •  A BRIGHTER YOU</Text>
          </View>

          {/* Login Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome Back</Text>
            <Text style={s.cardSub}>Sign in to track your daily nutrition and habits</Text>

            {error ? (
              <View style={s.errBox}>
                <AlertIcon size={18} color="#EF4444" />
                <Text style={s.errText}>{error}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <Text style={s.label}>Email Address</Text>
            <View style={[s.inputWrap, emailFocused && s.inputWrapFocused]}>
              <TextInput
                style={s.input}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field */}
            <Text style={s.label}>Password</Text>
            <View style={[s.inputWrap, passFocused && s.inputWrapFocused]}>
              <TextInput
                style={s.input}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={s.eyeToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeIcon size={22} color={DARK_BG} />
                ) : (
                  <EyeOffIcon size={22} color="#94A3B8" />
                )}
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[s.btn, isLoading && { opacity: 0.75 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={LIME} />
              ) : (
                <Text style={s.btnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={s.regRow}>
              <Text style={s.regText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={s.regLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { flexGrow: 1, paddingHorizontal: 22, justifyContent: 'center', paddingVertical: 40 },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoImage: {
    width: 100,
    height: 82,
    marginBottom: 14,
  },
  brandTextImage: {
    width: 135,
    height: 45,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#3B5249',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 26,
    borderWidth: 1,
    borderColor: '#E8E8EC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: { fontSize: 24, fontWeight: '900', color: DARK_BG, letterSpacing: -0.4, marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#64748B', marginBottom: 22 },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    gap: 10,
  },
  errText: { color: '#EF4444', fontSize: 13, fontWeight: '600', flex: 1 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  inputWrapFocused: {
    borderColor: DARK_BG,
    backgroundColor: '#FFFFFF',
  },
  input: { flex: 1, color: DARK_BG, fontSize: 15, paddingVertical: 14, fontWeight: '600' },
  eyeToggle: { padding: 4 },
  btn: {
    backgroundColor: DARK_BG,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 20,
    shadowColor: DARK_BG,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: { fontSize: 16, fontWeight: '800', color: LIME, letterSpacing: 0.5 },
  regRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  regText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  regLink: { color: DARK_BG, fontSize: 14, fontWeight: '800', marginLeft: 5, textDecorationLine: 'underline' },
});

export default LoginScreen;

