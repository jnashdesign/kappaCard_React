import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  assignEventToBrothers,
  listBrothers,
  recentEventNamesFromBrothers,
  removeBrother,
} from '../lib/brothers';
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
  const [message, setMessage] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState<Record<string, boolean>>({});

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState('');
  const [assigning, setAssigning] = useState(false);

  const filtered = useMemo(
    () => brothers.filter((b) => brotherMatchesQuery(b, query)),
    [brothers, query]
  );

  const recentEvents = useMemo(() => recentEventNamesFromBrothers(brothers), [brothers]);

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

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setAssignOpen(false);
    setEventDraft('');
  }

  function toggleSelected(subjectUserId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectUserId)) next.delete(subjectUserId);
      else next.add(subjectUserId);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map((b) => b.subjectUserId)));
  }

  async function onRemove(brother: BrotherRecord) {
    if (!profile) return;
    setRemovingId(brother.subjectUserId);
    setError(null);
    setMessage(null);
    try {
      await removeBrother(profile.id, brother.subjectUserId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove brother.');
    } finally {
      setRemovingId(null);
    }
  }

  async function onConfirmAssign() {
    if (!profile) return;
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const name = eventDraft.trim();
    if (!name) {
      setError('Enter an event name (or pick a recent one) before assigning.');
      return;
    }

    setAssigning(true);
    setError(null);
    setMessage(null);
    try {
      const count = await assignEventToBrothers(profile.id, ids, name);
      await refresh();
      setMessage(
        `Assigned “${name}” to ${count} brother${count === 1 ? '' : 's'}.`
      );
      exitSelectMode();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign event.');
    } finally {
      setAssigning(false);
    }
  }

  if (!profile) return <div className="panel">Loading…</div>;

  return (
    <section className={`brothers-page stack${selectMode ? ' brothers-page--selecting' : ''}`}>
      <div>
        <h1>Brothers</h1>
        <p className="muted">
          Brothers you&apos;ve met via QR or saved to Contacts. Open anyone for notes and their
          latest public card.
        </p>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

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
          <div className="brothers-toolbar">
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
            {!selectMode ? (
              <button
                type="button"
                className="secondary brothers-toolbar-btn"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  setSelectMode(true);
                }}
              >
                Assign event
              </button>
            ) : (
              <button
                type="button"
                className="secondary brothers-toolbar-btn"
                onClick={exitSelectMode}
              >
                Cancel
              </button>
            )}
          </div>

          {selectMode && (
            <div className="brothers-select-hint panel">
              <p className="muted" style={{ margin: 0 }}>
                Select the brothers who were at the same event, then confirm an event name. Nothing
                is assigned until you tap <strong>Assign event</strong>.
              </p>
              <div className="brothers-select-actions">
                <button type="button" className="secondary" onClick={selectAllFiltered}>
                  Select all shown
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={selectedIds.size === 0}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

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
                const selected = selectedIds.has(brother.subjectUserId);
                const rowBody = (
                  <>
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
                          {[brother.occupation, brother.currentCity].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {brother.event?.trim() && (
                        <p className="brothers-event">{brother.event.trim()}</p>
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
                  </>
                );

                return (
                  <li
                    key={brother.subjectUserId}
                    className={`brothers-row${selected ? ' is-selected' : ''}`}
                  >
                    {selectMode ? (
                      <button
                        type="button"
                        className="brothers-row-main brothers-row-select"
                        onClick={() => toggleSelected(brother.subjectUserId)}
                        aria-pressed={selected}
                      >
                        <span
                          className={`brothers-check${selected ? ' is-on' : ''}`}
                          aria-hidden
                        />
                        {rowBody}
                      </button>
                    ) : (
                      <>
                        <Link
                          to={`/brothers/${brother.subjectUserId}`}
                          className="brothers-row-main"
                        >
                          {rowBody}
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
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {selectMode && selectedIds.size > 0 && !assignOpen && (
        <div className="brothers-assign-bar">
          <p className="brothers-assign-count">
            {selectedIds.size} selected
          </p>
          <button type="button" onClick={() => setAssignOpen(true)}>
            Assign event…
          </button>
        </div>
      )}

      {selectMode && assignOpen && (
        <div
          className="brothers-assign-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="brothers-assign-title"
        >
          <div className="brothers-assign-sheet-inner panel stack">
            <div>
              <h2 id="brothers-assign-title" style={{ margin: 0 }}>
                Assign event
              </h2>
              <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                Applies to {selectedIds.size} selected brother
                {selectedIds.size === 1 ? '' : 's'}. Confirm only when the event name is right —
                we never guess from timing.
              </p>
            </div>

            <label>
              Event name
              <input
                value={eventDraft}
                onChange={(e) => setEventDraft(e.target.value)}
                placeholder="e.g. Southwestern Province Council 2026"
                maxLength={200}
                autoComplete="off"
                list="brothers-recent-events"
              />
            </label>
            <datalist id="brothers-recent-events">
              {recentEvents.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {recentEvents.length > 0 && (
              <div className="brothers-event-suggestions">
                <p className="brothers-event-suggestions-label">Recent events</p>
                <div className="brothers-event-chips">
                  {recentEvents.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`brothers-event-chip${
                        eventDraft.trim().toLowerCase() === name.toLowerCase() ? ' is-active' : ''
                      }`}
                      onClick={() => setEventDraft(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="brothers-assign-sheet-actions">
              <button
                type="button"
                className="secondary"
                disabled={assigning}
                onClick={() => setAssignOpen(false)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={assigning || !eventDraft.trim()}
                onClick={() => void onConfirmAssign()}
              >
                {assigning ? 'Assigning…' : `Assign to ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
