/**
 * Transactional email templates.
 *
 * One branded layout, one place. Emails were previously inline HTML strings
 * scattered across services, which is how a store ends up with three different
 * looking receipts.
 *
 * Written for email clients, not browsers: tables over flexbox, inline styles
 * over classes, no external CSS. Outlook and Gmail strip <style> blocks.
 */
import type { Order, OrderItem } from '@prisma/client';
import { env } from '../config/env';

const BRAND = {
  ink: '#1A1714',
  orange: '#EA7A12',
  gold: '#B08D3E',
  cream: '#FDFBF7',
  creamAlt: '#F7F2EA',
  muted: '#6E675F',
  border: '#E4DDD2',
};

const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const siteUrl = () => (env.WEB_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');

/** Escape anything interpolated — product names come from the database. */
const esc = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The shared shell: masthead, body, sign-off. */
export function emailLayout(opts: {
  heading: string;
  preheader: string;
  body: string;
  cta?: { label: string; url: string };
}): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.creamAlt};font-family:Helvetica,Arial,sans-serif;color:${BRAND.ink}">
  <!-- Preheader: the grey line clients show beside the subject. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.creamAlt};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${BRAND.cream};border-radius:14px;overflow:hidden;border:1px solid ${BRAND.border}">

        <tr><td style="background:${BRAND.ink};padding:22px 28px;text-align:center">
          <div style="font-size:21px;font-weight:bold;letter-spacing:.22em;color:${BRAND.cream}">CHIKB<span style="color:${BRAND.orange}">O</span></div>
          <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.gold};margin-top:6px">Trust, Quality and Budget friendly</div>
        </td></tr>

        <tr><td style="padding:32px 28px 8px">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:${BRAND.ink}">${esc(opts.heading)}</h1>
          <div style="font-size:15px;line-height:1.65;color:#3D3833">${opts.body}</div>
        </td></tr>

        ${
          opts.cta
            ? `<tr><td style="padding:12px 28px 28px" align="center">
                 <a href="${esc(opts.cta.url)}" style="display:inline-block;background:${BRAND.orange};color:#fff;text-decoration:none;padding:13px 30px;border-radius:999px;font-weight:bold;font-size:15px">${esc(opts.cta.label)}</a>
               </td></tr>`
            : '<tr><td style="height:16px"></td></tr>'
        }

        <tr><td style="padding:20px 28px 26px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.6;color:${BRAND.muted}">
          Dealing in textiles since 1992 · 21-1-684 &amp; 85, Rikab Gunj, Hyderabad<br>
          Questions? Reply to this email or call <a href="tel:+919346060635" style="color:${BRAND.muted}">+91 93460 60635</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

type OrderWithItems = Order & { items: OrderItem[] };

/** Itemised summary table reused by every order email. */
export function orderSummary(order: OrderWithItems): string {
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px">
          ${esc(item.productName)}
          ${item.size || item.color ? `<div style="color:${BRAND.muted};font-size:12px">${esc([item.size, item.color].filter(Boolean).join(' · '))}</div>` : ''}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;text-align:center;width:44px">${item.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;text-align:right;width:92px">${money(item.lineTotalInPaise)}</td>
      </tr>`,
    )
    .join('');

  const line = (label: string, value: string, bold = false) =>
    `<tr><td colspan="2" style="padding:5px 0;font-size:14px;${bold ? 'font-weight:bold;' : `color:${BRAND.muted};`}">${label}</td>
     <td style="padding:5px 0;font-size:14px;text-align:right;${bold ? 'font-weight:bold;' : ''}">${value}</td></tr>`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse">
      ${rows}
      ${line('Subtotal', money(order.subtotalInPaise))}
      ${order.discountInPaise > 0 ? line('Discount', `− ${money(order.discountInPaise)}`) : ''}
      ${line('Delivery', order.shippingInPaise === 0 ? 'Free' : money(order.shippingInPaise))}
      ${line('Total paid', money(order.totalInPaise), true)}
    </table>`;
}

const orderUrl = (orderId: string) => `${siteUrl()}/account/orders/${orderId}`;

export interface BuiltEmail {
  subject: string;
  html: string;
}

/** Order confirmed — payment captured. */
export function orderConfirmedEmail(order: OrderWithItems, name: string): BuiltEmail {
  return {
    subject: `Order ${order.orderNumber} confirmed — Chikbo`,
    html: emailLayout({
      heading: 'Your order is confirmed',
      preheader: `We've received your order ${order.orderNumber}.`,
      body: `<p>Hello ${esc(name)}, thank you for shopping with Chikbo. Order <b>${esc(order.orderNumber)}</b> is confirmed and we'll start packing it right away.</p>
             ${orderSummary(order)}
             <p style="color:${BRAND.muted};font-size:13px">Delivering to ${esc(order.shipFullName)}, ${esc(order.shipCity)} ${esc(order.shipPincode)}.</p>`,
      cta: { label: 'Track your order', url: orderUrl(order.id) },
    }),
  };
}

/** Courier or admin moved the order along. */
export function orderStatusEmail(
  order: OrderWithItems,
  name: string,
  status: string,
  extra?: { awbCode?: string | null; courierName?: string | null; note?: string | null },
): BuiltEmail | null {
  const copy: Record<string, { subject: string; heading: string; body: string }> = {
    PROCESSING: {
      subject: `Order ${order.orderNumber} is being packed`,
      heading: 'We’re packing your order',
      body: 'Your order is being picked and quality-checked. We’ll email again the moment it ships.',
    },
    SHIPPED: {
      subject: `Order ${order.orderNumber} has shipped`,
      heading: 'Your order is on its way',
      body: 'Your parcel has left our Hyderabad warehouse.',
    },
    OUT_FOR_DELIVERY: {
      subject: `Order ${order.orderNumber} is out for delivery`,
      heading: 'Arriving today',
      body: 'Your parcel is out for delivery. Please keep your phone handy for the courier.',
    },
    DELIVERED: {
      subject: `Order ${order.orderNumber} delivered`,
      heading: 'Delivered — enjoy!',
      body: 'Your order has been delivered. If anything arrived damaged, you can raise a return from your orders page within 7 days.',
    },
    CANCELLED: {
      subject: `Order ${order.orderNumber} cancelled`,
      heading: 'Your order has been cancelled',
      body: 'This order has been cancelled. If it was already paid, the refund is on its way — see below.',
    },
  };

  const c = copy[status];
  if (!c) return null; // no email for internal-only transitions

  const tracking =
    extra?.awbCode
      ? `<p style="margin-top:14px"><b>Tracking number:</b> ${esc(extra.awbCode)}${extra.courierName ? ` (${esc(extra.courierName)})` : ''}</p>`
      : '';
  const note = extra?.note ? `<p style="color:${BRAND.muted};font-size:13px">${esc(extra.note)}</p>` : '';

  return {
    subject: `${c.subject} — Chikbo`,
    html: emailLayout({
      heading: c.heading,
      preheader: c.subject,
      body: `<p>Hello ${esc(name)}, an update on order <b>${esc(order.orderNumber)}</b>.</p><p>${c.body}</p>${tracking}${note}${orderSummary(order)}`,
      cta: { label: 'View your order', url: orderUrl(order.id) },
    }),
  };
}

/** Refund started with the gateway. */
export function refundInitiatedEmail(order: OrderWithItems, name: string, amountInPaise: number, reason: string): BuiltEmail {
  return {
    subject: `Refund started for order ${order.orderNumber} — Chikbo`,
    html: emailLayout({
      heading: 'Your refund is on its way',
      preheader: `We've started a refund of ${money(amountInPaise)}.`,
      body: `<p>Hello ${esc(name)}, we've started a refund of <b>${money(amountInPaise)}</b> for order <b>${esc(order.orderNumber)}</b>.</p>
             <p style="color:${BRAND.muted};font-size:13px">Reason: ${esc(reason)}</p>
             <p>Refunds are returned to the original payment method and usually appear within <b>5–7 working days</b>, depending on your bank.</p>`,
      cta: { label: 'View your order', url: orderUrl(order.id) },
    }),
  };
}

/** Gateway confirmed the refund landed. */
export function refundCompletedEmail(order: OrderWithItems, name: string): BuiltEmail {
  return {
    subject: `Refund completed for order ${order.orderNumber} — Chikbo`,
    html: emailLayout({
      heading: 'Refund completed',
      preheader: `Your refund for ${order.orderNumber} has been processed.`,
      body: `<p>Hello ${esc(name)}, the refund for order <b>${esc(order.orderNumber)}</b> has been processed by our payment gateway.</p>
             <p>Depending on your bank it may take a further day or two to appear on your statement.</p>`,
      cta: { label: 'View your order', url: orderUrl(order.id) },
    }),
  };
}

/** Acknowledge a return request so the customer knows it landed. */
export function returnRequestedEmail(order: OrderWithItems, name: string, productName: string): BuiltEmail {
  return {
    subject: `Return request received — ${order.orderNumber} — Chikbo`,
    html: emailLayout({
      heading: 'We’ve received your return request',
      preheader: `Your return request for ${esc(productName)} is with our team.`,
      body: `<p>Hello ${esc(name)}, we've received your return request for <b>${esc(productName)}</b> from order <b>${esc(order.orderNumber)}</b>.</p>
             <p>Our team reviews damage reports within <b>1–2 working days</b> and will email you with the decision and pickup details.</p>`,
      cta: { label: 'View your order', url: orderUrl(order.id) },
    }),
  };
}

/** Return approved or rejected. */
export function returnDecisionEmail(
  order: OrderWithItems,
  name: string,
  productName: string,
  approved: boolean,
  adminNote?: string | null,
): BuiltEmail {
  return {
    subject: `Return ${approved ? 'approved' : 'update'} — ${order.orderNumber} — Chikbo`,
    html: emailLayout({
      heading: approved ? 'Your return has been approved' : 'About your return request',
      preheader: `An update on your return for ${esc(productName)}.`,
      body: approved
        ? `<p>Hello ${esc(name)}, your return for <b>${esc(productName)}</b> has been approved.</p>
           <p>We'll arrange a pickup and email the details shortly. Once the item reaches our warehouse and passes inspection, your refund is released.</p>
           ${adminNote ? `<p style="color:${BRAND.muted};font-size:13px">${esc(adminNote)}</p>` : ''}`
        : `<p>Hello ${esc(name)}, we've reviewed your return request for <b>${esc(productName)}</b> and are unable to approve it on this occasion.</p>
           ${adminNote ? `<p style="color:${BRAND.muted};font-size:13px">${esc(adminNote)}</p>` : ''}
           <p>If you think this is a mistake, reply to this email and we'll take another look.</p>`,
      cta: { label: 'View your order', url: orderUrl(order.id) },
    }),
  };
}

/** Welcome email on registration. */
export function welcomeEmail(name: string): BuiltEmail {
  return {
    subject: 'Welcome to Chikbo',
    html: emailLayout({
      heading: 'Welcome to Chikbo',
      preheader: 'Three decades of textiles, now at your doorstep.',
      body: `<p>Hello ${esc(name)}, welcome in.</p>
             <p>We've been dealing in textiles since 1992 — handpicked sarees, dresses, tops, bottomwear and antique imitation jewellery, quality-checked by hand before they travel to your door.</p>
             <p style="color:${BRAND.muted};font-size:13px">Free delivery on orders over ₹999, shipped pan-India.</p>`,
      cta: { label: 'Start shopping', url: siteUrl() },
    }),
  };
}
