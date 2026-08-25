import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { toApiError } from '../../api/client';
import { userApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, fonts, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';

export function EditProfileScreen({ navigation }: AppScreenProps<'EditProfile'>) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Your name is required.';
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) {
      next.phone = 'Enter a 10-digit Indian mobile number.';
    }
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const updated = await userApi.updateProfile({
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      if (user) setUser({ ...user, name: updated.name ?? name.trim(), phone: updated.phone ?? phone.trim() });
      navigation.goBack();
    } catch (e) {
      setServerError(toApiError(e).message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextField label="Full name" value={name} onChangeText={setName} error={errors.name ?? null} autoComplete="name" />
        <TextField
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
          error={errors.phone ?? null}
          autoComplete="tel"
        />
        <TextField label="Email" value={user?.email ?? ''} editable={false} containerStyle={{ opacity: 0.6 }} />
        <Text style={styles.hint}>Email can't be changed here — contact us if you need to update it.</Text>
        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
        <Button title="Save changes" onPress={() => void submit()} loading={busy} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
    marginTop: -spacing.sm,
  },
  serverError: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
  },
});
