import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import chapters from '../data/chapters';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeUsernameInput, suggestUsernameFromName } from '../lib/username';

export default function CompleteProfilePage() {
  const { firebaseUser, completeGoogleSignup, profile } = useAuth();
  const [params] = useSearchParams();

  const [name, setName] = useState(firebaseUser?.displayName ?? '');
  const [username, setUsername] = useState(
    suggestUsernameFromName(firebaseUser?.displayName ?? 'brother')
  );
  const [chapter, setChapter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [initiationYear, setInitiationYear] = useState(String(new Date().getFullYear()));
  const [inviteCode, setInviteCode] = useState(params.get('invite') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 1910 }, (_, i) => String(current - i));
  }, []);

  const suggestions = useMemo(() => {
    if (!chapterFilter.trim()) return [];
    return chapters
      .filter((c) => c.toLowerCase().includes(chapterFilter.toLowerCase()))
      .slice(0, 8);
  }, [chapterFilter]);

  if (profile || done) {
    return <Navigate to="/my-card" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await completeGoogleSignup({
        name,
        username,
        chapter,
        initiationYear: Number(initiationYear),
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack" style={{ maxWidth: 560, margin: '0 auto' }}>
      <div>
        <h1>Finish your profile</h1>
        <p className="muted">Google sign-in still requires an invite and your chapter details.</p>
      </div>

      <form className="panel stack" onSubmit={onSubmit}>
        <label>
          Invite code
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
          />
        </label>
        <label>
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(sanitizeUsernameInput(e.target.value))}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            pattern="[a-z0-9_]+"
            title="Lowercase letters, numbers, and underscores only"
            required
          />
        </label>
        <label>
          Chapter of initiation
          <input
            value={chapterFilter || chapter}
            onChange={(e) => {
              setChapterFilter(e.target.value);
              setChapter(e.target.value);
            }}
            required
          />
        </label>
        {suggestions.length > 0 && (
          <div className="stack">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="secondary"
                onClick={() => {
                  setChapter(item);
                  setChapterFilter(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        <label>
          Initiation year
          <select value={initiationYear} onChange={(e) => setInitiationYear(e.target.value)}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </section>
  );
}
