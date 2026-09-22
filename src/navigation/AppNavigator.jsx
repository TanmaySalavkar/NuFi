import React, { useContext } from "react";
import { ActivityIndicator, View, Dimensions, Easing } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthContext } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DietDashboardScreen from "../screens/DietDashboardScreen";
import FoodScannerScreen from "../screens/FoodScannerScreen";
import MealNutritionDetailScreen from "../screens/MealNutritionDetailScreen";
import MealHistoryScreen from "../screens/MealHistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import NuFiAIScreen from "../screens/NuFiAIScreen";
import ManualMealEntryScreen from "../screens/ManualMealEntryScreen";
import BottomNavBar from "../components/BottomNavBar";
import { COLORS } from "../theme";

const { width } = Dimensions.get('window');

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.dietBg } }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const renderTabBar = (props) => <BottomNavBar {...props} />;

// ── Tab navigator: nav bar rendered once, stays fixed across all tabs ────────
const MainTabs = () => (
  <Tab.Navigator
    tabBar={renderTabBar}
    screenOptions={{
      headerShown: false,
      animation: 'shift',
      transitionSpec: {
        animation: 'timing',
        config: {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        },
      },
      sceneStyleInterpolator: ({ current }) => ({
        sceneStyle: {
          opacity: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0.8, 1, 0.8],
          }),
          transform: [
            {
              translateX: current.progress.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-width * 0.2, 0, width * 0.2],
              }),
            },
          ],
        },
      }),
    }}
  >
    <Tab.Screen name="DietDashboard" component={DietDashboardScreen} />
    <Tab.Screen name="NuFiAI"        component={NuFiAIScreen} />
    <Tab.Screen name="MealHistory"   component={MealHistoryScreen} />
    <Tab.Screen name="Profile"       component={ProfileScreen} />
  </Tab.Navigator>
);

const AppStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.dietBg } }}>
    <Stack.Screen name="Main" component={MainTabs} />
    <Stack.Screen name="FoodScanner" component={FoodScannerScreen} options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="MealNutritionDetail" component={MealNutritionDetailScreen} />
    <Stack.Screen name="ManualMealEntry" component={ManualMealEntryScreen} options={{ animation: 'slide_from_bottom' }} />
  </Stack.Navigator>
);

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.dietBg }}>
        <ActivityIndicator size="large" color={COLORS.dietAccent} />
      </View>
    );
  }

  return isAuthenticated ? <AppStack /> : <AuthStack />;
}