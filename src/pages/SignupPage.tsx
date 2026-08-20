import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import chapters from '../data/chapters';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeUsernameInput, suggestUsernameFromName } from '../lib/username';

export default function SignupPage() {
  const { signUp, signInWithGoogle, configured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [chapter, setChapter] = useState('');
  const [initiationYear, setInitiationYear] = useState(String(new Date().getFullYear()));
  const [inviteCode, setInviteCode] = useState(params.get('invite') ?? '');
  const [chapterFilter, setChapterFilter] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setLoading(true);
    try {
      await signUp({
        email,
        password,
        name,
        username: username || suggestUsernameFromName(name),
        chapter,
        initiationYear: Number(initiationYear),
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      navigate('/my-card');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed.');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithGoogle(inviteCode.trim() || undefined);
      navigate(result === 'needs_profile' ? `/complete-profile?invite=${inviteCode}` : '/my-card');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack" style={{ maxWidth: 560, margin: '0 auto' }}>
      <PageMeta
        title="Create your account — Kappa Card"
        description="Join Kappa Card with an invite code. Create your branded card, live QR profile, and start sharing contact info in seconds."
        path="/signup"
      />
      <div>
        <h1>Create your account</h1>
        <p className="muted">
          Enter your invite code to get started. Don&apos;t have one yet?{' '}
          <Link to="/request-invite">Request an invite</Link>.
        </p>
      </div>

      <form className="panel stack" onSubmit={onSubmit}>
        {!configured && <p className="error">Firebase is not configured.</p>}

        <label>
          Invite code
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
            placeholder="ABCD1234"
          />
        </label>

        <div className="grid-2">
          <label>
            Full name
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!username) setUsername(suggestUsernameFromName(e.target.value));
              }}
              required
            />
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
        </div>

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
            placeholder="Start typing a chapter…"
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
          <select value={initiationYear} onChange={(e) => setInitiationYear(e.target.value)} required>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="legal-accept">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>
            I agree to the <Link to="/terms">Terms of Service</Link> and{' '}
            <Link to="/privacy">Privacy Policy</Link>.
          </span>
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading || !configured || !acceptedTerms}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading || !configured || !acceptedTerms}
          onClick={() => void onGoogle()}
        >
          Continue with Google
        </button>
      </form>

      <p className="muted">
        Already have an account? <Link to="/login">Sign in</Link>
        {' · '}
        Need an invite? <Link to="/request-invite">Request an invite</Link>
      </p>
    </section>
  );
}
