import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

import { AuthProvider } from './src/auth/AuthContext';
import { ForegroundNotificationBanner } from './src/components/NotificationBanner';
import { RootNavigator } from './src/navigation/RootNavigator';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden — fine.
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null; // Native splash stays visible until fonts are ready.
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
          <ForegroundNotificationBanner />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
