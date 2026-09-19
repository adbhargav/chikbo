import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/Modal';
import { CardSkeleton, ErrorState, PageHead } from '../components/ui';
import { useSeoAudit, type BulkTarget, type SeoAudit, type SeoCheck } from '../lib/seo';
import { SeoSettingsForm } from './SeoSettingsForm';
import { SeoRedirects } from './SeoRedirects';

type Tab = 'overview' | 'settings' | 'redirects';
const TABS: { key: Tab; label: string; to: string }[] = [
  { key: 'overview', label: 'Health', to: '/settings/seo' },
  { key: 'settings', label: 'Settings', to: '/settings/seo/settings' },
  { key: 'redirects', label: 'Redirects', to: '/settings/seo/redirects' },
];

/** Weighted score as a ring — one glance is meant to be enough. */
function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const tone = score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor';
  return (
    <div className={`score-ring score-ring--${tone}`} role="img" aria-label={`SEO health score ${score} out of 100`}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="score-track" cx="64" cy="64" r={radius} />
        <circle
          className="score-value"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, score)) / 100)}
        />
      </svg>
      <div className="score-num">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: SeoCheck }) {
  return (
    <li className={`seo-check${check.ok ? '' : ' seo-check--warn'}`}>
      <span className="seo-check-mark" aria-hidden="true">
        {check.ok ? '✓' : '!'}
      </span>
      <span className="seo-check-label">{check.label}</span>
      {check.detail && <span className="seo-check-detail">{check.detail}</span>}
      <span className={`pill ${check.ok ? 'success' : 'warn'}`}>{check.ok ? 'Pass' : 'Needs work'}</span>
    </li>
  );
}

interface BulkAction {
  target: BulkTarget;
  label: string;
  blurb: string;
  /** Exactly what the server writes, spelled out before anyone clicks. */
  fills: string;
  pending: (a: SeoAudit) => number;
}

const BULK_ACTIONS: BulkAction[] = [
  {
    target: 'productTitles',
    label: 'Fill missing product titles',
    blurb: 'Products with no meta title get "Product name | Site name".',
    fills: 'the meta title of every active product whose title is empty',
    pending: (a) => a.counts.missingTitle,
  },
  {
    target: 'productDescriptions',
    label: 'Fill missing product descriptions',
    blurb: 'Products with no meta description get the first 158 characters of their own description.',
    fills: 'the meta description of every active product whose description is empty',
    pending: (a) => a.counts.missingDescription,
  },
  {
    target: 'imageAlt',
    label: 'Fill missing image alt text',
    blurb: 'Product images with no alt text get their product name.',
    fills: 'the alt text of every product image that has none',
    pending: (a) => a.counts.imagesMissingAlt,
  },
  {
    target: 'productSlugs',
    label: 'Fill in missing product web addresses',
    blurb: 'Only touches products with no web address — existing links never change.',
    fills: 'the web address of any product that has none',
    pending: () => 0,
  },
];

function Overview({ canWrite }: { canWrite: boolean }) {
  const audit = useSeoAudit();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<BulkAction | null>(null);

  const bulk = useMutation({
    mutationFn: (target: BulkTarget) =>
      api<{ updated: number }>('/admin/seo/bulk', { method: 'POST', body: { target, overwrite: false } }),
    onSuccess: (data) => {
      toast(data.updated === 0 ? 'Nothing needed filling' : `${data.updated} filled in`, 'success');
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ['seo-audit'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (err) => {
      toast(errorMessage(err), 'error');
      setConfirming(null);
    },
  });

  if (audit.isPending) return <CardSkeleton height={320} />;
  if (audit.isError) return <ErrorState error={audit.error} onRetry={() => audit.refetch()} />;

  const data = audit.data;
  const failing = data.checks.filter((c) => !c.ok).length;
  const counts: { label: string; value: number; alert?: boolean }[] = [
    { label: 'Active products', value: data.counts.totalProducts },
    { label: 'Missing titles', value: data.counts.missingTitle, alert: data.counts.missingTitle > 0 },
    {
      label: 'Missing descriptions',
      value: data.counts.missingDescription,
      alert: data.counts.missingDescription > 0,
    },
    { label: 'Categories', value: data.counts.totalCategories },
    { label: 'Images without alt', value: data.counts.imagesMissingAlt, alert: data.counts.imagesMissingAlt > 0 },
    { label: 'Hidden from search', value: data.counts.noindexProducts },
    { label: 'Redirects', value: data.counts.redirects },
  ];

  return (
    <div className="stack">
      <div className="card pad">
        <div className="seo-score">
          <ScoreRing score={data.score} />
          <div className="seo-score-body">
            <h3 className="card-title" style={{ marginBottom: 6 }}>
              {failing === 0
                ? 'Everything checks out'
                : `${failing} of ${data.checks.length} checks need attention`}
            </h3>
            <p className="seo-lede" style={{ marginBottom: 12 }}>
              A weighted score across the site-wide settings and the catalogue. Products and image alt text count
              double — they are what search and social actually surface.
            </p>
            <ul className="seo-checks">
              {data.checks.map((c) => (
                <CheckRow key={c.key} check={c} />
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card pad">
        <h3 className="card-title">Catalogue coverage</h3>
        <div className="seo-counts">
          {counts.map((c) => (
            <div key={c.label} className={`seo-count${c.alert ? ' seo-count--alert' : ''}`}>
              <span className="seo-count-n">{c.value.toLocaleString('en-IN')}</span>
              <span className="seo-count-l">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card pad">
        <h3 className="card-title">Bulk fill-in</h3>
        <p className="seo-lede">
          These only write to fields that are <strong>empty</strong>. Anything already written by hand is left
          exactly as it is — there is no overwrite mode.
        </p>
        <ul className="seo-bulk">
          {BULK_ACTIONS.map((action) => {
            const pending = action.pending(data);
            return (
              <li key={action.target}>
                <div className="seo-bulk-copy">
                  <span className="seo-bulk-label">{action.label}</span>
                  <span className="seo-bulk-blurb">{action.blurb}</span>
                </div>
                {pending > 0 && <span className="pill warn">{pending} empty</span>}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!canWrite || bulk.isPending}
                  onClick={() => setConfirming(action)}
                >
                  Run
                </button>
              </li>
            );
          })}
        </ul>
        {!canWrite && <p className="seo-lede">You need product write access to run these.</p>}
      </div>

      <div className="card pad">
        <h3 className="card-title">Crawler endpoints</h3>
        <p className="seo-lede">Served live from the database. Open them to check what a crawler sees right now.</p>
        <dl className="seo-endpoints">
          <dt>robots.txt</dt>
          <dd>
            <a className="link" href={data.robotsUrl} target="_blank" rel="noreferrer">
              {data.robotsUrl}
            </a>
          </dd>
          <dt>sitemap.xml</dt>
          <dd>
            <a className="link" href={data.sitemapUrl} target="_blank" rel="noreferrer">
              {data.sitemapUrl}
            </a>
          </dd>
        </dl>
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming.label}
          confirmLabel="Fill empty fields"
          busy={bulk.isPending}
          onClose={() => setConfirming(null)}
          onConfirm={() => bulk.mutate(confirming.target)}
          message={
            <>
              This fills in <strong>{confirming.fills}</strong>.
              <br />
              <br />
              Fields that already have a value are <strong>never</strong> touched — nothing you or a colleague
              wrote by hand will be overwritten. You can still edit any of it afterwards.
            </>
          }
        />
      )}
    </div>
  );
}

/**
 * Settings → SEO. Reading is gated on dashboard.view (the API gates it the same
 * way); saving additionally needs products.write, so a read-only viewer gets the
 * whole picture without a button that would 403.
 */
export function Seo() {
  const { tab } = useParams<{ tab?: string }>();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('products.write');
  const active: Tab = tab === 'settings' || tab === 'redirects' ? tab : 'overview';

  return (
    <main className="page">
      <PageHead
        overline="Settings"
        title="SEO"
        sub="What Google indexes and what WhatsApp shows when someone shares a link."
      />

      <div className="segmented" style={{ marginBottom: 18 }}>
        {TABS.map((t) => (
          <NavLink key={t.key} to={t.to} end className={t.key === active ? 'active' : ''} role="tab">
            {t.label}
          </NavLink>
        ))}
      </div>

      {active === 'overview' && <Overview canWrite={canWrite} />}
      {active === 'settings' && <SeoSettingsForm canWrite={canWrite} />}
      {active === 'redirects' && <SeoRedirects canWrite={canWrite} />}
    </main>
  );
}
