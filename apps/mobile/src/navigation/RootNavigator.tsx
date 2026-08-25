import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { colors, fonts } from '../theme';
import type { AppStackParamList, AuthStackParamList } from './types';
import { MainTabs } from './MainTabs';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ProductListScreen } from '../screens/catalog/ProductListScreen';
import { ProductDetailScreen } from '../screens/catalog/ProductDetailScreen';
import { CartScreen } from '../screens/cart/CartScreen';
import { AddressSelectScreen } from '../screens/checkout/AddressSelectScreen';
import { AddressFormScreen } from '../screens/checkout/AddressFormScreen';
import { PaymentScreen } from '../screens/checkout/PaymentScreen';
import { OrderConfirmedScreen } from '../screens/checkout/OrderConfirmedScreen';
import { PaymentFailedScreen } from '../screens/checkout/PaymentFailedScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { ReturnRequestScreen } from '../screens/orders/ReturnRequestScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { AddressesScreen } from '../screens/profile/AddressesScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand600,
    background: colors.cream50,
    card: colors.cream50,
    text: colors.ink900,
    border: 'rgba(185, 178, 169, 0.4)',
  },
};

const stackHeaderOptions = {
  headerStyle: { backgroundColor: colors.cream50 },
  headerShadowVisible: false,
  headerTintColor: colors.ink900,
  headerTitleStyle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink900 },
  headerBackButtonDisplayMode: 'minimal' as const,
};

/** Splash gate shown while the stored session is being restored. */
function BootSplash() {
  return (
    <View style={splashStyles.wrap}>
      <Text style={splashStyles.wordmark}>
        CHIKB<Text style={splashStyles.o}>O</Text>
      </Text>
      <Text style={splashStyles.heritage}>Dealing in textiles since 1992</Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: 6,
    color: colors.ink900,
  },
  o: {
    color: colors.brand600,
  },
  heritage: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.gold500,
    textTransform: 'uppercase',
  },
});

export function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <BootSplash />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {status === 'signedOut' ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      ) : (
        <AppStack.Navigator screenOptions={stackHeaderOptions}>
          <AppStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
          <AppStack.Screen
            name="ProductList"
            component={ProductListScreen}
            options={({ route }) => ({ title: route.params.categoryName ?? 'Shop' })}
          />
          <AppStack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ title: '' }}
          />
          <AppStack.Screen name="Cart" component={CartScreen} options={{ title: 'Your Cart' }} />
          <AppStack.Screen
            name="AddressSelect"
            component={AddressSelectScreen}
            options={{ title: 'Delivery Address' }}
          />
          <AppStack.Screen
            name="AddressForm"
            component={AddressFormScreen}
            options={({ route }) => ({
              title: route.params?.address ? 'Edit Address' : 'Add Address',
            })}
          />
          <AppStack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{ title: 'Payment', headerBackVisible: false, gestureEnabled: false }}
          />
          <AppStack.Screen
            name="OrderConfirmed"
            component={OrderConfirmedScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <AppStack.Screen
            name="PaymentFailed"
            component={PaymentFailedScreen}
            options={{ title: 'Payment Failed', headerBackVisible: false, gestureEnabled: false }}
          />
          <AppStack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{ title: 'Order Details' }}
          />
          <AppStack.Screen
            name="ReturnRequest"
            component={ReturnRequestScreen}
            options={{ title: 'Request Return' }}
          />
          <AppStack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ title: 'Edit Profile' }}
          />
          <AppStack.Screen
            name="Addresses"
            component={AddressesScreen}
            options={{ title: 'My Addresses' }}
          />
          <AppStack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: 'Notifications' }}
          />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}
