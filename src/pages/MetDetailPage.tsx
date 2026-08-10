import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getEncounter, updateEncounterContext } from '../lib/encounters';
import { isUsablePhotoUrl } from '../lib/photos';
import { toPublicProfile } from '../lib/privacy';
import { getUserById } from '../lib/users';
import type { Encounter, UserProfile } from '../types';
import './MetDetailPage.css';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ΚΑΨ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function formatMetAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MetDetailPage() {
  const { encounterId = '' } = useParams();
  const { profile: viewer } = useAuth();
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [brother, setBrother] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [event, setEvent] = useState('');
  const [location, setLocation] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!viewer || !encounterId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setMessage(null);

    void (async () => {
      try {
        const row = await getEncounter(encounterId);
        if (!active) return;
        if (!row || row.viewerId !== viewer.id) {
          setError('Encounter not found.');
          setEncounter(null);
          setBrother(null);
          return;
        }

        setEncounter(row);
        setEvent(row.event ?? '');
        setLocation(row.location ?? '');
        setPrivateNote(row.privateNote ?? '');

        const owner = await getUserById(row.ownerId);
        if (!active) return;
        setBrother(owner ? toPublicProfile(owner) : null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load encounter.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [viewer?.id, encounterId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!encounter) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateEncounterContext(encounter.id, {
        event,
        location,
        privateNote,
      });
      setEncounter((prev) =>
        prev
          ? {
              ...prev,
              event: event.trim() || undefined,
              location: location.trim() || undefined,
              privateNote: privateNote.trim() || undefined,
              updatedAt: new Date().toISOString(),
            }
          : prev
      );
      setMessage('Meeting notes saved. Only you can see these.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes.');
    } finally {
      setSaving(false);
    }
  }

  if (!viewer) return <div className="panel">Loading…</div>;
  if (loading) return <div className="panel">Loading…</div>;
  if (error && !encounter) {
    return (
      <section className="met-detail stack">
        <Link to="/met" className="met-back">
          ← People I&apos;ve Met
        </Link>
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!encounter) return null;

  const name = brother?.name || 'Brother';
  const showPhoto = isUsablePhotoUrl(brother?.profilePicture) && !photoFailed;

  return (
    <section className="met-detail stack">
      <Link to="/met" className="met-back">
        ← People I&apos;ve Met
      </Link>

      <article className="panel met-detail-hero">
        <div className="met-detail-identity">
          <div className="met-detail-avatar" aria-hidden>
            {showPhoto ? (
              <img
                src={brother!.profilePicture}
                alt=""
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <span>{initialsFromName(name)}</span>
            )}
          </div>
          <div>
            <h1 className="met-detail-name">{name}</h1>
            <p className="met-detail-meta">
              {[brother?.chapter, brother?.initiationYear ? String(brother.initiationYear) : null]
                .filter(Boolean)
                .join(' · ') || 'Kappa Card member'}
            </p>
            {brother?.occupation && <p className="met-detail-sub">{brother.occupation}</p>}
            {brother?.currentEmployer && (
              <p className="met-detail-sub">{brother.currentEmployer}</p>
            )}
            {brother?.currentCity && <p className="met-detail-sub">{brother.currentCity}</p>}
          </div>
        </div>

        <dl className="met-detail-facts">
          <div>
            <dt>Met</dt>
            <dd>{formatMetAt(encounter.timestamp)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{encounter.source === 'qr' ? 'QR scan' : encounter.source}</dd>
          </div>
        </dl>

        {brother?.username ? (
          <Link className="button met-detail-card-link" to={`/card/${brother.username}`}>
            View full Kappa Card
          </Link>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            This brother&apos;s public card is unavailable.
          </p>
        )}
      </article>

      <form className="panel stack met-detail-form" onSubmit={(e) => void onSave(e)}>
        <div>
          <h2>Your meeting notes</h2>
          <p className="muted met-privacy-note">
            Event, place, and private notes stay on <strong>your</strong> encounter record. They
            never appear on his public Kappa Card.
          </p>
        </div>

        <label>
          Event
          <input
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            placeholder="e.g. Conclave mixer"
            maxLength={200}
            autoComplete="off"
          />
        </label>

        <label>
          Place
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Atlanta Marriott lobby"
            maxLength={200}
            autoComplete="off"
          />
        </label>

        <label>
          Private note
          <textarea
            value={privateNote}
            onChange={(e) => setPrivateNote(e.target.value)}
            placeholder="Reminders only you will see…"
            rows={5}
            maxLength={2000}
          />
        </label>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      </form>
    </section>
  );
}
