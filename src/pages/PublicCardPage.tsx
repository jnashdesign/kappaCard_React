import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isLikelyBotOrPreviewAgent } from '../lib/bots';
import { saveCollectedCard } from '../lib/collectedCards';
import {
  profileVisitSourceFromSearch,
  publicCardPathWithSearch,
  type ProfileVisitSource,
} from '../lib/cardUrl';
import { recordQrEncounter } from '../lib/encounters';
import { getUserById, getUserByUsername } from '../lib/users';
import { qrDevLog } from '../lib/qrDevLog';
import { recordPublicCardEngagement } from '../lib/userStats';
import { cardSurfaceBackground, isUsablePhotoUrl } from '../lib/photos';
import { formatUsPhone, phoneDigits } from '../lib/phone';
import { toPublicProfile } from '../lib/privacy';
import { isInauguralMember, inauguralSlotOf } from '../lib/foundingPromo';
import { publicSocialLinks, type SocialNetwork } from '../lib/social';
import { downloadVCard, formatInviter } from '../lib/vcard';
import type { UserProfile } from '../types';
import ChapterNameLink from '../components/ChapterNameLink';
import PageMeta, { DEFAULT_OG_IMAGE } from '../components/PageMeta';
import './PublicCardPage.css';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ΚΑΨ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="public-detail-label">{label}</span>
      <span className="public-detail-value">{value}</span>
    </>
  );

  if (href) {
    return (
      <a className="public-detail-row" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
        {content}
      </a>
    );
  }

  return <div className="public-detail-row">{content}</div>;
}

function SocialIcon({ network }: { network: SocialNetwork }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    'aria-hidden': true as const,
    focusable: false as const,
  };

  switch (network) {
    case 'linkedin':
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z"
          />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M18.24 2H21.5l-7.19 8.21L22.5 22h-6.59l-5.16-6.74L5.4 22H2.12l7.69-8.79L1.5 2h6.75l4.66 6.16L18.24 2zm-1.16 18h1.83L7.2 3.94H5.24L17.08 20z"
          />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2zm0 7.92A3.12 3.12 0 1 1 12 8.88a3.12 3.12 0 0 1 0 6.24zM17.52 6.98a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0zM12 2.16c-2.72 0-3.06.01-4.13.06-2.77.13-4.16 1.52-4.29 4.29-.05 1.07-.06 1.41-.06 4.13s.01 3.06.06 4.13c.13 2.76 1.52 4.16 4.29 4.29 1.07.05 1.41.06 4.13.06s3.06-.01 4.13-.06c2.77-.13 4.16-1.53 4.29-4.29.05-1.07.06-1.41.06-4.13s-.01-3.06-.06-4.13c-.13-2.77-1.52-4.16-4.29-4.29-1.07-.05-1.41-.06-4.13-.06zm0 1.8c2.67 0 2.99.01 4.04.06 1.97.09 2.9 1.02 2.99 2.99.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.09 1.96-1.02 2.9-2.99 2.99-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-1.97-.09-2.9-1.03-2.99-2.99-.05-1.05-.06-1.37-.06-4.04s.01-2.99.06-4.04c.09-1.97 1.02-2.9 2.99-2.99 1.05-.05 1.37-.06 4.04-.06z"
          />
        </svg>
      );
    case 'snapchat':
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M12.15.5c2.84 0 4.64 1.9 4.64 4.75 0 .55-.04 1.12-.08 1.66 1.04-.52 2.08-.92 3.1-.92.62 0 1.2.18 1.64.62.4.4.6.94.6 1.5 0 .9-.56 1.62-1.5 2.2-.2.12-.42.24-.64.36.12.74.52 1.9 1.28 2.72.62.66 1.36 1.04 2.14 1.14a.7.7 0 0 1 .58.78c-.08.5-.52.82-1.06.82-.14 0-.28-.02-.42-.06-.62-.16-1.24-.32-1.9-.32-.4 0-.78.06-1.14.2-1.24.46-2.16 1.42-3.34 2.26-.78.56-1.66 1.04-2.74 1.22-.18.32-.5.76-.96 1.2-.2.2-.46.3-.72.3s-.52-.1-.72-.3c-.46-.44-.78-.88-.96-1.2-1.08-.18-1.96-.66-2.74-1.22-1.18-.84-2.1-1.8-3.34-2.26-.36-.14-.74-.2-1.14-.2-.66 0-1.28.16-1.9.32-.14.04-.28.06-.42.06-.54 0-.98-.32-1.06-.82a.7.7 0 0 1 .58-.78c.78-.1 1.52-.48 2.14-1.14.76-.82 1.16-1.98 1.28-2.72-.22-.12-.44-.24-.64-.36-.94-.58-1.5-1.3-1.5-2.2 0-.56.2-1.1.6-1.5.44-.44 1.02-.62 1.64-.62 1.02 0 2.06.4 3.1.92-.04-.54-.08-1.11-.08-1.66C7.5 2.4 9.3.5 12.15.5z"
          />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M23.5 7.2a3 3 0 0 0-2.12-2.13C19.5 4.5 12 4.5 12 4.5s-7.5 0-9.38.57A3 3 0 0 0 .5 7.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 4.8 3 3 0 0 0 2.12 2.12C4.5 19.5 12 19.5 12 19.5s7.5 0 9.38-.58a3 3 0 0 0 2.12-2.12A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-4.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"
          />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M16.5 3.2c.7 1.7 2.1 3 3.9 3.5V9a7.4 7.4 0 0 1-3.9-1.1v6.4A5.7 5.7 0 1 1 10.8 8.7v2.5a3.2 3.2 0 1 0 2.3 3.1V3h3.4z"
          />
        </svg>
      );
  }
}

export default function PublicCardPage() {
  const { username = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { profile: viewer, loading: authLoading } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [inviterLabel, setInviterLabel] = useState<string | null>(null);
  const [resolvedInviter, setResolvedInviter] = useState<{
    invitedByName?: string;
    invitedByUsername?: string;
    invitedByChapter?: string;
    invitedByInitiationYear?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const autoVcardClaimedRef = useRef(false);

  // Available for QR-origin UX (auto contact save, analytics, etc.)
  const visitSource: ProfileVisitSource = useMemo(
    () => profileVisitSourceFromSearch(searchParams),
    [searchParams]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getUserByUsername(username)
      .then(async (result) => {
        if (!active) return;
        if (!result) {
          setError('Card not found.');
          setUser(null);
          setInviterLabel(null);
          setResolvedInviter(null);
          return;
        }

        setUser(result);
        setPhotoFailed(false);
        setBgFailed(false);
        setPhotoFailed(false);
        if (result.username !== username.toLowerCase()) {
          // Preserve ?via=qr (and any other params) across alias → canonical username
          window.history.replaceState(
            null,
            '',
            publicCardPathWithSearch(result.username, window.location.search)
          );
        }

        let fields = {
          invitedByName: result.invitedByName,
          invitedByChapter: result.invitedByChapter,
          invitedByInitiationYear: result.invitedByInitiationYear,
        };

        if (result.invitedBy) {
          const inviter = await getUserById(result.invitedBy);
          if (!active) return;
          if (inviter) {
            fields = {
              invitedByName: fields.invitedByName || inviter.name,
              invitedByChapter:
                fields.invitedByChapter || inviter.chapter || inviter.chapterOfInitiation,
              invitedByInitiationYear: fields.invitedByInitiationYear || inviter.initiationYear,
            };
          }
        }

        setResolvedInviter(fields);
        setInviterLabel(formatInviter(fields));

        const source = profileVisitSourceFromSearch(window.location.search);
        const viewKey = `kappa:cardView:${result.id}:${source}`;
        if (!sessionStorage.getItem(viewKey)) {
          sessionStorage.setItem(viewKey, '1');
          void recordPublicCardEngagement(result.id, 'cardViews', result, { source }).catch(
            () => undefined
          );
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load card.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  // Quiet background Encounter for QR visits only — never blocks profile or vCard
  useEffect(() => {
    if (loading || authLoading || !user) return;
    if (visitSource !== 'qr') return;

    qrDevLog('QR profile visit ready for Encounter recording.', {
      ownerId: user.id,
      viewerId: viewer?.id ?? null,
    });

    void recordQrEncounter({
      ownerId: user.id,
      viewerId: viewer?.id ?? null,
      source: 'qr',
      subject: user,
    }).catch(() => {
      // Logged inside recordQrEncounter; swallow so UI stays unaffected
    });
  }, [loading, authLoading, user, visitSource, viewer?.id]);

  const saveContact = useCallback(
    async (subject: UserProfile, opts?: { fromAuto?: boolean }) => {
      setError(null);
      setMessage(null);
      setSavingContact(true);
      try {
        const publicSubject = toPublicProfile(subject);
        const inviterUsername =
          subject.invitedByUsername || resolvedInviter?.invitedByUsername;
        const vcardPayload = {
          ...publicSubject,
          invitedByName: subject.invitedByName || resolvedInviter?.invitedByName,
          invitedByUsername: inviterUsername,
          invitedByChapter: subject.invitedByChapter || resolvedInviter?.invitedByChapter,
          invitedByInitiationYear:
            subject.invitedByInitiationYear || resolvedInviter?.invitedByInitiationYear,
        };

        const result = await downloadVCard(vcardPayload);
        void recordPublicCardEngagement(subject.id, 'contactDownloads', subject).catch(
          () => undefined
        );

        let collectedNote = '';
        if (viewer && viewer.id !== subject.id) {
          try {
            await saveCollectedCard(viewer.id, subject);
            collectedNote = ' Also saved to Brothers.';
          } catch {
            collectedNote = ' Could not add to Brothers — try again while signed in.';
          }
        }

        if (vcardPayload.profilePicture && !result.includedPhoto) {
          setMessage(
            `Contact downloaded, but the photo could not be embedded. Try again in a moment.${collectedNote}`
          );
        } else if (result.includedPhoto) {
          setMessage(
            `Contact downloaded with photo.${collectedNote} If you still see an old picture on My Card, update that photo in Contacts separately.`
          );
        } else {
          setMessage(`Contact downloaded.${collectedNote}`);
        }
      } catch (err) {
        if (opts?.fromAuto) {
          qrDevLog('Browser prevented or failed the automatic vCard attempt.', err);
        }
        setError(err instanceof Error ? err.message : 'Could not prepare contact card.');
        throw err;
      } finally {
        setSavingContact(false);
      }
    },
    [viewer, resolvedInviter]
  );

  // QR-origin experiment: attempt one automatic vCard download after profile load.
  useEffect(() => {
    if (loading || !user) return;
    if (visitSource !== 'qr') return;

    qrDevLog('QR visit detected.');

    if (isLikelyBotOrPreviewAgent()) {
      qrDevLog('Bot/crawler/preview agent detected — skipping automatic vCard.');
      return;
    }

    const storageKey = `kappa:autoVcard:${user.id}`;
    try {
      if (sessionStorage.getItem(storageKey)) {
        qrDevLog('Auto vCard already attempted this tab session — skipping (blocks refresh loop).');
        return;
      }
    } catch {
      // sessionStorage may throw in locked-down contexts; ref still guards remounts
    }

    if (autoVcardClaimedRef.current) return;
    autoVcardClaimedRef.current = true;
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // ignore — in-memory ref still prevents Strict Mode double-fire in this mount
    }

    qrDevLog('Automatic vCard attempt initiated.');
    void saveContact(user, { fromAuto: true }).catch(() => {
      // Error already logged + surfaced via setError; button remains available
    });
  }, [loading, user, visitSource, saveContact]);

  if (loading) {
    return (
      <>
        <PageMeta
          title="Kappa Card"
          description="Live Kappa Card profile — scan to save contact info."
          path={username ? `/card/${username}` : '/'}
        />
        <div className="panel">Loading card…</div>
      </>
    );
  }
  if (error && !user) {
    return (
      <>
        <PageMeta
          title="Card not found — Kappa Card"
          description="This Kappa Card profile could not be found."
          path={username ? `/card/${username}` : '/'}
          noIndex
        />
        <div className="panel error">{error}</div>
      </>
    );
  }
  if (!user) return null;

  const publicUser = toPublicProfile(user);
  const showPhoto = isUsablePhotoUrl(publicUser.profilePicture) && !photoFailed;
  const bgUrl =
    isUsablePhotoUrl(publicUser.cardBackground) && !bgFailed
      ? publicUser.cardBackground!
      : null;
  const heroBg = cardSurfaceBackground(bgUrl);
  const inviterUsername = user.invitedByUsername || resolvedInviter?.invitedByUsername;
  const chapterYear = [publicUser.chapter, publicUser.initiationYear]
    .filter(Boolean)
    .join(' · ');
  const cardTitle = `${publicUser.name || 'Brother'} — Kappa Card`;
  const cardDescription = [
    publicUser.name,
    chapterYear,
    'Share complete contact info with a single scan on Kappa Card.',
  ]
    .filter(Boolean)
    .join(' · ');
  const cardImage =
    showPhoto && publicUser.profilePicture
      ? publicUser.profilePicture
      : DEFAULT_OG_IMAGE;

  const detailRows: ReactNode[] = [];
  if (publicUser.email) {
    detailRows.push(
      <DetailRow key="email" label="Email" value={publicUser.email} href={`mailto:${publicUser.email}`} />
    );
  }
  if (publicUser.phone) {
    detailRows.push(
      <DetailRow
        key="phone"
        label="Phone"
        value={formatUsPhone(publicUser.phone)}
        href={`tel:${phoneDigits(publicUser.phone)}`}
      />
    );
  }

  const socialLinks = publicSocialLinks(publicUser.socialMedia);
  const hasContactDetails = detailRows.length > 0 || socialLinks.length > 0;
  const isOwnProfile = Boolean(viewer && viewer.id === user.id);

  return (
    <section className="public-card-page" data-visit-source={visitSource}>
      <PageMeta
        title={cardTitle}
        description={cardDescription}
        path={`/card/${publicUser.username || username}`}
        image={cardImage}
        imageAlt={`${publicUser.name || 'Brother'} on Kappa Card`}
        person={{
          name: publicUser.name || 'Brother',
          username: publicUser.username || username,
          chapter: publicUser.chapter,
          initiationYear: publicUser.initiationYear,
          image: showPhoto ? publicUser.profilePicture : undefined,
        }}
      />
      <article
        className={`public-card-hero${bgUrl ? ' public-card-hero--custom-bg' : ''}`}
        style={heroBg}
      >
        {bgUrl && (
          <img src={bgUrl} alt="" hidden onError={() => setBgFailed(true)} />
        )}
        {isOwnProfile && (
          <div className="public-card-owner-toolbar" aria-label="Your profile actions">
            <Link
              className="public-card-owner-tool"
              to="/profile"
              aria-label="Edit my info"
              title="Edit"
            >
              <PencilIcon />
            </Link>
          </div>
        )}
        <div className="public-card-hero-body">

          <div className="public-card-photo">
            {showPhoto ? (
              <img
                src={publicUser.profilePicture}
                alt=""
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="public-card-initials">{initialsFromName(publicUser.name)}</div>
            )}
          </div>

          <h1 className="public-card-name">{publicUser.name}</h1>
          {isInauguralMember(user) && (
            <p className="public-card-inaugural">
              Inaugural 100
              {inauguralSlotOf(user) ? ` · #${inauguralSlotOf(user)}` : ''}
            </p>
          )}
          <p className="public-card-chapter">
            <ChapterNameLink chapter={publicUser.chapter} className="public-card-chapter-link" />
            {publicUser.initiationYear ? ` · ${publicUser.initiationYear}` : ''}
          </p>
          {publicUser.occupation && (
            <p className="public-card-role">{publicUser.occupation}</p>
          )}
          {publicUser.currentEmployer && (
            <p className="public-card-employer">{publicUser.currentEmployer}</p>
          )}
          {publicUser.currentCity && (
            <p className="public-card-city">{publicUser.currentCity}</p>
          )}
        </div>
      </article>

      <div className="panel public-card-panel">
        <button
          type="button"
          className="public-card-cta"
          disabled={savingContact}
          onClick={() => void saveContact(user).catch(() => undefined)}
        >
          {savingContact ? 'Preparing contact…' : 'Save to Contacts'}
        </button>
        <p style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '-10px' }}>
          *Contact card includes membership details, phone, email, profile photo, and social links
          when set to Public.
        </p>

        {hasContactDetails ? (
          <>
            <div className="public-card-details">
              {detailRows}
              {socialLinks.length > 0 && (
                <div className="public-social-row">
                  <span className="public-detail-label">Social</span>
                  <div className="public-social-icons" role="list">
                    {socialLinks.map((link) => (
                      <a
                        key={link.network}
                        className="public-social-icon"
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={link.label}
                        title={link.label}
                        role="listitem"
                      >
                        <SocialIcon network={link.network} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {inviterLabel && (
              <p style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.95, margin: '10px 0' }}>
                Invited to Kappa Card by{' '}
                {inviterUsername ? (
                  <Link to={`/card/${inviterUsername}`}>{inviterLabel}</Link>
                ) : (
                  inviterLabel
                )}
              </p>
            )}
          </>
        ) : (
          <p className="public-card-empty">
            Contact details are private. You can still save this brother to your phone.
          </p>
        )}

        {message && <p className="success public-card-status">{message}</p>}
        {error && <p className="error public-card-status">{error}</p>}

        {!viewer && (
          <p className="muted public-card-footnote">
            Sign in to keep this brother in your{' '}
            <Link to="/login">Brothers</Link> list after you save the contact.
            {' '}Have an invite? <Link to="/signup">Create your own Kappa Card</Link>
          </p>
        )}
        {viewer && viewer.id !== user.id && (
          <p className="muted public-card-footnote">
            Saving to Contacts also adds him to your{' '}
            <Link to="/brothers">Brothers</Link> list.
          </p>
        )}
      </div>
    </section>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M4.5 19.5a1 1 0 0 1-1-1.05l.22-3.9 9.9-9.9a2.5 2.5 0 0 1 3.54 0l1.69 1.69a2.5 2.5 0 0 1 0 3.54l-9.9 9.9-3.9.22a1 1 0 0 1-.55-.15zm2.07-3.4.12 2.14 2.14-.12 8.34-8.34a.5.5 0 0 0 0-.71l-1.69-1.69a.5.5 0 0 0-.71 0L6.57 16.1z"
      />
    </svg>
  );
}
