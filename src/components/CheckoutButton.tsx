import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  claimFoundingBasic,
  fetchFoundingPromoStatus,
  subscribeFoundingPromo,
  type FoundingPromoStatus,
} from '../lib/foundingPromo';
import { startBasicCheckout } from '../lib/stripe';
import { canUseCardFeatures } from '../lib/users';

type Props = {
  className?: string;
  label?: string;
  /** When set, skip local promo subscribe (parent already loaded status). */
  promo?: FoundingPromoStatus | null;
};

export default function CheckoutButton({
  className = 'button',
  label = 'Unlock Basic — $9.99',
  promo: promoProp,
}: Props) {
  const { profile, firebaseUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoLocal, setPromoLocal] = useState<FoundingPromoStatus | null>(null);

  useEffect(() => {
    if (promoProp !== undefined) return;
    let cancelled = false;
    void fetchFoundingPromoStatus()
      .then((status) => {
        if (!cancelled) setPromoLocal(status);
      })
      .catch(() => undefined);
    const unsub = subscribeFoundingPromo((status) => {
      if (!cancelled && status) setPromoLocal(status);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [promoProp]);

  const promo = promoProp !== undefined ? promoProp : promoLocal;
  const freeSpots = Boolean(promo && promo.enabled && promo.remaining > 0);

  if (canUseCardFeatures(profile)) {
    return (
      <Link className={className} to="/my-card">
        Open My Card
      </Link>
    );
  }

  async function onClick() {
    setError(null);

    if (!firebaseUser) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }

    if (!profile) {
      navigate('/complete-profile');
      return;
    }

    setBusy(true);
    try {
      if (freeSpots) {
        const result = await claimFoundingBasic();
        if (result.status === 'exhausted') {
          await startBasicCheckout();
          return;
        }
        await refreshProfile();
        navigate('/my-card');
        return;
      }
      await startBasicCheckout();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not start checkout. Try again.';
      const cleaned = message
        .replace(/^FirebaseError:\s*/i, '')
        .replace(/^(internal|failed-precondition|invalid-argument|unavailable):\s*/i, '');
      setError(cleaned || message);
      setBusy(false);
    }
  }

  const buttonLabel = !firebaseUser
    ? 'Get Started'
    : freeSpots
      ? `Claim free Basic (${promo!.remaining} left)`
      : label;

  return (
    <div className="stack" style={{ gap: '0.55rem' }}>
      <button type="button" className={className} disabled={busy} onClick={() => void onClick()}>
        {busy
          ? freeSpots
            ? 'Claiming free Basic…'
            : 'Redirecting to Stripe…'
          : buttonLabel}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
