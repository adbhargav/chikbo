import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useQueryClient } from '@tanstack/react-query';

import { checkoutApi } from '../../api/endpoints';
import { toApiError } from '../../api/client';
import { ErrorState } from '../../components/ErrorState';
import { qk } from '../../hooks/queries';
import { colors, fonts, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';
import type { CheckoutCreateResponse } from '../../types/shared';

type RazorpayMessage =
  | { type: 'success'; data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } }
  | { type: 'failed'; data: { code?: string; description?: string } }
  | { type: 'dismiss' };

function buildCheckoutHtml(checkout: CheckoutCreateResponse): string {
  const options = {
    key: checkout.razorpayKeyId,
    order_id: checkout.razorpayOrderId,
    amount: checkout.amountInPaise,
    currency: checkout.currency,
    name: 'CHIKBO',
    description: `Order ${checkout.orderNumber}`,
    prefill: checkout.prefill,
    theme: { color: '#EA7A12' },
  };
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { background: #FDFBF7; font-family: -apple-system, sans-serif; margin: 0;
           display: flex; align-items: center; justify-content: center; height: 100vh; }
    p { color: #6E675F; font-size: 14px; }
  </style>
</head>
<body>
  <p>Opening secure payment&hellip;</p>
  <script>
    function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
    try {
      var options = ${JSON.stringify(options)};
      options.handler = function (response) { post({ type: 'success', data: response }); };
      options.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        post({ type: 'failed', data: { code: resp.error && resp.error.code, description: resp.error && resp.error.description } });
      });
      rzp.open();
    } catch (e) {
      post({ type: 'failed', data: { description: String(e) } });
    }
  </script>
</body>
</html>`;
}

export function PaymentScreen({ route, navigation }: AppScreenProps<'Payment'>) {
  const { addressId, couponCode, idempotencyKey } = route.params;
  const queryClient = useQueryClient();

  const [checkout, setCheckout] = useState<CheckoutCreateResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState<unknown>(null);
  const [verifying, setVerifying] = useState(false);
  const settled = useRef(false);

  const createOrder = useCallback(async () => {
    setCheckoutError(null);
    setCheckout(null);
    try {
      // Same idempotencyKey on retry → the server returns the same pending order.
      const res = await checkoutApi.create({
        addressId,
        idempotencyKey,
        ...(couponCode ? { couponCode } : {}),
      });
      setCheckout(res);
    } catch (e) {
      setCheckoutError(e);
    }
  }, [addressId, couponCode, idempotencyKey]);

  useEffect(() => {
    void createOrder();
  }, [createOrder]);

  const finishSuccess = useCallback(
    (orderId: string, orderNumber: string) => {
      void queryClient.invalidateQueries({ queryKey: qk.cartAll });
      void queryClient.invalidateQueries({ queryKey: qk.orders });
      navigation.replace('OrderConfirmed', { orderId, orderNumber });
    },
    [navigation, queryClient],
  );

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      if (!checkout || settled.current) return;
      let message: RazorpayMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as RazorpayMessage;
      } catch {
        return;
      }

      if (message.type === 'success') {
        settled.current = true;
        setVerifying(true);
        try {
          const result = await checkoutApi.verifyPayment(message.data);
          finishSuccess(result.orderId, result.orderNumber);
        } catch {
          // Verify failure is non-fatal — the server confirms via webhook too.
          finishSuccess(checkout.orderId, checkout.orderNumber);
        }
        return;
      }

      settled.current = true;
      const failureBody =
        message.type === 'failed'
          ? {
              razorpay_order_id: checkout.razorpayOrderId,
              ...(message.data.code ? { error_code: message.data.code } : {}),
              ...(message.data.description ? { error_description: message.data.description } : {}),
            }
          : { razorpay_order_id: checkout.razorpayOrderId };
      try {
        await checkoutApi.paymentFailed(failureBody);
      } catch {
        // Best effort — the retry screen is shown regardless.
      }
      navigation.replace('PaymentFailed', {
        addressId,
        ...(couponCode ? { couponCode } : {}),
        idempotencyKey,
        orderId: checkout.orderId,
        ...(message.type === 'failed' && message.data.description
          ? { message: message.data.description }
          : {}),
      });
    },
    [addressId, checkout, couponCode, finishSuccess, idempotencyKey, navigation],
  );

  if (checkoutError) {
    return (
      <ErrorState
        error={checkoutError}
        title={
          toApiError(checkoutError).code === 'INSUFFICIENT_STOCK'
            ? 'Some items just sold out'
            : 'Could not start payment'
        }
        onRetry={() => void createOrder()}
      />
    );
  }

  if (!checkout || verifying) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand600} />
        <Text style={styles.loadingText}>
          {verifying ? 'Confirming your payment…' : 'Preparing secure checkout…'}
        </Text>
        <Text style={styles.loadingSub}>Please don't close the app.</Text>
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: buildCheckoutHtml(checkout), baseUrl: 'https://checkout.razorpay.com' }}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      style={styles.webview}
      startInLoadingState
      renderLoading={() => (
        <View style={[StyleSheet.absoluteFill, styles.loading]}>
          <ActivityIndicator size="large" color={colors.brand600} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: colors.cream50,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.cream50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink900,
    textAlign: 'center',
  },
  loadingSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink500,
  },
});
