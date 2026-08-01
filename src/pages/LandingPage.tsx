import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LandingPage.css';

export default function LandingPage() {
  const { profile, configured } = useAuth();

  const primaryCta = profile ? (
    <Link className="button" to="/my-card">
      Go to My Card
    </Link>
  ) : (
    <Link className="button" to="/request-invite">
      Get started
    </Link>
  );

  const secondaryCta = profile ? null : (
    <Link className="button secondary" to="/login">
      Sign in
    </Link>
  );

  return (
    <div className="landing">
      <section className="landing-hero" aria-label="Kappa Card introduction">
        <div className="landing-hero-copy">
          <h1 className="landing-brand">Never Forget A Brother</h1>
          <p className="landing-headline">Make every introduction a lasting&nbsp;connection.</p>
          <p className="landing-lede">
          Skip the awkward exchange of phone numbers and social media handles. Share a complete contact with a single scan.
          </p>
          <div className="landing-actions">
            {primaryCta}
            {secondaryCta}
          </div>
          {!configured && (
            <p className="error" style={{ margin: 0 }}>
              Firebase is not configured yet. Copy <code>.env.example</code> to{' '}
              <code>.env.local</code> before signing in.
            </p>
          )}
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <img
            className="landing-phone"
            src="/card_phone.png"
            alt="Mockup of a Kappa Card and contact information on a phone"
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <h2>Built for brothers</h2>
          <p>Professional contact sharing with privacy and accountability in mind.</p>
        </div>
        <div className="landing-points">
          <article className="landing-point">
            <h3>Always Up to Date</h3>
            <p>
              Your QR links to a live profile URL. Update your phone or job once — every scan stays
              current.
            </p>
          </article>
          <article className="landing-point">
            <h3>Share Only What You Choose</h3>
            <p>
              Name, chapter, and initiation year stay public. Everything else can be Public or
              Private.
            </p>
          </article>
          <article className="landing-point">
            <h3>A Trusted Brotherhood</h3>
            <p>
              Every member is tied to who invited them — keeping the network intentional, not open
              to anyone with a link.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <h2>How it works</h2>
          <p>From invite to saved contact — built for real-world introductions.</p>
        </div>
        <ol className="landing-steps">
          <li>
            <h3>Receive an Invite</h3>
            <p>Signup requires a member invite, so the network stays accountable.</p>
          </li>
          <li>
            <h3>Create Your Card</h3>
            <p>Add your details and choose what’s public vs private on your card.</p>
          </li>
          <li>
            <h3>Save to Photos</h3>
            <p>Download a branded image with a QR that always points to your live page.</p>
          </li>
          <li>
            <h3>Meet &amp; Connect</h3>
            <p>Scanners open your page and tap Add to Contacts — no app install needed.</p>
          </li>
        </ol>
      </section>


      <section className="landing-section landing-close">
      <div className="landing-cta-ad-content">
        <h2>Create&nbsp;it&nbsp;once. Keep&nbsp;it&nbsp;forever. Update&nbsp;it&nbsp;anytime.</h2>
        <p> Join a growing network of brothers making every introduction a lasting connection.
        </p>
        </div>
        <div className="landing-cta-ad-content landing-actions">
          {primaryCta}
          {secondaryCta}
        </div>
      </section>
    </div>
  );
}
