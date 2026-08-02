import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toPng } from 'html-to-image';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isUsablePhotoUrl } from '../lib/photos';
import { profilePhotoToDataUrl } from '../lib/storage';
import { canUseCardFeatures, getUserById } from '../lib/users';
import { formatInviter } from '../lib/vcard';

export default function MyCardPage() {
  const { profile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [inviterLabel, setInviterLabel] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const publicUrl = useMemo(() => {
    if (!profile) return '';
    return `${window.location.origin}/card/${profile.username}`;
  }, [profile]);

  const photoUrl = isUsablePhotoUrl(profile?.profilePicture) ? profile!.profilePicture! : null;
  const showPhoto = Boolean(photoUrl && !photoFailed);

  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUrl]);

  useEffect(() => {
    if (!publicUrl) return;
    void QRCode.toDataURL(publicUrl, {
      width: 280,
      margin: 1,
      color: { dark: '#6d0e0f', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [publicUrl]);

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

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#6d0e0f',
      });

      if (photoEl && restoreSrc) {
        photoEl.src = restoreSrc;
      }

      const link = document.createElement('a');
      link.download = `kappa-card-${profile.username}.png`;
      link.href = dataUrl;
      link.click();
      setMessage('Card image downloaded. On iPhone, open the image and choose Save to Photos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save card image.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack">
      <div>
        <h1>My Card</h1>
        <p className="muted">
          Download this card once, your QR always stays up to date. Even when your profile changes.
        </p>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div
          ref={cardRef}
          className="card-frame"
          style={{
            background:
              'linear-gradient(160deg, #4a090a 0%, #6d0e0f 45%, #8a1a1c 100%)',
            color: '#f7f1e8',
            padding: '1.25rem 1.25rem 0 1.25rem',
            display: 'grid',
            gridTemplateRows: 'auto auto 1fr auto',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            {showPhoto && photoUrl && (
              <img
                src={photoUrl}
                alt=""
                data-profile-photo="true"
                onError={() => setPhotoFailed(true)}
                style={{
                  width: 100,
                  height: 100,
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
                  width: 'calc(100% - 40px)',
                  borderRadius: 16,
                  background: 'white',
                  padding: '10px 10px 12px',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${publicUrl}`}
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

        <div className="panel stack" style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ margin: '0 0 -20px 0' }}>Keep Your Card Ready</h2>
          <p className="muted">
            Download the image, then save it to your camera roll. Anyone who scans it can download your updated contact info.
          </p>
          <button type="button" onClick={() => void saveToCameraRoll()} disabled={saving || !qrDataUrl}>
            {saving ? 'Preparing image…' : 'Save Card Image'}
          </button>
          <h2 style={{ margin:' 40px 0 -20px 0' }}>Manage Your Info</h2>
          <p className="muted">
            Update your profile to keep your contact info up to date. You have full control over what's shared.
          </p>
          <Link className="button secondary" to={`/card/${profile.username}`}>
            Preview My Info
          </Link>
          <Link className="button secondary" to="/profile">Edit My Info
          </Link>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
