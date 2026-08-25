/**
 * Outbound notifications: email (SMTP), WhatsApp (provider HTTP API) and
 * push (FCM). Each channel activates only when its env config is present;
 * otherwise it logs and skips — the calling flow never fails because a
 * notification channel is down or unconfigured.
 */
import nodemailer from 'nodemailer';
import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger';
import { prisma } from './prisma';

let mailer: nodemailer.Transporter | null = null;
if (env.SMTP_HOST && env.SMTP_USER) {
  mailer = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

// firebase-admin is loaded lazily so the API runs without FCM configured.
// The app itself is shared with Firebase Auth (see lib/firebase.ts).
let fcmMessaging: import('firebase-admin/messaging').Messaging | null = null;
async function getFcm() {
  if (fcmMessaging) return fcmMessaging;
  try {
    const { getFirebaseApp } = await import('./firebase');
    const app = await getFirebaseApp();
    if (!app) return null;
    const { getMessaging } = await import('firebase-admin/messaging');
    fcmMessaging = getMessaging(app);
    return fcmMessaging;
  } catch (err) {
    logger.error({ err }, 'Failed to initialise FCM');
    return null;
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!mailer) {
    logger.info({ to, subject }, 'Email skipped (SMTP not configured)');
    return;
  }
  try {
    await mailer.sendMail({ from: env.SMTP_FROM, to, subject, html });
  } catch (err) {
    logger.error({ err, to, subject }, 'Email send failed');
  }
}

export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  if (!env.WHATSAPP_API_URL || !env.WHATSAPP_API_KEY) {
    logger.info({ phone }, 'WhatsApp skipped (provider not configured)');
    return;
  }
  try {
    await axios.post(
      env.WHATSAPP_API_URL,
      { phone: `91${phone}`, message },
      { headers: { Authorization: `Bearer ${env.WHATSAPP_API_KEY}` }, timeout: 10_000 },
    );
  } catch (err) {
    logger.error({ err, phone }, 'WhatsApp send failed');
  }
}

export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
  const messaging = await getFcm();
  if (!messaging) {
    logger.info({ userId, title }, 'Push skipped (FCM not configured)');
    return;
  }
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;
  try {
    const res = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
      data,
    });
    // Prune tokens the provider reports as dead.
    const dead = tokens.filter((_, i) => {
      const r = res.responses[i];
      return r && !r.success && r.error?.code === 'messaging/registration-token-not-registered';
    });
    if (dead.length) {
      await prisma.deviceToken.deleteMany({ where: { id: { in: dead.map((d) => d.id) } } });
    }
  } catch (err) {
    logger.error({ err, userId }, 'Push send failed');
  }
}

/**
 * Persist an in-app notification and fan out to push/email/WhatsApp.
 *
 * The database row is awaited (fast, and the customer must see it in-app), but
 * the outbound channels are dispatched without awaiting. An SMTP handshake to
 * Gmail costs 3-5 seconds; blocking on it made an admin marking an order
 * "shipped" wait 5s for the response. Delivery failures are logged, never
 * surfaced — a courier update must not fail because a mail server is slow.
 */
export async function notifyUser(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  email?: { to: string; subject: string; html: string };
  whatsapp?: { phone: string; message: string };
}): Promise<void> {
  const { userId, type, title, body, data } = params;
  try {
    await prisma.notification.create({ data: { userId, type, title, body, data } });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to persist notification');
  }

  // Deliberately not awaited — see the note above.
  void Promise.allSettled([
    sendPushToUser(userId, title, body, data),
    params.email ? sendEmail(params.email.to, params.email.subject, params.email.html) : Promise.resolve(),
    params.whatsapp ? sendWhatsApp(params.whatsapp.phone, params.whatsapp.message) : Promise.resolve(),
  ]).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) logger.warn({ userId, failed: failed.length }, 'Some notification channels failed');
  });
}
