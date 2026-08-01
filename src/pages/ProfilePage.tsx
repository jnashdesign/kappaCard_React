import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PrivacyToggle from '../components/PrivacyToggle';
import { useAuth } from '../contexts/AuthContext';
import { isUsablePhotoUrl } from '../lib/photos';
import {
  normalizeFieldPrivacy,
  type FieldVisibility,
  type PrivacyField,
} from '../lib/privacy';
import { uploadProfilePhoto } from '../lib/storage';
import { formatUsPhone } from '../lib/phone';
import { clearProfilePhoto } from '../lib/users';
import { formatInviter } from '../lib/vcard';
import './ProfilePage.css';

function FieldRow({
  label,
  alwaysPublic,
  visibility,
  onVisibilityChange,
  children,
}: {
  label: string;
  alwaysPublic?: boolean;
  visibility?: FieldVisibility;
  onVisibilityChange?: (value: FieldVisibility) => void;
  children: ReactNode;
}) {
  return (
    <label className="field-with-privacy">
      <div className="field-with-privacy-header">
        <span>{label}</span>
        {alwaysPublic ? (
          <span className="always-public-note">Always public</span>
        ) : (
          visibility &&
          onVisibilityChange && (
            <PrivacyToggle value={visibility} onChange={onVisibilityChange} />
          )
        )}
      </div>
      {children}
    </label>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ΚΑΨ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function ProfilePage() {
  const { profile, saveProfile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    username: profile?.username ?? '',
    phone: formatUsPhone(profile?.phone ?? ''),
    chapter: profile?.chapter ?? '',
    initiationYear: String(profile?.initiationYear ?? new Date().getFullYear()),
    occupation: profile?.occupation ?? '',
    currentEmployer: profile?.currentEmployer ?? '',
    currentCity: profile?.currentCity ?? '',
    linkedin: profile?.socialMedia?.linkedin ?? '',
    x: profile?.socialMedia?.x ?? '',
    instagram: profile?.socialMedia?.instagram ?? '',
    snapchat: profile?.socialMedia?.snapchat ?? '',
  });
  const [privacy, setPrivacy] = useState(() => normalizeFieldPrivacy(profile?.fieldPrivacy));
  const initialPhoto = isUsablePhotoUrl(profile?.profilePicture) ? profile!.profilePicture! : '';
  const [previewUrl, setPreviewUrl] = useState(initialPhoto);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const hydratedId = useRef<string | null>(null);

  useEffect(() => {
    if (!profile || hydratedId.current === profile.id) return;
    hydratedId.current = profile.id;
    setForm({
      name: profile.name ?? '',
      username: profile.username ?? '',
      phone: formatUsPhone(profile.phone ?? ''),
      chapter: profile.chapter ?? '',
      initiationYear: String(profile.initiationYear ?? new Date().getFullYear()),
      occupation: profile.occupation ?? '',
      currentEmployer: profile.currentEmployer ?? '',
      currentCity: profile.currentCity ?? '',
      linkedin: profile.socialMedia?.linkedin ?? '',
      x: profile.socialMedia?.x ?? '',
      instagram: profile.socialMedia?.instagram ?? '',
      snapchat: profile.socialMedia?.snapchat ?? '',
    });
    setPrivacy(normalizeFieldPrivacy(profile.fieldPrivacy));
    const photo = isUsablePhotoUrl(profile.profilePicture) ? profile.profilePicture! : '';
    setPreviewUrl(photo);
    setPhotoFailed(false);
  }, [profile]);

  if (!profile) return <div className="panel">Loading…</div>;

  const inviterLabel = formatInviter(profile);
  const displayName = form.name.trim() || profile.name;
  const showPhoto = isUsablePhotoUrl(previewUrl) && !photoFailed;
  const publicPath = `/card/${form.username.trim() || profile.username}`;
  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;

  function setFieldPrivacy(field: PrivacyField, value: FieldVisibility) {
    setPrivacy((current) => ({ ...current, [field]: value }));
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy link.');
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      const { url, path } = await uploadProfilePhoto(file);
      await saveProfile({
        profilePicture: url,
        profilePicturePath: path,
        fieldPrivacy: privacy,
      });
      setPreviewUrl(url);
      setPhotoFailed(false);
      await refreshProfile();
      setMessage('Photo uploaded. It will appear on your Kappa Card when set to Public.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function onRemovePhoto() {
    if (!profile) return;
    setError(null);
    setMessage(null);
    setUploading(true);
    try {
      await clearProfilePhoto(profile.id);
      setPreviewUrl('');
      setPhotoFailed(false);
      await refreshProfile();
      setMessage('Photo removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photo.');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await saveProfile({
        name: form.name,
        username: form.username,
        phone: form.phone || undefined,
        chapter: form.chapter,
        chapterOfInitiation: form.chapter,
        initiationYear: Number(form.initiationYear),
        occupation: form.occupation || undefined,
        currentEmployer: form.currentEmployer || undefined,
        currentCity: form.currentCity || undefined,
        socialMedia: {
          linkedin: form.linkedin || undefined,
          x: form.x || undefined,
          instagram: form.instagram || undefined,
          snapchat: form.snapchat || undefined,
        },
        fieldPrivacy: privacy,
      });
      setMessage(
        form.username !== profile.username
          ? 'Profile saved. Old username links will redirect to your new URL.'
          : 'Profile saved. Public/private settings apply to your card and Add to Contacts.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="profile-page" onSubmit={onSubmit}>
      <header className="profile-identity">
        <div className="profile-identity-inner">
          <button
            type="button"
            className="profile-photo-control"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change profile photo"
          >
            <div className="profile-photo-ring">
              {showPhoto ? (
                <img src={previewUrl} alt="" onError={() => setPhotoFailed(true)} />
              ) : (
                <div className="profile-photo-initials">{initialsFromName(displayName)}</div>
              )}
            </div>
            <span className="profile-photo-overlay">{uploading ? 'Uploading' : 'Change'}</span>
          </button>

          <div className="profile-identity-copy">
            <p className="profile-identity-eyebrow">Your Kappa Card profile</p>
            <h1>{displayName}</h1>
            <p className="profile-identity-meta">
              {form.chapter || profile.chapter}
              {(form.initiationYear || profile.initiationYear) &&
                ` · ${form.initiationYear || profile.initiationYear}`}
            </p>
            <div className="profile-identity-actions">
              <Link className="profile-chip" to={publicPath}>
                <span>View public card</span>
              </Link>
              <button type="button" className="profile-chip profile-chip-button" onClick={() => void copyPublicLink()}>
                <span>{copied ? 'Link copied' : `/${(form.username || profile.username).trim()}`}</span>
              </button>
            </div>
            <p className="profile-privacy-note">
              Name, chapter, and year stay public. Toggle the rest for your card and contacts.
            </p>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
        disabled={uploading}
      />

      <section className="panel profile-section">
        <div className="profile-section-header">
          <div className="field-with-privacy-header">
            <h2>Photo</h2>
            <PrivacyToggle
              value={privacy.profilePicture}
              onChange={(value) => setFieldPrivacy('profilePicture', value)}
              disabled={uploading}
            />
          </div>
          <p>Shown on your card when Public. JPG, PNG, or WebP up to 5MB.</p>
        </div>
        <div className="profile-photo-actions">
          <button
            type="button"
            className="secondary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : showPhoto ? 'Replace photo' : 'Upload photo'}
          </button>
          {showPhoto && (
            <button
              type="button"
              className="secondary"
              disabled={uploading}
              onClick={() => void onRemovePhoto()}
            >
              Remove
            </button>
          )}
        </div>
      </section>

      <section className="panel profile-section">
        <div className="profile-section-header">
          <h2>Identity</h2>
          <p>These fields identify you publicly on every Kappa Card.</p>
        </div>

        {inviterLabel && (
          <p className="profile-inviter">
            Invited by <strong>{inviterLabel}</strong>
          </p>
        )}

        <div className="grid-2">
          <FieldRow label="Full name" alwaysPublic>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </FieldRow>
          <FieldRow label="Username" alwaysPublic>
            <input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
          </FieldRow>
          <FieldRow label="Chapter" alwaysPublic>
            <input
              value={form.chapter}
              onChange={(e) => setForm((f) => ({ ...f, chapter: e.target.value }))}
              required
            />
          </FieldRow>
          <FieldRow label="Initiation year" alwaysPublic>
            <input
              type="number"
              value={form.initiationYear}
              onChange={(e) => setForm((f) => ({ ...f, initiationYear: e.target.value }))}
              required
            />
          </FieldRow>
        </div>
      </section>

      <section className="panel profile-section">
        <div className="profile-section-header">
          <h2>Contact</h2>
          <p>How brothers reach you — hide anything you prefer to keep private.</p>
        </div>
        <div className="grid-2">
          <FieldRow
            label="Email"
            visibility={privacy.email}
            onVisibilityChange={(value) => setFieldPrivacy('email', value)}
          >
            <input type="email" value={profile.email} disabled />
          </FieldRow>
          <FieldRow
            label="Phone"
            visibility={privacy.phone}
            onVisibilityChange={(value) => setFieldPrivacy('phone', value)}
          >
            <input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: formatUsPhone(e.target.value) }))
              }
              inputMode="tel"
              autoComplete="tel"
              placeholder="(214) 755 8202"
            />
          </FieldRow>
        </div>
      </section>

      <section className="panel profile-section">
        <div className="profile-section-header">
          <h2>Work & place</h2>
          <p>Optional context for networking — each field has its own visibility.</p>
        </div>
        <div className="grid-2">
          <FieldRow
            label="Occupation"
            visibility={privacy.occupation}
            onVisibilityChange={(value) => setFieldPrivacy('occupation', value)}
          >
            <input
              value={form.occupation}
              onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
              placeholder="Optional"
            />
          </FieldRow>
          <FieldRow
            label="Employer"
            visibility={privacy.currentEmployer}
            onVisibilityChange={(value) => setFieldPrivacy('currentEmployer', value)}
          >
            <input
              value={form.currentEmployer}
              onChange={(e) => setForm((f) => ({ ...f, currentEmployer: e.target.value }))}
              placeholder="Optional"
            />
          </FieldRow>
        </div>
        <FieldRow
          label="Current city"
          visibility={privacy.currentCity}
          onVisibilityChange={(value) => setFieldPrivacy('currentCity', value)}
        >
          <input
            value={form.currentCity}
            onChange={(e) => setForm((f) => ({ ...f, currentCity: e.target.value }))}
            placeholder="Optional"
          />
        </FieldRow>
      </section>

      <section className="panel profile-section">
        <div className="profile-section-header">
          <h2>Social</h2>
          <p>Handles only — leave blank to omit from your card.</p>
        </div>
        <div className="grid-2">
          <FieldRow
            label="LinkedIn"
            visibility={privacy.linkedin}
            onVisibilityChange={(value) => setFieldPrivacy('linkedin', value)}
          >
            <input
              value={form.linkedin}
              onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
              placeholder="handle"
            />
          </FieldRow>
          <FieldRow
            label="X"
            visibility={privacy.x}
            onVisibilityChange={(value) => setFieldPrivacy('x', value)}
          >
            <input
              value={form.x}
              onChange={(e) => setForm((f) => ({ ...f, x: e.target.value }))}
              placeholder="handle"
            />
          </FieldRow>
          <FieldRow
            label="Instagram"
            visibility={privacy.instagram}
            onVisibilityChange={(value) => setFieldPrivacy('instagram', value)}
          >
            <input
              value={form.instagram}
              onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
              placeholder="handle"
            />
          </FieldRow>
          <FieldRow
            label="Snapchat"
            visibility={privacy.snapchat}
            onVisibilityChange={(value) => setFieldPrivacy('snapchat', value)}
          >
            <input
              value={form.snapchat}
              onChange={(e) => setForm((f) => ({ ...f, snapchat: e.target.value }))}
              placeholder="handle"
            />
          </FieldRow>
        </div>
      </section>

      <div className="profile-save-bar">
        <div>
          {error ? (
            <p className="error">{error}</p>
          ) : message ? (
            <p className="success">{message}</p>
          ) : (
            <p>Changes apply to your public card and Add to Contacts after you save.</p>
          )}
        </div>
        <button type="submit" disabled={loading || uploading}>
          {loading ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}
