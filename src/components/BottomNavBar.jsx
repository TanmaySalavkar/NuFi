import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserCircle2, Bot } from 'lucide-react-native';
import { HomeIcon, SaladIcon } from './Icons';

const LIME = '#C8FF00';
const DARK_BG = '#1A1A2E';

// Map visual tabs → real tab route names (null = opens via parent stack)
const TABS = [
  { key: 'home',    label: 'Home',    route: 'DietDashboard' },
  { key: 'ai',      label: 'AI',      route: null },
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

// Receives props from Tab.Navigator tabBar prop
const BottomNavBar = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  // Current active tab route name
  const activeRoute = state?.routes?.[state?.index]?.name;

  const handleTabPress = (key, route) => {
    if (key === 'ai') {
      // NuFiAI lives in the parent Stack above the Tab Navigator
      const parent = navigation.getParent?.();
      if (parent) { parent.navigate('NuFiAI'); }
      return;
    }
    if (!route) return;
    if (route === activeRoute) return; // already here
    navigation.navigate(route);
  };

  const handlePlusPress = () => {
    // FoodScanner lives in the parent Stack above the Tab Navigator
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate('FoodScanner');
    } else {
      navigation.navigate('FoodScanner');
    }
  };

  return (
    <View style={[st.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={st.pill}>
        {TABS.map((tab) => {
          const isActive = tab.route === activeRoute;
          const color = isActive ? LIME : 'rgba(255,255,255,0.4)';
          return (
            <TouchableOpacity
              key={tab.key}
              style={st.tab}
              activeOpacity={0.7}
              onPress={() => handleTabPress(tab.key, tab.route)}
            >
              <View style={st.iconWrap}>{renderIcon(tab.key, color)}</View>
              <Text style={isActive ? st.labelActive : st.label}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* + Button → FoodScanner */}
        <TouchableOpacity style={st.plusBtn} onPress={handlePlusPress} activeOpacity={0.85}>
          <Text style={st.plusIcon}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  label: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  labelActive: { fontSize: 10, fontWeight: '700', color: LIME },
  plusBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: LIME,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 4,
  },
  plusIcon: { fontSize: 28, fontWeight: '700', color: DARK_BG, marginTop: -2 },
});

export default BottomNavBar;

