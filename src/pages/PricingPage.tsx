import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CheckoutButton from '../components/CheckoutButton';
import PageMeta from '../components/PageMeta';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchFoundingPromoStatus,
  subscribeFoundingPromo,
  type FoundingPromoStatus,
} from '../lib/foundingPromo';
import { BASIC_PRICE_LABEL } from '../lib/stripe';
import { canUseCardFeatures } from '../lib/users';
import './PricingPage.css';

const FEATURES = [
  {
    title: 'Branded Kappa Card + QR',
    detail: 'Download a saveable card image with a QR that always opens your live profile.',
  },
  {
    title: 'Live public page',
    detail: 'Share /card/yourname so brothers can Add to Contacts without installing an app.',
  },
  {
    title: 'Invite new members',
    detail: 'Send one-time invite codes and keep the network accountable to who invited whom.',
  },
  {
    title: 'Field-level privacy',
    detail: 'Keep name, chapter, and year public — and choose what’s private on everything else.',
  },
  {
    title: 'Always up to date',
    detail: 'Change your phone or job once; every future scan reflects the latest details.',
  },
  {
    title: 'One-time purchase',
    detail: 'No subscription. Pay once for Basic and keep your card for as long as you need it.',
  },
] as const;

export default function PricingPage() {
  const { profile, firebaseUser } = useAuth();
  const unlocked = canUseCardFeatures(profile);
  const [promo, setPromo] = useState<FoundingPromoStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchFoundingPromoStatus()
      .then((status) => {
        if (!cancelled) setPromo(status);
      })
      .catch(() => undefined);
    const unsub = subscribeFoundingPromo((status) => {
      if (!cancelled && status) setPromo(status);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const foundingOpen = Boolean(promo?.enabled && promo.remaining > 0);

  return (
    <div className="pricing">
      <PageMeta
        title="Pricing — Kappa Card"
        description="One-time Basic purchase for a branded Kappa Card, live QR profile, field-level privacy, and invite accountability. No subscription."
        path="/pricing"
      />
      <section className="pricing-hero">
        <h1>Simple pricing for a dynamic card</h1>
        <p>
          Pay one time, create your branded card, share a live QR link, and invite brothers into a
          trusted network.
        </p>
        {promo && promo.enabled && (
          <p className={`pricing-inaugural ${foundingOpen ? 'open' : 'closed'}`}>
            {foundingOpen ? (
              <>
                <strong>{promo.remaining}</strong> of {promo.limit} Inaugural spots left — free Basic
                for early members, then {BASIC_PRICE_LABEL} one-time.
              </>
            ) : (
              <>
                The Inaugural {promo.limit} are claimed. Basic is {BASIC_PRICE_LABEL} one-time.
              </>
            )}
          </p>
        )}
      </section>

      <div className="pricing-layout">
        <aside className="pricing-card" aria-label="Basic plan">
          <p className="pricing-card-eyebrow">Basic</p>
          <div className="pricing-amount">
            {foundingOpen ? (
              <>
                <span className="pricing-amount-was">{BASIC_PRICE_LABEL}</span>
                <strong>Free</strong>
                <span>Inaugural offer</span>
              </>
            ) : (
              <>
                <strong>{BASIC_PRICE_LABEL}</strong>
                <span>one-time</span>
              </>
            )}
          </div>
          <h2>Everything you need to build meaningful connections</h2>

          <p>
            {foundingOpen
              ? `First ${promo!.limit} members unlock Basic free as Inaugural members. After that, ${BASIC_PRICE_LABEL} one-time.`
              : 'Unlock card generation, your live public page, and invites.'}
          </p>

          {unlocked ? (
            <>
              <p className="success">You already have Basic (or higher) access.</p>
              <Link className="button" to="/my-card">
                Open My Card
              </Link>
            </>
          ) : (
            <>
              <CheckoutButton
                promo={promo}
                label={
                  foundingOpen
                    ? `Claim free Basic (${promo!.remaining} left)`
                    : `Unlock Basic — ${BASIC_PRICE_LABEL}`
                }
              />
              {!firebaseUser && (
                <p className="muted">
                  New here?{' '}
                  <Link
                    to="/request-invite"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    Request an invite
                  </Link>{' '}
                  first
                  {foundingOpen
                    ? ', then claim an Inaugural spot after signup.'
                    : ', then unlock after signup.'}
                </p>
              )}
            </>
          )}
        </aside>
        <ul className="pricing-features">
          <h2>Features Included in Basic</h2>
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <span className="check" aria-hidden="true">
                ✓
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
