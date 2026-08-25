import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

import type { AddressDto } from '../types/shared';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabsParamList = {
  HomeTab: undefined;
  CategoriesTab: undefined;
  WishlistTab: undefined;
  OrdersTab: undefined;
  ProfileTab: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<MainTabsParamList>;
  ProductList: { categorySlug?: string; categoryName?: string };
  ProductDetail: { slug: string; name?: string };
  Cart: undefined;
  /** Checkout step 1 — choose delivery address. */
  AddressSelect: { couponCode?: string };
  AddressForm: { address?: AddressDto } | undefined;
  /** Checkout step 2 — Razorpay hosted checkout in a WebView. */
  Payment: { addressId: string; couponCode?: string; idempotencyKey: string };
  OrderConfirmed: { orderId: string; orderNumber: string };
  PaymentFailed: {
    addressId: string;
    couponCode?: string;
    idempotencyKey: string;
    orderId: string;
    message?: string;
  };
  OrderDetail: { orderId: string };
  ReturnRequest: { orderId: string };
  EditProfile: undefined;
  Addresses: undefined;
  Notifications: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;

export type TabScreenProps<T extends keyof MainTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;
