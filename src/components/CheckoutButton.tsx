import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { startBasicCheckout } from '../lib/stripe';
import { canUseCardFeatures } from '../lib/users';

type Props = {
  className?: string;
  label?: string;
};

export default function CheckoutButton({
  className = 'button',
  label = 'Unlock Basic — $9.99',
}: Props) {
  const { profile, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await startBasicCheckout();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not start checkout. Try again.';
      setError(
        message.includes('internal') || message.includes('not-found')
          ? 'Stripe checkout is not live yet. Ask an admin for complimentary Basic access, or try again after payments are enabled.'
          : message
      );
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: '0.55rem' }}>
      <button type="button" className={className} disabled={busy} onClick={() => void onClick()}>
        {busy ? 'Redirecting to Stripe…' : firebaseUser ? label : 'Get Started'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
