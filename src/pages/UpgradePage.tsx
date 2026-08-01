import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canUseCardFeatures } from '../lib/users';

/**
 * Stripe one-time checkout will plug in here.
 * Until then, admins assign free/basic/premium from the Admin page or seed scripts.
 */
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
          One-time purchase unlocks Kappa Card generation and invites. Premium is reserved for
          future features.
        </p>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>Basic — one-time</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7 }}>
          <li>Branded Kappa Card image + QR</li>
          <li>Live public page at /card/yourname</li>
          <li>Invite new members</li>
        </ul>
        <button type="button" disabled title="Stripe checkout coming next">
          Purchase with Stripe (coming soon)
        </button>
        <p className="muted">
          While seeding the network, an admin can set invited brothers to <strong>free</strong> or{' '}
          <strong>basic</strong> from the Admin page.
        </p>
      </div>
    </section>
  );
}
