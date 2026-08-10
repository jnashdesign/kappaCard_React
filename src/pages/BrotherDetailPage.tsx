import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getBrother, updateBrotherContext } from '../lib/brothers';
import { isUsablePhotoUrl } from '../lib/photos';
import { toPublicProfile } from '../lib/privacy';
import { getUserById } from '../lib/users';
import type { BrotherRecord, UserProfile } from '../types';
import './BrotherDetailPage.css';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ΚΑΨ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function formatWhen(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BrotherDetailPage() {
  const { subjectUserId = '' } = useParams();
  const { profile: viewer } = useAuth();
  const [record, setRecord] = useState<BrotherRecord | null>(null);
  const [live, setLive] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [event, setEvent] = useState('');
  const [location, setLocation] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!viewer || !subjectUserId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setMessage(null);

    void (async () => {
      try {
        const row = await getBrother(viewer.id, subjectUserId);
        if (!active) return;
        if (!row) {
          setError('Brother not found.');
          setRecord(null);
          setLive(null);
          return;
        }

        setRecord(row);
        setEvent(row.event ?? '');
        setLocation(row.location ?? '');
        setPrivateNote(row.privateNote ?? '');

        const owner = await getUserById(row.subjectUserId);
        if (!active) return;
        setLive(owner ? toPublicProfile(owner) : null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load brother.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [viewer?.id, subjectUserId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!viewer || !record) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateBrotherContext(viewer.id, record.subjectUserId, {
        event,
        location,
        privateNote,
      });
      setRecord((prev) =>
        prev
          ? {
              ...prev,
              event: event.trim() || undefined,
              location: location.trim() || undefined,
              privateNote: privateNote.trim() || undefined,
            }
          : prev
      );
      setMessage('Notes saved. Only you can see these.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save notes.');
    } finally {
      setSaving(false);
    }
  }

  if (!viewer) return <div className="panel">Loading…</div>;
  if (loading) return <div className="panel">Loading…</div>;
  if (error && !record) {
    return (
      <section className="brother-detail stack">
        <Link to="/brothers" className="brother-back">
          ← Brothers
        </Link>
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!record) return null;

  const name = live?.name || record.name || 'Brother';
  const photo = live?.profilePicture || record.profilePicture;
  const showPhoto = isUsablePhotoUrl(photo) && !photoFailed;
  const username = live?.username || record.username;

  return (
    <section className="brother-detail stack">
      <Link to="/brothers" className="brother-back">
        ← Brothers
      </Link>

      <article className="panel brother-detail-hero">
        <div className="brother-detail-identity">
          <div className="brother-detail-avatar" aria-hidden>
            {showPhoto ? (
              <img src={photo} alt="" onError={() => setPhotoFailed(true)} />
            ) : (
              <span>{initialsFromName(name)}</span>
            )}
          </div>
          <div>
            <h1 className="brother-detail-name">{name}</h1>
            <p className="brother-detail-meta">
              {[
                live?.chapter || record.chapter,
                String(live?.initiationYear || record.initiationYear || ''),
              ]
                .filter(Boolean)
                .join(' · ') || 'Kappa Card member'}
            </p>
            {(live?.occupation || record.occupation) && (
              <p className="brother-detail-sub">{live?.occupation || record.occupation}</p>
            )}
            {live?.currentEmployer && (
              <p className="brother-detail-sub">{live.currentEmployer}</p>
            )}
            {(live?.currentCity || record.currentCity) && (
              <p className="brother-detail-sub">{live?.currentCity || record.currentCity}</p>
            )}
          </div>
        </div>

        <p className="brother-detail-badges">
          {record.metViaQr && <span className="brother-badge">Met via QR</span>}
          {record.savedContact && <span className="brother-badge">Saved contact</span>}
        </p>

        <dl className="brother-detail-facts">
          {record.lastMetAt && (
            <div>
              <dt>Last met</dt>
              <dd>{formatWhen(record.lastMetAt)}</dd>
            </div>
          )}
          {record.savedContactAt && (
            <div>
              <dt>Saved contact</dt>
              <dd>{formatWhen(record.savedContactAt)}</dd>
            </div>
          )}
          <div>
            <dt>Updated</dt>
            <dd>{formatWhen(record.lastActivityAt)}</dd>
          </div>
        </dl>

        {username ? (
          <Link className="button brother-detail-card-link" to={`/card/${username}`}>
            View full Kappa Card
          </Link>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            This brother&apos;s public card is unavailable.
          </p>
        )}
      </article>

      <form className="panel stack brother-detail-form" onSubmit={(e) => void onSave(e)}>
        <div>
          <h2>Your notes</h2>
          <p className="muted brother-privacy-note">
            Event, place, and private notes stay on <strong>your</strong> Brothers record. They
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
