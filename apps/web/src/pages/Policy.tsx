import { useParams } from 'react-router-dom';
import { usePageMeta } from '../lib/usePageMeta';
import { Breadcrumbs } from '../components/ui';
import NotFoundPage from './NotFound';

const POLICIES: Record<string, { title: string; body: string[] }> = {
  shipping: {
    title: 'Shipping & Delivery',
    body: [
      'We ship pan-India from our store at Rikab gunj, Hyderabad. Orders are dispatched within 1–2 business days and typically arrive in 3–7 business days depending on your pincode.',
      'Delivery is free on orders of ₹999 or more (after discounts). A flat fee of ₹79 applies to smaller orders.',
      'Once your order ships, you will find the courier name, AWB number and live tracking events on the order page in your account.',
    ],
  },
  returns: {
    title: 'Returns & Refunds',
    body: [
      'We follow a genuine damage policy: if an item arrives damaged, raise a return request from the delivered order in your account within a reasonable time, describing the issue and attaching 1–6 clear photos.',
      'Once approved, we arrange a pickup. After the item is received and checked, your refund is initiated to the original payment method.',
      'Orders can be cancelled free of charge while they are pending, confirmed or processing — paid amounts are refunded automatically.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'We collect only what we need to serve you: your name, contact details, addresses and order history. We never sell your personal data.',
      'Payments are processed securely by Razorpay; Chikbo never sees or stores your card, UPI or banking credentials.',
      'You can update your profile and addresses, or reach us at +91 93460 60635 for any data-related request.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    body: [
      'By shopping at Chikbo you agree to provide accurate information, use the site for personal purchases and treat our genuine damage return policy in good faith.',
      'All prices are in Indian Rupees and include applicable taxes. Product colours may vary slightly due to photography and screen differences — that is the nature of handloom and craft.',
      'Chikbo — dealing in textiles since 1992. 21-1-684 & 85, Rikab gunj, Hyderabad.',
    ],
  },
};

export default function Policy() {
  const { slug = '' } = useParams();
  const policy = POLICIES[slug];
  usePageMeta(policy?.title ?? 'Policy', policy?.body[0]);

  if (!policy) return <NotFoundPage />;

  return (
    <div className="container page" style={{ maxWidth: 760 }}>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: policy.title }]} />
      <span className="overline" style={{ marginTop: 24 }}>
        Chikbo policies
      </span>
      <h1 style={{ fontSize: 'clamp(28px, 3.6vw, 40px)', marginBottom: 24 }}>{policy.title}</h1>
      {policy.body.map((paragraph, i) => (
        <p key={i} style={{ marginBottom: 16, maxWidth: 640 }}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}
