import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Keyboard, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserCircle2, Bot, Camera, Edit3, X } from 'lucide-react-native';
import { HomeIcon, SaladIcon } from './Icons';

const LIME = '#C8FF00';
const DARK_BG = '#1A1A2E';

// Map visual tabs → real tab route names in MainTabs
const TABS = [
  { key: 'home',    label: 'Home',    route: 'DietDashboard' },
  { key: 'ai',      label: 'NuFi',    route: 'NuFiAI' },
  { key: 'meals',   label: 'Meals',   route: 'MealHistory' },
  { key: 'profile', label: 'Profile', route: 'Profile' },
];

const renderIcon = (key, color) => {
  const props = { size: 20, color, strokeWidth: 2 };
  switch (key) {
    case 'home':    return <HomeIcon    size={20} color={color} />;
    case 'ai':      return <Bot         {...props} />;
    case 'meals':   return <SaladIcon   size={20} color={color} />;
    case 'profile': return <UserCircle2 {...props} />;
    default:        return null;
  }
};

// Animated tab item with spring micro-interaction
const TabItem = ({ tab, isActive, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(isActive ? 1.05 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1.08 : 1,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  }, [isActive, scaleAnim]);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.92,
      duration: 90,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1.08 : 1,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  };

  const color = isActive ? LIME : 'rgba(255,255,255,0.45)';

  return (
    <TouchableOpacity
      style={st.tab}
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[st.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
        {renderIcon(tab.key, color)}
      </Animated.View>
      <Text style={isActive ? st.labelActive : st.label}>{tab.label}</Text>
    </TouchableOpacity>
  );
};

// Receives props from Tab.Navigator tabBar prop
const BottomNavBar = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const plusScale = useRef(new Animated.Value(1)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Current active tab route name
  const activeRoute = state?.routes?.[state?.index]?.name;

  if (isKeyboardVisible) {
    return null;
  }

  const handleTabPress = (route) => {
    if (!route) return;
    if (route === activeRoute) return;
    navigation.navigate(route);
  };

  const handlePlusPress = () => {
    Animated.sequence([
      Animated.timing(plusScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(plusScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();

    setShowActionModal(true);
  };

  const navigateTo = (screenName) => {
    setShowActionModal(false);
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate(screenName);
    } else {
      navigation.navigate(screenName);
    }
  };

  return (
    <>
      <View style={[st.container, { paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
        <View style={st.pill}>
          {TABS.map((tab) => {
            const isActive = tab.route === activeRoute;
            return (
              <TabItem
                key={tab.key}
                tab={tab}
                isActive={isActive}
                onPress={() => handleTabPress(tab.route)}
              />
            );
          })}

          {/* + Button → Opens Add Options Modal */}
          <Animated.View style={{ transform: [{ scale: plusScale }] }}>
            <TouchableOpacity style={st.plusBtn} onPress={handlePlusPress} activeOpacity={0.85}>
              <Text style={st.plusIcon}>+</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Action Sheet Modal: Scan vs Manual */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity
          style={st.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={[st.actionSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={st.actionSheetHeader}>
              <Text style={st.actionSheetTitle}>Add a Meal</Text>
              <TouchableOpacity
                style={st.closeBtn}
                onPress={() => setShowActionModal(false)}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={st.actionOption}
              onPress={() => navigateTo('ManualMealEntry')}
              activeOpacity={0.8}
            >
              <View style={[st.optionIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <Edit3 size={22} color={DARK_BG} />
              </View>
              <View style={st.optionTextWrap}>
                <Text style={st.optionTitle}>Log Meal Manually</Text>
                <Text style={st.optionSub}>Type name, calories & macros directly</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.actionOption}
              onPress={() => navigateTo('FoodScanner')}
              activeOpacity={0.8}
            >
              <View style={[st.optionIconWrap, { backgroundColor: LIME }]}>
                <Camera size={22} color={DARK_BG} />
              </View>
              <View style={st.optionTextWrap}>
                <Text style={st.optionTitle}>Scan with AI Camera</Text>
                <Text style={st.optionSub}>Instant nutritional breakdown from a photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const st = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: 16, paddingTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK_BG,
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  iconWrap: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 3 },
  label: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  labelActive: { fontSize: 10, fontWeight: '700', color: LIME },
  plusBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: LIME,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 4,
  },
  plusIcon: { fontSize: 28, fontWeight: '700', color: DARK_BG, marginTop: -2 },

  // Modal Action Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: DARK_BG,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: DARK_BG,
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 12,
    color: '#64748B',
  },
});

export default BottomNavBar;
