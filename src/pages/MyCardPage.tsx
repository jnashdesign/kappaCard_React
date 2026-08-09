import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { publicCardQrUrl } from '../lib/cardUrl';
import {
  CARD_BACKGROUND_SCRIM,
  cardSurfaceBackground,
  isUsablePhotoUrl,
} from '../lib/photos';
import { profilePhotoToDataUrl } from '../lib/storage';
import { canUseCardFeatures, getUserById } from '../lib/users';
import { recordCardImageDownload } from '../lib/userStats';
import { formatInviter } from '../lib/vcard';
import './MyCardPage.css';

export default function MyCardPage() {
  const { profile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [inviterLabel, setInviterLabel] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const qrUrl = useMemo(() => {
    if (!profile) return '';
    return publicCardQrUrl(window.location.origin, profile.username);
  }, [profile]);

  const photoUrl = isUsablePhotoUrl(profile?.profilePicture) ? profile!.profilePicture! : null;
  const showPhoto = Boolean(photoUrl && !photoFailed);
  const bgUrl =
    isUsablePhotoUrl(profile?.cardBackground) && !bgFailed ? profile!.cardBackground! : null;

  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUrl]);

  useEffect(() => {
    setBgFailed(false);
  }, [profile?.cardBackground]);

  useEffect(() => {
    if (!qrUrl) return;
    void QRCode.toDataURL(qrUrl, {
      width: 280,
      margin: 1,
      color: { dark: '#6d0e0f', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [qrUrl]);

  useEffect(() => {
    if (!profile) return;

    // Resolve inviter display fields; prefer live inviter profile for chapter/year
    void (async () => {
      let fields = {
        invitedByName: profile.invitedByName,
        invitedByChapter: profile.invitedByChapter,
        invitedByInitiationYear: profile.invitedByInitiationYear,
      };

      if (profile.invitedBy) {
        const inviter = await getUserById(profile.invitedBy);
        if (inviter) {
          fields = {
            invitedByName: fields.invitedByName || inviter.name,
            invitedByChapter:
              fields.invitedByChapter || inviter.chapter || inviter.chapterOfInitiation,
            invitedByInitiationYear: fields.invitedByInitiationYear || inviter.initiationYear,
          };
        }
      }

      setInviterLabel(formatInviter(fields));
    })();
  }, [profile]);

  if (!profile) return <div className="panel">Loading…</div>;
  if (!canUseCardFeatures(profile)) {
    return (
      <div className="panel stack">
        <h1>My Card</h1>
        <p className="muted">Basic tier is required to generate and save your Kappa Card.</p>
        <Link className="button" to="/pricing">
          Unlock Basic
        </Link>
      </div>
    );
  }

  async function saveToCameraRoll() {
    if (!cardRef.current || !profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const photoEl = cardRef.current.querySelector<HTMLImageElement>('img[data-profile-photo="true"]');
      let restoreSrc: string | null = null;
      if (photoEl && showPhoto && profile.profilePicturePath) {
        restoreSrc = photoEl.src;
        photoEl.src = await profilePhotoToDataUrl(profile.profilePicturePath);
        await photoEl.decode().catch(() => undefined);
      }

      const restoreBgImage = cardRef.current.style.backgroundImage;
      const restoreBg = cardRef.current.style.background;
      if (bgUrl && profile.cardBackgroundPath) {
        const dataUrl = await profilePhotoToDataUrl(profile.cardBackgroundPath);
        cardRef.current.style.background = '';
        cardRef.current.style.backgroundImage = `${CARD_BACKGROUND_SCRIM}, url("${dataUrl}")`;
        cardRef.current.style.backgroundSize = 'cover';
        cardRef.current.style.backgroundPosition = 'center';
      }

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#6d0e0f',
      });

      if (photoEl && restoreSrc) {
        photoEl.src = restoreSrc;
      }
      cardRef.current.style.backgroundImage = restoreBgImage;
      cardRef.current.style.background = restoreBg;

      const link = document.createElement('a');
      link.download = `kappa-card-${profile.username}.png`;
      link.href = dataUrl;
      link.click();
      void recordCardImageDownload(profile).catch(() => undefined);
      setMessage('Card image downloaded. On iPhone, open the image and choose Save to Photos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save card image.');
    } finally {
      setSaving(false);
    }
  }

  const surfaceBg = cardSurfaceBackground(bgUrl);

  return (
    <section className="stack my-card-page">
      <div>
        <h1>My Card</h1>
        <p className="muted">
          Download this card once — your QR always stays up to date when your profile changes.
        </p>
      </div>

      <div className="my-card-stage">
        {/* Outside cardRef so icons are not baked into the downloaded PNG */}
        <div className="my-card-toolbar" aria-label="Card actions">
          <button
            type="button"
            className="my-card-tool"
            onClick={() => void saveToCameraRoll()}
            disabled={saving || !qrDataUrl}
            aria-label={saving ? 'Preparing card image' : 'Download card image'}
            title={saving ? 'Preparing…' : 'Download'}
          >
            <DownloadIcon />
          </button>
          <Link
            className="my-card-tool"
            to="/profile"
            aria-label="Edit my info"
            title="Edit"
          >
            <PencilIcon />
          </Link>
          <Link
            className="my-card-tool"
            to={`/card/${profile.username}`}
            aria-label="Preview my public card"
            title="Preview"
          >
            <EyeIcon />
          </Link>
        </div>

        <div
          ref={cardRef}
          className="card-frame"
          style={{
            ...surfaceBg,
            color: '#f7f1e8',
            padding: '1.25rem 1.25rem 0 1.25rem',
            display: 'grid',
            gridTemplateRows: 'auto auto 1fr auto',
            gap: '0.85rem',
          }}
        >
          {bgUrl && (
            <img src={bgUrl} alt="" hidden onError={() => setBgFailed(true)} />
          )}
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            {showPhoto && photoUrl && (
              <img
                src={photoUrl}
                alt=""
                data-profile-photo="true"
                onError={() => setPhotoFailed(true)}
                style={{
                  width: 125,
                  height: 125,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid rgba(245, 232, 210, 0.85)',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: '0.35rem 0 0.15rem', fontSize: '1.45rem', lineHeight: 1.1 }}>
                {profile.name}
              </h2>
              <div style={{ opacity: 0.9, fontSize: '0.92rem' }}>
                {profile.chapter} {profile.initiationYear}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', placeItems: 'center' }}>
            {qrDataUrl ? (
              <div
                style={{
                  marginTop: '20px',
                  width: 'calc(100% + 10px)',
                  borderRadius: 16,
                  background: 'white',
                  padding: '10px 10px 12px',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${qrUrl}`}
                  style={{ width: '100%', display: 'block', borderRadius: 8 }}
                />
                <div
                  style={{
                    marginTop: 8,
                    textAlign: 'center',
                    fontFamily: 'Libre Baskerville, serif',
                    letterSpacing: '0.06em',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#6d0e0f',
                  }}
                >
                  MyKappaCard.com
                </div>
              </div>
            ) : (
              <p>Generating QR…</p>
            )}
          </div>

          {inviterLabel && (
            <div
              style={{
                fontSize: '0.82rem',
                opacity: 0.92,
                padding: '1.25rem',
                background: 'rgba(0,0,0,0.22)',
                margin: '40px -1.25rem -10px',
              }}
            >
              Invited by {inviterLabel}
            </div>
          )}
        </div>
      </div>

      {message && <p className="success my-card-status">{message}</p>}
      {error && <p className="error my-card-status">{error}</p>}
    </section>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 3a1 1 0 0 1 1 1v9.17l2.59-2.58a1 1 0 1 1 1.41 1.42l-4.3 4.29a1 1 0 0 1-1.4 0l-4.3-4.29a1 1 0 1 1 1.41-1.42L11 13.17V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"
      />
    </svg>
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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 5c5.2 0 9.4 3.4 10.8 6.4a1.6 1.6 0 0 1 0 1.2C21.4 15.6 17.2 19 12 19S2.6 15.6 1.2 12.6a1.6 1.6 0 0 1 0-1.2C2.6 8.4 6.8 5 12 5zm0 2c-3.9 0-7.2 2.5-8.6 5 1.4 2.5 4.7 5 8.6 5s7.2-2.5 8.6-5c-1.4-2.5-4.7-5-8.6-5zm0 2.5A2.5 2.5 0 1 1 12 14.5 2.5 2.5 0 0 1 12 9.5z"
      />
    </svg>
  );
}
