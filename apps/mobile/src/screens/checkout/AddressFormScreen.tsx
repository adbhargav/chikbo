import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { toApiError } from '../../api/client';
import { useCreateAddress, useDeleteAddress, useUpdateAddress } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, fonts, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';

export function AddressFormScreen({ route, navigation }: AppScreenProps<'AddressForm'>) {
  const editing = route.params?.address;
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const remove = useDeleteAddress();

  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [line1, setLine1] = useState(editing?.line1 ?? '');
  const [line2, setLine2] = useState(editing?.line2 ?? '');
  const [city, setCity] = useState(editing?.city ?? '');
  const [state, setState] = useState(editing?.state ?? '');
  const [pincode, setPincode] = useState(editing?.pincode ?? '');
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const busy = create.isPending || update.isPending || remove.isPending;

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = 'Name is required.';
    if (!/^[6-9]\d{9}$/.test(phone.trim())) next.phone = 'Enter a 10-digit Indian mobile number.';
    if (!line1.trim()) next.line1 = 'Address line is required.';
    if (!city.trim()) next.city = 'City is required.';
    if (!state.trim()) next.state = 'State is required.';
    if (!/^\d{6}$/.test(pincode.trim())) next.pincode = 'Enter a 6-digit pincode.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    setServerError(null);
    if (!validate()) return;
    const body = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      line1: line1.trim(),
      line2: line2.trim() ? line2.trim() : null,
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault,
    };
    const options = {
      onSuccess: () => navigation.goBack(),
      onError: (e: unknown) => setServerError(toApiError(e).message),
    };
    if (editing) {
      update.mutate({ id: editing.id, body }, options);
    } else {
      create.mutate(body, options);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert('Delete address', 'Remove this address from your account?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(editing.id, {
            onSuccess: () => navigation.goBack(),
            onError: (e) => setServerError(toApiError(e).message),
          }),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextField label="Full name" value={fullName} onChangeText={setFullName} error={errors.fullName ?? null} autoComplete="name" />
        <TextField
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
          error={errors.phone ?? null}
          autoComplete="tel"
        />
        <TextField label="Address line 1" value={line1} onChangeText={setLine1} error={errors.line1 ?? null} placeholder="House no., street" />
        <TextField label="Address line 2 (optional)" value={line2} onChangeText={setLine2} placeholder="Landmark, area" />
        <View style={styles.row}>
          <TextField label="City" value={city} onChangeText={setCity} error={errors.city ?? null} containerStyle={styles.rowItem} />
          <TextField label="State" value={state} onChangeText={setState} error={errors.state ?? null} containerStyle={styles.rowItem} />
        </View>
        <TextField
          label="Pincode"
          value={pincode}
          onChangeText={setPincode}
          keyboardType="number-pad"
          maxLength={6}
          error={errors.pincode ?? null}
          autoComplete="postal-code"
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDefault }}
          accessibilityLabel="Make this my default address"
          onPress={() => setIsDefault((v) => !v)}
          style={styles.checkboxRow}
        >
          <Ionicons
            name={isDefault ? 'checkbox' : 'square-outline'}
            size={20}
            color={isDefault ? colors.brand600 : colors.ink300}
          />
          <Text style={styles.checkboxLabel}>Make this my default address</Text>
        </Pressable>

        {serverError ? (
          <Text style={styles.serverError} accessibilityLiveRegion="polite">
            {serverError}
          </Text>
        ) : null}

        <Button title={editing ? 'Save changes' : 'Save address'} onPress={submit} loading={busy} style={{ marginTop: spacing.sm }} />
        {editing ? (
          <Button title="Delete address" variant="ghost" onPress={confirmDelete} disabled={busy} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    padding: spacing.lg,
    paddingBottom: 48,
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkboxLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink700,
  },
  serverError: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
  },
});
