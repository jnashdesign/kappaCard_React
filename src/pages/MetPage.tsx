import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listMyEncounters } from '../lib/encounters';
import { isUsablePhotoUrl } from '../lib/photos';
import { toPublicProfile } from '../lib/privacy';
import { getUserById } from '../lib/users';
import type { Encounter, UserProfile } from '../types';
import './MetPage.css';

type BrotherPreview = Pick<
  UserProfile,
  'id' | 'name' | 'username' | 'chapter' | 'initiationYear' | 'currentCity' | 'profilePicture'
>;

type EncounterRow = {
  encounter: Encounter;
  brother: BrotherPreview | null;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ΚΑΨ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(date);
  const dayMs = 24 * 60 * 60 * 1000;

  if (day === today) return 'Today';
  if (day === today - dayMs) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupByDate(rows: EncounterRow[]): Array<{ label: string; rows: EncounterRow[] }> {
  const groups: Array<{ label: string; rows: EncounterRow[] }> = [];
  for (const row of rows) {
    const label = dateGroupLabel(row.encounter.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.rows.push(row);
    } else {
      groups.push({ label, rows: [row] });
    }
  }
  return groups;
}

async function loadBrotherPreviews(ownerIds: string[]): Promise<Map<string, BrotherPreview>> {
  const unique = [...new Set(ownerIds.filter(Boolean))];
  const map = new Map<string, BrotherPreview>();

  await Promise.all(
    unique.map(async (id) => {
      try {
        const profile = await getUserById(id);
        if (!profile) return;
        const pub = toPublicProfile(profile);
        map.set(id, {
          id: pub.id,
          name: pub.name,
          username: pub.username,
          chapter: pub.chapter,
          initiationYear: pub.initiationYear,
          currentCity: pub.currentCity,
          profilePicture: pub.profilePicture,
        });
      } catch {
        // Skip broken profiles; row still shows with fallback
      }
    })
  );

  return map;
}

export default function MetPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<EncounterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => groupByDate(rows), [rows]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const encounters = await listMyEncounters(profile.id);
        const brothers = await loadBrotherPreviews(encounters.map((e) => e.ownerId));
        if (!active) return;
        setRows(
          encounters.map((encounter) => ({
            encounter,
            brother: brothers.get(encounter.ownerId) ?? null,
          }))
        );
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load people you have met.');
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

  return (
    <section className="met-page stack">
      <div>
        <h1>People I&apos;ve Met</h1>
        <p className="muted">
          Brothers whose Kappa Cards you encountered — a memory aid from QR scans, not another
          contacts list.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <div className="panel">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            No encounters yet. When you scan a brother&apos;s QR code while signed in, they will
            appear here.
          </p>
        </div>
      ) : (
        <div className="met-groups">
          {groups.map((group) => (
            <section key={group.label} className="met-group">
              <h2 className="met-group-label">{group.label}</h2>
              <ul className="met-list">
                {group.rows.map(({ encounter, brother }) => {
                  const name = brother?.name || 'Brother';
                  const showPhoto =
                    isUsablePhotoUrl(brother?.profilePicture) && !photoFailed[encounter.id];
                  const hasNote = Boolean(encounter.privateNote?.trim());

                  return (
                    <li key={encounter.id}>
                      <Link to={`/met/${encounter.id}`} className="met-row">
                        <div className="met-avatar" aria-hidden>
                          {showPhoto ? (
                            <img
                              src={brother!.profilePicture}
                              alt=""
                              onError={() =>
                                setPhotoFailed((prev) => ({ ...prev, [encounter.id]: true }))
                              }
                            />
                          ) : (
                            <span>{initialsFromName(name)}</span>
                          )}
                        </div>
                        <div className="met-copy">
                          <p className="met-name">{name}</p>
                          <p className="met-meta">
                            {[
                              brother?.chapter,
                              brother?.initiationYear ? String(brother.initiationYear) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Kappa Card member'}
                          </p>
                          {brother?.currentCity && (
                            <p className="met-sub">{brother.currentCity}</p>
                          )}
                          {encounter.event?.trim() && (
                            <p className="met-event">{encounter.event.trim()}</p>
                          )}
                          <p className="met-when">
                            {formatTime(encounter.timestamp)}
                            {hasNote ? ' · Note saved' : ''}
                          </p>
                        </div>
                        <span className="met-chevron" aria-hidden>
                          ›
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
