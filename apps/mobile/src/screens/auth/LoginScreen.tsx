import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, fonts, spacing } from '../../theme';
import type { AuthScreenProps } from '../../navigation/types';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(toApiError(e).message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.wordmark}>
            CHIKB<Text style={styles.wordmarkO}>O</Text>
          </Text>
          <Text style={styles.heritage}>DEALING IN TEXTILES SINCE 1992</Text>
        </View>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Woven with trust. Sign in to continue.</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Your password"
            error={error}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          <Button title="Sign in" onPress={submit} loading={busy} style={styles.submit} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>New to Chikbo? </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            onPress={() => navigation.navigate('Register')}
            hitSlop={8}
          >
            <Text style={styles.switchLink}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    paddingHorizontal: spacing.xl,
    flexGrow: 1,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 48,
    gap: 8,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 6,
    color: colors.ink900,
  },
  wordmarkO: { color: colors.brand600 },
  heritage: {
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold500,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink900,
    letterSpacing: -0.4,
  },
  subheading: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink500,
    marginTop: 6,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  submit: {
    marginTop: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  switchText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink500,
  },
  switchLink: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.brand600,
  },
});
