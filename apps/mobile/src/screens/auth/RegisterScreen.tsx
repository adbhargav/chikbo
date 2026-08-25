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

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Your name is required.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      next.phone = 'Enter a 10-digit Indian mobile number.';
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
      next.password = 'At least 8 characters, with a letter and a number.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
    } catch (e) {
      setServerError(toApiError(e).message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Join Chikbo</Text>
        <Text style={styles.subheading}>Trust, quality and budget friendly — since 1992.</Text>

        <View style={styles.form}>
          <TextField
            label="Full name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            placeholder="Your name"
            error={errors.name ?? null}
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            error={errors.email ?? null}
          />
          <TextField
            label="Mobile number (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="10-digit mobile"
            maxLength={10}
            error={errors.phone ?? null}
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            placeholder="Min 8 chars, letter + number"
            error={errors.password ?? serverError}
          />
          <Button title="Create account" onPress={submit} loading={busy} style={styles.submit} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already with us? </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in instead"
            onPress={() => navigation.navigate('Login')}
            hitSlop={8}
          >
            <Text style={styles.switchLink}>Sign in</Text>
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
