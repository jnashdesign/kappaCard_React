import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PrivacyToggle from '../components/PrivacyToggle';
import { useAuth } from '../contexts/AuthContext';
import KAPPA_PROVINCES from '../data/provinces';
import { isUsablePhotoUrl } from '../lib/photos';
import {
  normalizeFieldPrivacy,
  type FieldVisibility,
  type PrivacyField,
} from '../lib/privacy';
import { uploadCardBackground, uploadProfilePhoto } from '../lib/storage';
import { formatUsPhone } from '../lib/phone';
import { requestBrothersRecapNow } from '../lib/brothersRecap';
import { clearCardBackground, clearProfilePhoto, detectBrowserTimezone } from '../lib/users';
import { sanitizeUsernameInput } from '../lib/username';
import { formatInviter } from '../lib/vcard';
import {
  MAX_WEBSITES,
  createWebsiteDraft,
  hostnameFromUrl,
  mapWebsites,
  normalizeWebsiteUrl,
  sanitizeWebsitesForSave,
} from '../lib/websites';
import ChapterNameLink from '../components/ChapterNameLink';
import type { ProfileWebsite } from '../types';
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
  const { profile, firebaseUser, saveProfile, refreshProfile, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const usesPasswordAuth = Boolean(
    firebaseUser?.providerData.some((p) => p.providerId === 'password')
  );
  const usesGoogleAuth = Boolean(
    firebaseUser?.providerData.some((p) => p.providerId === 'google.com')
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    username: profile?.username ?? '',
    phone: formatUsPhone(profile?.phone ?? ''),
    chapter: profile?.chapter ?? '',
    initiationYear: String(profile?.initiationYear ?? new Date().getFullYear()),
    occupation: profile?.occupation ?? '',
    currentEmployer: profile?.currentEmployer ?? '',
    currentCity: profile?.currentCity ?? '',
    province: profile?.province ?? '',
    linkedin: profile?.socialMedia?.linkedin ?? '',
    x: profile?.socialMedia?.x ?? '',
    instagram: profile?.socialMedia?.instagram ?? '',
    snapchat: profile?.socialMedia?.snapchat ?? '',
    youtube: profile?.socialMedia?.youtube ?? '',
    tiktok: profile?.socialMedia?.tiktok ?? '',
  });
  const [websites, setWebsites] = useState<ProfileWebsite[]>(() => mapWebsites(profile?.websites));
  const [draft, setDraft] = useState<ProfileWebsite>(() => createWebsiteDraft());
  const [privacy, setPrivacy] = useState(() => normalizeFieldPrivacy(profile?.fieldPrivacy));
  const initialPhoto = isUsablePhotoUrl(profile?.profilePicture) ? profile!.profilePicture! : '';
  const initialBg = isUsablePhotoUrl(profile?.cardBackground) ? profile!.cardBackground! : '';
  const [previewUrl, setPreviewUrl] = useState(initialPhoto);
  const [bgPreviewUrl, setBgPreviewUrl] = useState(initialBg);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [brothersRecapEnabled, setBrothersRecapEnabled] = useState(
    profile?.emailPrefs?.brothersRecapEnabled !== false
  );
  const [recapTestBusy, setRecapTestBusy] = useState(false);
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
      province: profile.province ?? '',
      linkedin: profile.socialMedia?.linkedin ?? '',
      x: profile.socialMedia?.x ?? '',
      instagram: profile.socialMedia?.instagram ?? '',
      snapchat: profile.socialMedia?.snapchat ?? '',
      youtube: profile.socialMedia?.youtube ?? '',
      tiktok: profile.socialMedia?.tiktok ?? '',
    });
    setWebsites(mapWebsites(profile.websites));
    setDraft(createWebsiteDraft());
    setPrivacy(normalizeFieldPrivacy(profile.fieldPrivacy));
    const photo = isUsablePhotoUrl(profile.profilePicture) ? profile.profilePicture! : '';
    setPreviewUrl(photo);
    setPhotoFailed(false);
    const bg = isUsablePhotoUrl(profile.cardBackground) ? profile.cardBackground! : '';
    setBgPreviewUrl(bg);
    setBgFailed(false);
    setBrothersRecapEnabled(profile.emailPrefs?.brothersRecapEnabled !== false);
  }, [profile]);

  if (!profile) return <div className="panel">Loading…</div>;

  const inviterLabel = formatInviter(profile);
  const displayName = form.name.trim() || profile.name;
  const showPhoto = isUsablePhotoUrl(previewUrl) && !photoFailed;
  const showBg = isUsablePhotoUrl(bgPreviewUrl) && !bgFailed;
  const mediaBusy = uploading || uploadingBg;
  const publicPath = `/card/${form.username.trim() || profile.username}`;
  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;
  const listedWebsites = websites
    .map((site) => {
      const href = normalizeWebsiteUrl(site.url) || (site.url.startsWith('http') ? site.url : '');
      if (!href) return null;
      return {
        ...site,
        href,
        host: hostnameFromUrl(href),
      };
    })
    .filter((site): site is ProfileWebsite & { href: string; host: string } => site !== null);

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
      const { url, path, contactUrl, contactPath } = await uploadProfilePhoto(file);
      await saveProfile({
        profilePicture: url,
        profilePicturePath: path,
        contactPhoto: contactUrl,
        contactPhotoPath: contactPath,
        fieldPrivacy: privacy,
      });
      setPreviewUrl(url);
      setPhotoFailed(false);
      await refreshProfile();
      setMessage('Circle photo uploaded. It appears on your Kappa Card when set to Public.');
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
      setMessage('Circle photo removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove photo.');
    } finally {
      setUploading(false);
    }
  }

  async function onBackgroundSelected(file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);
    setUploadingBg(true);
    try {
      const { url, path } = await uploadCardBackground(file);
      await saveProfile({
        cardBackground: url,
        cardBackgroundPath: path,
        fieldPrivacy: privacy,
      });
      setBgPreviewUrl(url);
      setBgFailed(false);
      await refreshProfile();
      setMessage('Card background uploaded. It appears behind your Kappa Card when set to Public.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload background.');
    } finally {
      setUploadingBg(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  }

  async function onRemoveBackground() {
    if (!profile) return;
    setError(null);
    setMessage(null);
    setUploadingBg(true);
    try {
      await clearCardBackground(profile.id);
      setBgPreviewUrl('');
      setBgFailed(false);
      await refreshProfile();
      setMessage('Card background removed. The default crimson look is back.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove background.');
    } finally {
      setUploadingBg(false);
    }
  }

  function addWebsite() {
    if (websites.length >= MAX_WEBSITES) return;
    const { websites: added, error: websitesError } = sanitizeWebsitesForSave([draft]);
    if (websitesError) {
      setError(websitesError);
      setMessage(null);
      return;
    }
    if (!added.length) {
      setError('Add a title and website, then press +.');
      setMessage(null);
      return;
    }
    setWebsites((current) => [...current, ...added].slice(0, MAX_WEBSITES));
    setDraft(createWebsiteDraft());
    setError(null);
  }

  function removeWebsite(id: string) {
    setWebsites((current) => current.filter((site) => site.id !== id));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { websites: sanitizedWebsites, error: websitesError } =
        sanitizeWebsitesForSave([...websites, draft]);
      if (websitesError) {
        setError(websitesError);
        setLoading(false);
        return;
      }

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
        province: form.province || undefined,
        socialMedia: {
          linkedin: form.linkedin || undefined,
          x: form.x || undefined,
          instagram: form.instagram || undefined,
          snapchat: form.snapchat || undefined,
          youtube: form.youtube || undefined,
          tiktok: form.tiktok || undefined,
        },
        websites: sanitizedWebsites,
        fieldPrivacy: privacy,
        timezone: profile.timezone || detectBrowserTimezone(),
        emailPrefs: {
          brothersRecapEnabled,
        },
      });
      setWebsites(sanitizedWebsites);
      setDraft(createWebsiteDraft());
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
            disabled={mediaBusy}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change circle photo"
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
              {(form.chapter || profile.chapter) && (
                <ChapterNameLink
                  chapter={form.chapter || profile.chapter}
                  className="profile-chapter-link"
                />
              )}
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
            {listedWebsites.length > 0 && (
              <div className="profile-identity-sites" aria-label="Websites">
                {listedWebsites.map((site) => (
                  <a
                    key={site.id}
                    className="profile-chip"
                    href={site.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{site.title || site.host}</span>
                  </a>
                ))}
              </div>
            )}
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
        disabled={mediaBusy}
      />
      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void onBackgroundSelected(e.target.files?.[0] ?? null)}
        disabled={mediaBusy}
      />

      <section className="panel profile-section">
        <div className="profile-section-header">
          <div className="field-with-privacy-header">
            <h2>Circle photo</h2>
            <PrivacyToggle
              value={privacy.profilePicture}
              onChange={(value) => setFieldPrivacy('profilePicture', value)}
              disabled={mediaBusy}
            />
          </div>
          <p>
            Face photo in the circle on your Kappa Card and in contacts. JPG, PNG, or WebP up to 5MB.
          </p>
        </div>
        <div className="profile-photo-actions">
          <button
            type="button"
            className="primary"
            disabled={mediaBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : showPhoto ? 'Replace circle photo' : 'Upload circle photo'}
          </button>
          {showPhoto && (
            <button
              type="button"
              className="secondary"
              disabled={mediaBusy}
              onClick={() => void onRemovePhoto()}
            >
              Remove
            </button>
          )}
        </div>
      </section>

      <section className="panel profile-section">
        <div className="profile-section-header">
          <div className="field-with-privacy-header">
            <h2>Card background</h2>
            <PrivacyToggle
              value={privacy.cardBackground}
              onChange={(value) => setFieldPrivacy('cardBackground', value)}
              disabled={mediaBusy}
            />
          </div>
          <p>
            Full-bleed image behind your Kappa Card (and public card hero). Not added to contacts.
            JPG, PNG, or WebP up to 5MB.
          </p>
        </div>
        {showBg && (
          <div
            className="profile-bg-preview"
            style={{ backgroundImage: `url(${bgPreviewUrl})` }}
            aria-hidden
          >
            <img
              src={bgPreviewUrl}
              alt=""
              hidden
              onError={() => setBgFailed(true)}
            />
          </div>
        )}
        <div className="profile-photo-actions">
          <button
            type="button"
            className="primary"
            disabled={mediaBusy}
            onClick={() => bgFileInputRef.current?.click()}
          >
            {uploadingBg
              ? 'Uploading…'
              : showBg
                ? 'Replace background'
                : 'Upload background'}
          </button>
          {showBg && (
            <button
              type="button"
              className="secondary"
              disabled={mediaBusy}
              onClick={() => void onRemoveBackground()}
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
              onChange={(e) =>
                setForm((f) => ({ ...f, username: sanitizeUsernameInput(e.target.value) }))
              }
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              pattern="[a-z0-9_]+"
              title="Lowercase letters, numbers, and underscores only"
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
        <div className="grid-2">
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
          <label>
            Province
            <select
              value={form.province}
              onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
            >
              <option value="">Select province (optional)</option>
              {KAPPA_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
              {form.province &&
                !(KAPPA_PROVINCES as readonly string[]).includes(form.province) && (
                  <option value={form.province}>{form.province} (current)</option>
                )}
            </select>
          </label>
        </div>
      </section>

      <section className="panel profile-section">
        <div className="profile-section-header">
          <div className="field-with-privacy-header">
            <h2>Websites</h2>
            <PrivacyToggle
              value={privacy.websites}
              onChange={(value) => setFieldPrivacy('websites', value)}
            />
          </div>
          <p>Side businesses, organizations, and other sites you want on your card.</p>
        </div>

        <div className="profile-websites">
          {listedWebsites.length > 0 ? (
            <ul className="profile-website-list">
              {listedWebsites.map((site) => (
                <li key={site.id} className="profile-website-item">
                  <a
                    className="profile-website-link"
                    href={site.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="profile-website-title">{site.title || site.host}</span>
                    <span className="profile-website-host">{site.host}</span>
                  </a>
                  <button
                    type="button"
                    className="profile-website-remove"
                    onClick={() => removeWebsite(site.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-websites-empty">No websites added yet.</p>
          )}

          <div className="profile-website-composer">
            <label>
              Title
              <input
                value={draft.title}
                onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
                placeholder="JNASH Dev"
                maxLength={80}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addWebsite();
                  }
                }}
              />
            </label>
            <label>
              Website
              <input
                value={draft.url}
                onChange={(e) => setDraft((current) => ({ ...current, url: e.target.value }))}
                placeholder="example.com"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addWebsite();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="profile-website-add"
              onClick={addWebsite}
              disabled={websites.length >= MAX_WEBSITES}
              aria-label="Add website"
            >
              <span aria-hidden>+</span>
            </button>
          </div>
        </div>
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
          <FieldRow
            label="YouTube"
            visibility={privacy.youtube}
            onVisibilityChange={(value) => setFieldPrivacy('youtube', value)}
          >
            <input
              value={form.youtube}
              onChange={(e) => setForm((f) => ({ ...f, youtube: e.target.value }))}
              placeholder="handle"
            />
          </FieldRow>
          <FieldRow
            label="TikTok"
            visibility={privacy.tiktok}
            onVisibilityChange={(value) => setFieldPrivacy('tiktok', value)}
          >
            <input
              value={form.tiktok}
              onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))}
              placeholder="handle"
            />
          </FieldRow>
        </div>
      </section>

      <section className="panel profile-section">
        <div className="profile-section-header">
          <h2>Email reminders</h2>
          <p>
            Optional end-of-day email when you met brothers via QR that day — with links to add
            private notes while it’s fresh. Never sent on days with no meetings.
          </p>
        </div>
        <label className="profile-toggle-row">
          <input
            type="checkbox"
            checked={brothersRecapEnabled}
            onChange={(e) => setBrothersRecapEnabled(e.target.checked)}
          />
          <span>
            Send me a Brothers recap email around 8:00 PM
            {profile.timezone ? ` (${profile.timezone})` : ''}
          </span>
        </label>
        {profile.admin && (
          <button
            type="button"
            className="secondary"
            style={{ marginTop: '0.75rem' }}
            disabled={recapTestBusy || !brothersRecapEnabled}
            onClick={() => {
              void (async () => {
                setRecapTestBusy(true);
                setError(null);
                setMessage(null);
                try {
                  const result = await requestBrothersRecapNow();
                  setMessage(
                    result.status === 'sent'
                      ? result.to
                        ? `Test recap sent to ${result.to} — check inbox/spam.`
                        : 'Test recap sent — check your inbox.'
                      : 'No recap sent (no QR meets today, already sent, or preference off).'
                  );
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not send test recap.');
                } finally {
                  setRecapTestBusy(false);
                }
              })();
            }}
          >
            {recapTestBusy ? 'Sending…' : 'Send test recap now (admin)'}
          </button>
        )}
      </section>

      <section className="panel profile-section profile-danger">
        <div className="profile-section-header">
          <h2>Delete account</h2>
          <p>
            Permanently removes your profile, public card, invites you created, and photo. Brothers
            you invited keep their accounts.
            {usesGoogleAuth && !usesPasswordAuth
              ? ' You will confirm with Google before deletion.'
              : ' Enter your password to confirm.'}
          </p>
        </div>
        <label style={{ display: 'block' }}>
          Type <strong style={{ display: 'inline-block' }}>{profile.username}</strong> to confirm
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoComplete="off"
            placeholder={profile.username}
            style={{ display: 'block', marginTop: '0.7rem' }}
          />
        </label>
        {usesPasswordAuth && (
          <label style={{ display: 'block', marginTop: '0.9rem' }}>
            Password
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Your account password"
              style={{ display: 'block', marginTop: '0.7rem' }}
            />
          </label>
        )}
        {deleteError && <p className="error">{deleteError}</p>}
        <button
          type="button"
          className="profile-delete-button"
          disabled={
            deleting ||
            deleteConfirm.trim().toLowerCase() !== profile.username.trim().toLowerCase() ||
            (usesPasswordAuth && !deletePassword.trim())
          }
          onClick={() => {
            void (async () => {
              setDeleteError(null);
              setDeleting(true);
              try {
                await deleteAccount(usesPasswordAuth ? deletePassword : undefined);
                navigate('/', { replace: true });
              } catch (err) {
                setDeleteError(
                  err instanceof Error ? err.message : 'Could not delete account. Try again.'
                );
                setDeleting(false);
              }
            })();
          }}
        >
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
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
        <button type="submit" disabled={loading || mediaBusy}>
          {loading ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}
