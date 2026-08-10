import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listBrothers, removeBrother } from '../lib/brothers';
import { mergeMyEncountersIntoBrothers } from '../lib/encounters';
import { isUsablePhotoUrl } from '../lib/photos';
import type { BrotherRecord } from '../types';
import './BrothersPage.css';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ΚΑΨ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function brotherMatchesQuery(brother: BrotherRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    brother.name,
    brother.username,
    brother.chapter,
    brother.occupation,
    brother.currentCity,
    brother.event,
    String(brother.initiationYear ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export default function BrothersPage() {
  const { profile } = useAuth();
  const [brothers, setBrothers] = useState<BrotherRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () => brothers.filter((b) => brotherMatchesQuery(b, query)),
    [brothers, query]
  );

  async function refresh() {
    if (!profile) return;
    await mergeMyEncountersIntoBrothers(profile.id).catch(() => 0);
    const next = await listBrothers(profile.id);
    setBrothers(next);
  }

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await mergeMyEncountersIntoBrothers(profile.id).catch(() => 0);
        const next = await listBrothers(profile.id);
        if (active) setBrothers(next);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load Brothers.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile?.id]);

  if (!profile) return <div className="panel">Loading…</div>;

  async function onRemove(brother: BrotherRecord) {
    if (!profile) return;
    setRemovingId(brother.subjectUserId);
    setError(null);
    try {
      await removeBrother(profile.id, brother.subjectUserId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove brother.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="brothers-page stack">
      <div>
        <h1>Brothers</h1>
        <p className="muted">
          Brothers you&apos;ve met via QR or saved to Contacts. Open anyone for notes and their
          latest public card.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <div className="panel">Loading…</div>
      ) : brothers.length === 0 ? (
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            No brothers yet. Scan a QR while signed in, or open a card and tap{' '}
            <strong>Save to Contacts</strong>.
          </p>
        </div>
      ) : (
        <>
          <label className="brothers-search">
            <span className="visually-hidden">Search brothers</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, chapter, city…"
              autoComplete="off"
            />
          </label>

          {filtered.length === 0 ? (
            <div className="panel">
              <p className="muted" style={{ margin: 0 }}>
                No brothers match “{query.trim()}”.
              </p>
            </div>
          ) : (
            <ul className="brothers-list">
              {filtered.map((brother) => {
                const showPhoto =
                  isUsablePhotoUrl(brother.profilePicture) &&
                  !photoFailed[brother.subjectUserId];
                const hasNote = Boolean(brother.privateNote?.trim());
                return (
                  <li key={brother.subjectUserId} className="brothers-row">
                    <Link
                      to={`/brothers/${brother.subjectUserId}`}
                      className="brothers-row-main"
                    >
                      <div className="brothers-avatar" aria-hidden>
                        {showPhoto ? (
                          <img
                            src={brother.profilePicture}
                            alt=""
                            onError={() =>
                              setPhotoFailed((prev) => ({
                                ...prev,
                                [brother.subjectUserId]: true,
                              }))
                            }
                          />
                        ) : (
                          <span>{initialsFromName(brother.name)}</span>
                        )}
                      </div>
                      <div className="brothers-copy">
                        <p className="brothers-name">{brother.name}</p>
                        <p className="brothers-meta">
                          {brother.chapter}
                          {brother.initiationYear ? ` · ${brother.initiationYear}` : ''}
                        </p>
                        {(brother.occupation || brother.currentCity) && (
                          <p className="brothers-sub">
                            {[brother.occupation, brother.currentCity]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        <p className="brothers-badges">
                          {brother.metViaQr && <span className="brothers-badge">Met via QR</span>}
                          {brother.savedContact && (
                            <span className="brothers-badge">Saved contact</span>
                          )}
                          {hasNote && <span className="brothers-badge">Note</span>}
                        </p>
                        {brother.lastActivityAt && (
                          <p className="brothers-date">
                            Updated {formatActivityDate(brother.lastActivityAt)}
                          </p>
                        )}
                      </div>
                      <span className="brothers-chevron" aria-hidden>
                        ›
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="secondary brothers-remove"
                      disabled={removingId === brother.subjectUserId}
                      onClick={() => void onRemove(brother)}
                    >
                      {removingId === brother.subjectUserId ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
