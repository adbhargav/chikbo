import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts } from '../theme';
import type { MainTabsParamList } from './types';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { HomeScreen } from '../screens/home/HomeScreen';
import { CategoriesScreen } from '../screens/catalog/CategoriesScreen';
import { WishlistScreen } from '../screens/wishlist/WishlistScreen';
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const TAB_ICONS: Record<keyof MainTabsParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  CategoriesTab: { active: 'grid', inactive: 'grid-outline' },
  WishlistTab: { active: 'heart', inactive: 'heart-outline' },
  OrdersTab: { active: 'cube', inactive: 'cube-outline' },
  ProfileTab: { active: 'person', inactive: 'person-outline' },
};

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.cream50 },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink900 },
        headerRight: () => <HeaderCartButton />,
        headerRightContainerStyle: { paddingRight: 16 },
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.ink500,
        tabBarStyle: {
          backgroundColor: colors.cream50,
          borderTopColor: 'rgba(185, 178, 169, 0.4)',
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10 },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name].active : TAB_ICONS[route.name].inactive}
            size={size - 2}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: 'CHIKBO', tabBarLabel: 'Home', headerTitleStyle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 3, color: colors.ink900 } }}
      />
      <Tab.Screen
        name="CategoriesTab"
        component={CategoriesScreen}
        options={{ title: 'Categories', tabBarLabel: 'Categories' }}
      />
      <Tab.Screen
        name="WishlistTab"
        component={WishlistScreen}
        options={{ title: 'Wishlist', tabBarLabel: 'Wishlist' }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersScreen}
        options={{ title: 'My Orders', tabBarLabel: 'Orders' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
