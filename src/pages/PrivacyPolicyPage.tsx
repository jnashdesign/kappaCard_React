import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { LEGAL } from '../lib/legal';
import './LegalDocument.css';

export default function PrivacyPolicyPage() {
  const { productName, siteName, siteOrigin, operatorName, contactEmail, effectiveDate } = LEGAL;

  return (
    <article className="legal-page stack">
      <PageMeta
        title={`Privacy Policy — ${productName}`}
        description={`How ${productName} collects, uses, and shares member information on ${siteName}.`}
        path="/privacy"
      />

      <div>
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Effective {effectiveDate}</p>
      </div>

      <p>
        This Privacy Policy describes how <strong>{operatorName}</strong> (“we”, “us”) handles
        information when you use {productName} at{' '}
        <a href={siteOrigin}>{siteName}</a> (the “Service”).
      </p>

      <h2>1. Who this applies to</h2>
      <p>
        It applies to visitors, people who request an invite, and members who create an account.
        The Service is intended for adults participating in a private, invite-gated member network—not
        for children under 13 (and we do not knowingly collect data from children under 13).
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li>
          <strong>Account &amp; authentication.</strong> Email address, password (stored by Firebase
          Authentication—not in our member database as plaintext), and optional Google sign-in
          identity.
        </li>
        <li>
          <strong>Profile &amp; card details.</strong> Name, username, chapter, initiation year, and
          optional fields you choose to add (phone, occupation, employer, city, province, photos,
          websites, social handles, and similar).
        </li>
        <li>
          <strong>Invite &amp; accountability data.</strong> Invite codes, who invited whom, invite
          requests (name, chapter, year, email), and related timestamps.
        </li>
        <li>
          <strong>Brothers &amp; meetings.</strong> Brothers you meet via QR or save to Contacts,
          plus optional private notes, event, and location you add for yourself.
        </li>
        <li>
          <strong>Usage &amp; product analytics.</strong> Counters such as logins, card views,
          contact downloads, and profile updates used for operating and improving the Service
          (including admin analytics).
        </li>
        <li>
          <strong>Payments.</strong> If you purchase Basic, payment is processed by Stripe. We
          receive payment status and related records needed to unlock your account; we do not store
          full card numbers.
        </li>
        <li>
          <strong>Email reminders.</strong> If Brothers recap email is enabled, we use your profile
          email and timezone to send digests (via Resend).
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>Provide live cards, QR sharing, vCards, invites, Brothers list, and account features</li>
        <li>Authenticate you and secure the Service</li>
        <li>Process one-time Basic purchases and promotional unlocks (such as Inaugural membership)</li>
        <li>Send optional Brothers recap emails you can turn off in Profile</li>
        <li>Operate invite review, admin tools, abuse prevention, and product analytics</li>
        <li>Respond to support and privacy requests</li>
      </ul>

      <h2>4. What others can see</h2>
      <p>
        Your <strong>public card</strong> at <code>/card/&#123;username&#125;</code> is designed to be
        opened by people you share it with (including via QR). Always-public fields include name,
        username, chapter, initiation year, and invite accountability details we show on the card.
      </p>
      <p>
        Optional fields default to public until you mark them <strong>Private</strong> in Profile.
        Private fields are kept on your account record for you (and service administrators) and are
        not included in the public card projection others load.
      </p>
      <p>
        When someone saves you to Contacts, the contact file may include the public details available
        on your card at that time (including a public profile photo when present).
      </p>

      <h2>5. Service providers</h2>
      <p>We use trusted processors to run the Service, including:</p>
      <ul>
        <li>Google Firebase (Authentication, Firestore, Storage, Hosting, Cloud Functions)</li>
        <li>Stripe (checkout and payment processing)</li>
        <li>Resend (transactional / recap email delivery)</li>
      </ul>
      <p>
        These providers process data on our behalf under their terms and security practices. We do
        not sell your personal information.
      </p>

      <h2>6. Retention &amp; deletion</h2>
      <p>
        We keep account and profile data while your account is active. You may delete your account
        from Profile (subject to re-authentication). Deletion removes your auth user, profile,
        username aliases, invites you created, profile media we store, and related member data we
        control, as described in the product. We may retain limited records needed for security,
        fraud prevention, legal compliance, or churn analytics (for example an account-deletion log
        without restoring your live profile).
      </p>

      <h2>7. Your choices</h2>
      <ul>
        <li>Edit profile fields and Public/Private toggles anytime</li>
        <li>Disable Brothers recap email in Profile → Email reminders</li>
        <li>Delete your account in Profile</li>
        <li>
          Contact us at <a href={`mailto:${contactEmail}`}>{contactEmail}</a> for privacy questions
          or access requests we can reasonably fulfill
        </li>
      </ul>

      <h2>8. Security</h2>
      <p>
        We use platform security controls (including Firebase Auth for passwords, encrypted storage
        at rest from our cloud providers, and access rules that limit private profile data to the
        account owner and administrators). No method of transmission or storage is 100% secure.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this Policy as the Service evolves. We will post the updated version on this
        page and revise the effective date. Continued use after changes means you accept the updated
        Policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>

      <p className="legal-note">
        Related: <Link to="/terms">Terms of Service</Link>. This page describes our practices for{' '}
        {productName}; it is not legal advice.
      </p>
    </article>
  );
}
