import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canUseCardFeatures } from '../lib/users';

/**
 * Stripe redirects here after Checkout. The webhook upgrades `tier` to basic;
 * we poll the auth profile briefly so the UI unlocks without a manual refresh.
 */
export default function UpgradeSuccessPage() {
  const { profile, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [seconds, setSeconds] = useState(0);
  const unlocked = canUseCardFeatures(profile);

  useEffect(() => {
    if (unlocked) return;
    const id = window.setInterval(() => {
      setSeconds((s) => s + 1);
      void refreshProfile();
    }, 1500);
    return () => window.clearInterval(id);
  }, [unlocked, refreshProfile]);

  return (
    <section className="panel stack" style={{ maxWidth: 560 }}>
      <h1>{unlocked ? 'You\'re unlocked' : 'Payment received'}</h1>
      {unlocked ? (
        <>
          <p className="muted">
            Basic is active on your account. Generate your Kappa Card and start inviting brothers.
          </p>
          <div className="row">
            <Link className="button" to="/my-card">
              Open My Card
            </Link>
            <Link className="button secondary" to="/invites">
              Create invites
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Thanks — Stripe confirmed checkout
            {sessionId ? ' (session received)' : ''}. We&apos;re applying Basic to your account
            {seconds > 0 ? `… (${seconds}s)` : '…'}
          </p>
          <p className="muted">
            This usually takes a few seconds. If it stays pending, refresh or contact an admin with
            your email.
          </p>
          <Link className="button secondary" to="/pricing">
            Back to pricing
          </Link>
        </>
      )}
    </section>
  );
}
