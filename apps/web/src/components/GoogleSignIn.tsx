import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

/**
 * "Continue with Google", styled to the Chikbo design system.
 *
 * Two transports, chosen by what the API says is configured (GET
 * /auth/providers — no frontend env vars needed):
 *
 *  1. Firebase Authentication (preferred). Our own pill opens Firebase's
 *     Google popup; the resulting Firebase ID token is exchanged at
 *     POST /auth/firebase. The Firebase SDK is imported lazily on demand so
 *     it never weighs down the main bundle.
 *  2. Legacy Google Identity Services. GIS only hands back an ID token from a
 *     click on a button it rendered itself, so its button is stretched
 *     invisibly over ours and the token goes to POST /auth/google.
 *
 * When neither is configured the pill still renders and a click explains
 * what is missing, rather than the button vanishing from the page.
 */

interface ProvidersResponse {
  google: { enabled: boolean; clientId: string };
  firebase:
    | { enabled: true; apiKey: string; authDomain: string; projectId: string }
    | { enabled: false };
}

interface CredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google script failed to load')));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed to load'));
    document.head.appendChild(script);
  });
}

/** Runs Firebase's Google popup and returns the Firebase ID token. */
async function firebaseGoogleIdToken(config: { apiKey: string; authDomain: string; projectId: string }): Promise<string> {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth, signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
  const app = getApps()[0] ?? initializeApp(config);
  const result = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
  return result.user.getIdToken();
}

/** Popup dismissals the customer caused on purpose — not errors worth a toast. */
function isPopupDismissal(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled';
}

/** Official four-colour Google "G". */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function GoogleSignIn({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const { loginWithGoogle, loginWithFirebase } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const overlay = useRef<HTMLDivElement>(null);
  const [firebaseConfig, setFirebaseConfig] = useState<{ apiKey: string; authDomain: string; projectId: string } | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const finishSignIn = useCallback(
    async (exchange: () => Promise<void>) => {
      await exchange();
      toast.show('Welcome to Chikbo.', 'success');
      navigate(from, { replace: true });
    },
    [toast, navigate, from],
  );

  const onGisCredential = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) return;
      setBusy(true);
      try {
        await finishSignIn(() => loginWithGoogle(response.credential as string));
      } catch (err) {
        toast.show(err instanceof Error ? err.message : 'Google sign-in failed.', 'error');
      } finally {
        setBusy(false);
      }
    },
    [finishSignIn, loginWithGoogle, toast],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const providers = await api<ProvidersResponse>('/auth/providers');
        if (cancelled) return;

        if (providers.firebase.enabled) {
          const { apiKey, authDomain, projectId } = providers.firebase;
          setFirebaseConfig({ apiKey, authDomain, projectId });
          return;
        }

        if (!providers.google.enabled) return;
        await loadGis();
        if (cancelled || !overlay.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: providers.google.clientId,
          callback: (response) => void onGisCredential(response),
          cancel_on_tap_outside: true,
        });
        // Rendered large, then scaled to cover our pill by CSS.
        window.google.accounts.id.renderButton(overlay.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          width: 400,
        });
        setGisReady(true);
      } catch {
        /* leave the styled button in place; the click handler explains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, onGisCredential]);

  const onClick = async () => {
    if (gisReady) return; // the GIS overlay handled the click
    if (!firebaseConfig) {
      toast.show('Google Sign-In is not switched on yet. Add FIREBASE_WEB_API_KEY to enable it.', 'info');
      return;
    }
    setBusy(true);
    try {
      const idToken = await firebaseGoogleIdToken(firebaseConfig);
      await finishSignIn(() => loginWithFirebase(idToken));
    } catch (err) {
      if (!isPopupDismissal(err)) {
        const message =
          (err as { code?: string } | null)?.code === 'auth/popup-blocked'
            ? 'Your browser blocked the sign-in window. Allow popups for this site and try again.'
            : err instanceof Error
              ? err.message
              : 'Google sign-in failed.';
        toast.show(message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oauth-block">
      <div className="oauth-divider">
        <span>or continue with</span>
      </div>

      <div className={`oauth-button-wrap${gisReady ? ' oauth-button-wrap--live' : ''}`}>
        <button
          type="button"
          className="oauth-button"
          onClick={() => void onClick()}
          disabled={busy}
          aria-label={mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
        >
          <GoogleGlyph />
          <span>{busy ? 'Signing in…' : mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
        </button>
        {/* Legacy GIS flow only: Google's own button, invisible, stretched over ours. */}
        <div ref={overlay} className="oauth-overlay" aria-hidden="true" />
      </div>
    </div>
  );
}
