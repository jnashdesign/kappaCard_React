import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { LEGAL } from '../lib/legal';
import './LegalDocument.css';

export default function TermsOfServicePage() {
  const {
    productName,
    siteName,
    siteOrigin,
    operatorName,
    contactEmail,
    governingLawState,
    effectiveDate,
  } = LEGAL;

  return (
    <article className="legal-page stack">
      <PageMeta
        title={`Terms of Service — ${productName}`}
        description={`Terms for using ${productName} on ${siteName}, including accounts, invites, and Basic purchase.`}
        path="/terms"
      />

      <div>
        <h1>Terms of Service</h1>
        <p className="legal-meta">Effective {effectiveDate}</p>
      </div>

      <p>
        These Terms of Service (“Terms”) govern your use of {productName} at{' '}
        <a href={siteOrigin}>{siteName}</a> (the “Service”), operated by{' '}
        <strong>{operatorName}</strong> (“we”, “us”). By creating an account, requesting an invite,
        or using the Service, you agree to these Terms and our{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. The Service</h2>
      <p>
        {productName} is an invite-gated web app for sharing a live member card (QR / public profile),
        saving contacts, remembering brothers you meet, and related features described in the
        product. Features may change as we improve the Service.
      </p>

      <h2>2. Eligibility &amp; invites</h2>
      <ul>
        <li>You must be able to form a binding contract and use the Service lawfully.</li>
        <li>
          Signup is invite-gated (except limited admin bootstrap). You are responsible for keeping
          invite codes you create under control.
        </li>
        <li>
          Invite accountability (who invited whom) may be shown on cards and related surfaces as part
          of the product design.
        </li>
      </ul>

      <h2>3. Accounts</h2>
      <ul>
        <li>Provide accurate information and keep your credentials secure.</li>
        <li>You are responsible for activity under your account.</li>
        <li>
          Usernames are public slugs for your card URL. Do not choose usernames that infringe others’
          rights or impersonate someone else.
        </li>
      </ul>

      <h2>4. Your content &amp; public sharing</h2>
      <p>
        You retain ownership of the profile content you submit. You grant us a limited license to
        host, display, and process that content as needed to operate the Service (including public
        card pages, QR flows, vCards, and backups/ops).
      </p>
      <p>
        Content you mark public (or that is always public, such as name, chapter, and year) may be
        viewed by anyone with your card link. You are responsible for what you choose to share.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Harass, stalk, or harm others, or post unlawful, deceptive, or abusive content</li>
        <li>Attempt unauthorized access to accounts, data, or systems</li>
        <li>Scrape, spam, or abuse invites, analytics, or email features</li>
        <li>Use the Service in a way that violates law or these Terms</li>
      </ul>
      <p>We may suspend or terminate accounts that violate these Terms.</p>

      <h2>6. Paid features</h2>
      <ul>
        <li>
          Basic is offered as a one-time unlock (or promotional unlock such as Inaugural membership)
          as described on the Pricing page—not as a recurring subscription unless we clearly say
          otherwise later.
        </li>
        <li>Payments are processed by Stripe. Taxes may apply where required.</li>
        <li>
          Because digital unlocks are delivered immediately, purchases are generally non-refundable
          except where required by law or where we agree in writing after you contact{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </li>
      </ul>

      <h2>7. Third-party services</h2>
      <p>
        The Service depends on third parties (including Firebase/Google, Stripe, and email
        providers). Their outages or changes can affect availability. Links to third-party sites
        (for example chapter directories) are not under our control.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW,
        WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. We do not guarantee uninterrupted service, perfect data accuracy, or that
        contacts/devices will import vCards identically across platforms.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL,
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL. OUR
        TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE
        AMOUNT YOU PAID US FOR THE SERVICE IN THE 12 MONTHS BEFORE THE CLAIM OR (B) US $50.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You will defend and indemnify us against claims arising from your content, your misuse of the
        Service, or your violation of these Terms or applicable law.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the Service and delete your account in Profile. We may suspend or end
        access if you breach these Terms or if we discontinue the Service. Provisions that should
        survive (including ownership, disclaimers, and limitations) will survive termination.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of {governingLawState}, excluding conflict
        of law rules. Courts located in {governingLawState} will have exclusive jurisdiction,
        except where prohibited by law.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms by posting a revised version on this page. Continued use after the
        effective date means you accept the changes. If you do not agree, stop using the Service and
        delete your account.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>

      <p className="legal-note">
        Related: <Link to="/privacy">Privacy Policy</Link>. These Terms are a product agreement for{' '}
        {productName}; they are not legal advice. Consider having an attorney review them before wide
        commercial launch.
      </p>
    </article>
  );
}
