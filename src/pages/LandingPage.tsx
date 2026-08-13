import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useAuth } from '../contexts/AuthContext';
import { canUseCardFeatures } from '../lib/users';
import './LandingPage.css';

export default function LandingPage() {
  const { profile, configured } = useAuth();

  const primaryCta = profile ? (
    <Link className="button primary" to="/my-card">
      Go to My Card
    </Link>
  ) : (
    <Link className="button primary" to="/request-invite">
      Request An Invite
    </Link>
  );

  const secondaryCta = profile ? (
    !canUseCardFeatures(profile) ? (
      <Link className="button secondary" to="/pricing">
        View pricing
      </Link>
    ) : null
  ) : (
    <Link className="button secondary" to="/login">
      Sign in
    </Link>
  );

  return (
    <div className="landing">
      <PageMeta path="/" />
      <section className="landing-hero full-width" aria-label="Kappa Card introduction">
        <div className="landing-hero-copy">
          <h1 className="landing-brand">Never Forget A Brother&nbsp;Again</h1>
          <p className="landing-headline">Make lasting connections in less than 30&nbsp;seconds.</p>
          <p className="landing-lede">Skip the awkward exchange of phone numbers, email addresses and social media handles.<br/><br/><span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Share everything with one scan — and actually remember who you&nbsp;met.</span>
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

        <div className="landing-hero-visual mobile-only" aria-hidden="true">
          <img
            className="landing-phone"
            src="/kappaCard_intraction_mobile.png"
            alt="Mockup of a Kappa Card and contact information on a phone"
          />
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <h2>Perfect For Hallway Conversations</h2>
          <p>One scan. Always current. Not lost in your camera roll.</p>
        </div>
        <div className="landing-points">
          <article className="landing-point">
            <h3>Share Everything In One Scan</h3>
            <p>
            Show someone your card. They open your live page and save you to Contacts — phone, email, socials, photo without needing an app.
            </p>
          </article>
          <article className="landing-point">
            <h3>Your info stays up to date</h3>
            <p>
            Change your number or job? Every future scan stays current — unlike a screenshot or paper card.
            </p>
          </article>
          <article className="landing-point">
            <h3>Remember who you met</h3>
            <p>
            Brothers you've scanned are saved live in one list — with the event and a note, so "who was that?"" doesn't happen later.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <h2>Build A Lasting Connection</h2>
          <p>Three steps. No app required for the brother scanning you.</p>
        </div>
        <ol className="landing-steps">
          <li>
            <h3>Create your card</h3>
            <p>Add whatever details you want to share with brothers you meet.</p>
          </li>
          <li>
            <h3>Share your QR</h3>
            <p>Save the card to your Photos or show it on your phone.</p>
          </li>
          <li>
            <h3>You're Good To Go</h3>
            <p>You're added to their Contacts, they're added to your Brothers.</p>
          </li>
        </ol>
      </section>


      <section className="landing-section landing-trust-strip">
      <h2>Accountability &amp; Privacy</h2>
      <div className="landing-trust-strip-content">
        <div className="landing-trust-strip-content-text accountibility">
        <img src="/accountability.png" alt="Accountability in the card." />
        <div>
        <h3>Invite-Only Membership</h3>
        <p>Every brother's card ties them to who invited&nbsp;them.</p>
        </div>
        </div>
        <div className="landing-trust-strip-content-text privacy">
        <img src="/privacy.png" alt="Work place in the profile." />
        <div><h3>Choose What You Share</h3>
        <p>Only name, chapter, and year are required to be&nbsp;public.
        </p>
        </div>
        </div>
        </div>
      </section>

      <section className="landing-section landing-close">
      <div className="landing-cta-ad-content">
        <h2>Create&nbsp;it&nbsp;once. Keep&nbsp;it&nbsp;forever. Update&nbsp;anytime.</h2>
        <p>Turn every introduction into a lasting connection.
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
