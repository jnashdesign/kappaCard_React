import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveCollectedCard } from '../lib/collectedCards';
import { getUserById, getUserByUsername } from '../lib/users';
import { recordPublicCardEngagement } from '../lib/userStats';
import { cardSurfaceBackground, isUsablePhotoUrl } from '../lib/photos';
import { formatUsPhone, phoneDigits } from '../lib/phone';
import { toPublicProfile } from '../lib/privacy';
import { downloadVCard, formatInviter } from '../lib/vcard';
import type { UserProfile } from '../types';
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

export default function PublicCardPage() {
  const { username = '' } = useParams();
  const { profile: viewer } = useAuth();
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
          window.history.replaceState(null, '', `/card/${result.username}`);
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

        const viewKey = `kappa:cardView:${result.id}`;
        if (!sessionStorage.getItem(viewKey)) {
          sessionStorage.setItem(viewKey, '1');
          void recordPublicCardEngagement(result.id, 'cardViews', result).catch(() => undefined);
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

  if (loading) return <div className="panel">Loading card…</div>;
  if (error && !user) return <div className="panel error">{error}</div>;
  if (!user) return null;

  const publicUser = toPublicProfile(user);
  const showPhoto = isUsablePhotoUrl(publicUser.profilePicture) && !photoFailed;
  const bgUrl =
    isUsablePhotoUrl(publicUser.cardBackground) && !bgFailed
      ? publicUser.cardBackground!
      : null;
  const heroBg = cardSurfaceBackground(bgUrl);
  const inviterUsername = user.invitedByUsername || resolvedInviter?.invitedByUsername;
  const vcardUser = {
    ...publicUser,
    invitedByName: user.invitedByName || resolvedInviter?.invitedByName,
    invitedByUsername: inviterUsername,
    invitedByChapter: user.invitedByChapter || resolvedInviter?.invitedByChapter,
    invitedByInitiationYear:
      user.invitedByInitiationYear || resolvedInviter?.invitedByInitiationYear,
  };

  async function onSaveContact() {
    if (!user) return;
    setError(null);
    setMessage(null);
    setSavingContact(true);
    try {
      const result = await downloadVCard(vcardUser);
      void recordPublicCardEngagement(user.id, 'contactDownloads', user).catch(() => undefined);

      let collectedNote = '';
      if (viewer && viewer.id !== user.id) {
        try {
          await saveCollectedCard(viewer.id, user);
          collectedNote = ' Also saved to your Collected list.';
        } catch {
          collectedNote = ' Could not add to Collected — try again while signed in.';
        }
      }

      if (vcardUser.profilePicture && !result.includedPhoto) {
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
      setError(err instanceof Error ? err.message : 'Could not prepare contact card.');
    } finally {
      setSavingContact(false);
    }
  }

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

  return (
    <section className="public-card-page">
      <article
        className={`public-card-hero${bgUrl ? ' public-card-hero--custom-bg' : ''}`}
        style={heroBg}
      >
        {bgUrl && (
          <img src={bgUrl} alt="" hidden onError={() => setBgFailed(true)} />
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
          <p className="public-card-chapter">
            {publicUser.chapter} · {publicUser.initiationYear}
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
          onClick={() => void onSaveContact()}
        >
          {savingContact ? 'Preparing contact…' : 'Save to Contacts'}
        </button>
        <p style={{ fontSize: '0.8rem', opacity: 0.95, marginTop: '-10px' }}>
          *Contact card includes membership details, phone, email, profile photo, and social links
          when set to Public.
        </p>

        {detailRows.length > 0 ? (
          <>
            <div className="public-card-details">{detailRows}</div>
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
            <Link to="/login">Collected</Link> list after you save the contact.
            {' '}Have an invite? <Link to="/signup">Create your own Kappa Card</Link>
          </p>
        )}
        {viewer && viewer.id !== user.id && (
          <p className="muted public-card-footnote">
            Saving to Contacts also adds him to your{' '}
            <Link to="/collected">Collected</Link> list.
          </p>
        )}
      </div>
    </section>
  );
}
