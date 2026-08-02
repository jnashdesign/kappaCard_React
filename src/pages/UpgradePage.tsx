import { Link } from 'react-router-dom';
import CheckoutButton from '../components/CheckoutButton';
import { useAuth } from '../contexts/AuthContext';
import { BASIC_PRICE_LABEL } from '../lib/stripe';
import { canUseCardFeatures } from '../lib/users';

export default function UpgradePage() {
  const { profile } = useAuth();

  if (!profile) return <div className="panel">Loading…</div>;

  if (canUseCardFeatures(profile)) {
    return (
      <div className="panel stack">
        <h1>You&apos;re unlocked</h1>
        <p className="muted">
          Current tier: <strong>{profile.tier}</strong>. Premium features are reserved for later.
        </p>
        <Link className="button" to="/my-card">
          Open My Card
        </Link>
      </div>
    );
  }

  return (
    <section className="stack" style={{ maxWidth: 560 }}>
      <div>
        <h1>Unlock Basic</h1>
        <p className="muted">
          One-time {BASIC_PRICE_LABEL} purchase unlocks Kappa Card generation and invites. See the
          full feature list on the pricing page.
        </p>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Basic — {BASIC_PRICE_LABEL} one-time</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
          <li>Branded Kappa Card image + QR</li>
          <li>Live public page at /card/yourname</li>
          <li>Invite new members</li>
          <li>Field-level privacy controls</li>
        </ul>
        <CheckoutButton label={`Purchase with Stripe — ${BASIC_PRICE_LABEL}`} />
        <p className="muted">
          Prefer details first?{' '}
          <Link to="/pricing">View pricing</Link>. During early rollout, an admin can also grant
          complimentary Basic from the Admin page.
        </p>
      </div>
    </section>
  );
}
