import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import chapters from '../data/chapters';
import { useAuth } from '../contexts/AuthContext';
import { submitInviteRequest } from '../lib/inviteRequests';

export default function RequestInvitePage() {
  const { configured } = useAuth();
  const [name, setName] = useState('');
  const [chapter, setChapter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [initiationYear, setInitiationYear] = useState(String(new Date().getFullYear()));
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await submitInviteRequest({
        name,
        chapter: chapter || chapterFilter,
        initiationYear: Number(initiationYear),
        email,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <section className="stack" style={{ maxWidth: 560, margin: '0 auto' }}>
        <PageMeta
          title="Request an invite — Kappa Card"
          description="Kappa Card is invite-only. Request an invite to create your branded card, live QR profile, and share contact info with a single scan."
          path="/request-invite"
        />
        <div className="panel stack">
          <h1 style={{ margin: 0 }}>Request received</h1>
          <p className="muted" style={{ margin: 0 }}>
            Thanks, {name.split(' ')[0] || 'brother'}. We’ll verify your membership details and email
            an invite to <strong>{email}</strong> if everything checks out.
          </p>
          <Link className="button" to="/">
            Back to home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="stack" style={{ maxWidth: 560, margin: '0 auto' }}>
      <PageMeta
        title="Request an invite — Kappa Card"
        description="Kappa Card is invite-only. Request an invite to create your branded card, live QR profile, and share contact info with a single scan."
        path="/request-invite"
      />
      <div>
        <h1>Request an invite</h1>
        <p className="muted">
          Kappa Card is invite-only. Enter your details exactly as they appear on your membership
          card so we can verify you before sending an invite. Already have a code?{' '}
          <Link to="/signup">I have an invite</Link>.
        </p>
      </div>

      <form className="panel stack" onSubmit={onSubmit}>
        {!configured && <p className="error">Firebase is not configured.</p>}

        <label>
          Full name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="As shown on your membership card"
            autoComplete="name"
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
            placeholder="As shown on your membership card"
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
          Year of initiation
          <select
            value={initiationYear}
            onChange={(e) => setInitiationYear(e.target.value)}
            required
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Where should we send your invite?"
            autoComplete="email"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading || !configured}>
          {loading ? 'Submitting…' : 'Submit request'}
        </button>
      </form>

      <p className="muted">
        Already have an invite? <Link to="/signup">I have an invite</Link>
      </p>
    </section>
  );
}
