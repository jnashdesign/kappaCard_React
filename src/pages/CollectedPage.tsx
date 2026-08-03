import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listCollectedCards, removeCollectedCard } from '../lib/collectedCards';
import { isUsablePhotoUrl } from '../lib/photos';
import type { CollectedCard } from '../types';
import './CollectedPage.css';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ΚΑΨ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function formatCollectedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function cardMatchesQuery(card: CollectedCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    card.name,
    card.username,
    card.chapter,
    card.occupation,
    card.currentCity,
    String(card.initiationYear ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export default function CollectedPage() {
  const { profile } = useAuth();
  const [cards, setCards] = useState<CollectedCard[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState<Record<string, boolean>>({});

  const filteredCards = useMemo(
    () => cards.filter((card) => cardMatchesQuery(card, query)),
    [cards, query]
  );

  async function refresh() {
    if (!profile) return;
    const next = await listCollectedCards(profile.id);
    setCards(next);
  }

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    setError(null);
    void listCollectedCards(profile.id)
      .then((next) => {
        if (active) setCards(next);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load collected cards.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  if (!profile) return <div className="panel">Loading…</div>;

  async function onRemove(card: CollectedCard) {
    if (!profile) return;
    setRemovingId(card.subjectUserId);
    setError(null);
    try {
      await removeCollectedCard(profile.id, card.subjectUserId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove from Collected.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="collected-page stack">
      <div>
        <h1>Collected</h1>
        <p className="muted">
          Brothers whose cards you saved to Contacts. Open a card anytime for the latest public
          info, or download again from their page.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <div className="panel">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            No cards yet. When you scan a brother&apos;s QR or open their link and tap{' '}
            <strong>Save to Contacts</strong>, they appear here.
          </p>
        </div>
      ) : (
        <>
          <label className="collected-search">
            <span className="visually-hidden">Search collected cards</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, chapter, city…"
              autoComplete="off"
            />
          </label>

          {filteredCards.length === 0 ? (
            <div className="panel">
              <p className="muted" style={{ margin: 0 }}>
                No brothers match “{query.trim()}”.
              </p>
            </div>
          ) : (
            <ul className="collected-list">
              {filteredCards.map((card) => {
                const showPhoto =
                  isUsablePhotoUrl(card.profilePicture) && !photoFailed[card.subjectUserId];
                return (
                  <li key={card.subjectUserId} className="collected-row">
                    <Link to={`/card/${card.username}`} className="collected-row-main">
                      <div className="collected-avatar" aria-hidden>
                        {showPhoto ? (
                          <img
                            src={card.profilePicture}
                            alt=""
                            onError={() =>
                              setPhotoFailed((prev) => ({
                                ...prev,
                                [card.subjectUserId]: true,
                              }))
                            }
                          />
                        ) : (
                          <span>{initialsFromName(card.name)}</span>
                        )}
                      </div>
                      <div className="collected-copy">
                        <p className="collected-name">{card.name}</p>
                        <p className="collected-meta">
                          {card.chapter}
                          {card.initiationYear ? ` · ${card.initiationYear}` : ''}
                        </p>
                        {(card.occupation || card.currentCity) && (
                          <p className="collected-sub">
                            {[card.occupation, card.currentCity].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {card.collectedAt && (
                          <p className="collected-date">
                            Saved {formatCollectedDate(card.collectedAt)}
                          </p>
                        )}
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="secondary collected-remove"
                      disabled={removingId === card.subjectUserId}
                      onClick={() => void onRemove(card)}
                    >
                      {removingId === card.subjectUserId ? 'Removing…' : 'Remove'}
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
