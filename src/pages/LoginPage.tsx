import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { useAuth } from '../contexts/AuthContext';
import { friendlyAuthError } from '../lib/authErrors';

export default function LoginPage() {
  const { signIn, signInWithGoogle, resetPassword, configured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const invite = params.get('invite') ?? undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/my-card');
    } catch (err) {
      setError(friendlyAuthError(err, 'Could not sign in. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithGoogle(invite);
      navigate(result === 'needs_profile' ? '/complete-profile' : '/my-card');
    } catch (err) {
      setError(friendlyAuthError(err, 'Could not sign in with Google. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function onReset() {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Enter your email first to reset your password.');
      return;
    }
    try {
      await resetPassword(email.trim());
      setMessage('Password reset email sent.');
    } catch (err) {
      setError(
        friendlyAuthError(err, 'Could not send a reset email. Check the address and try again.')
      );
    }
  }

  return (
    <section className="stack" style={{ maxWidth: 480, margin: '0 auto' }}>
      <PageMeta
        title="Sign in — Kappa Card"
        description="Sign in to Kappa Card to manage your branded card, QR link, Brothers list, and invites."
        path="/login"
      />
      <div>
        <h1>Sign In</h1>
        <p className="muted">Welcome back. Use email or Google.</p>
      </div>

      <form className="panel stack" onSubmit={onSubmit}>
        {!configured && <p className="error">Firebase is not configured.</p>}
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
          />
        </label>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button type="submit" disabled={loading || !configured}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="secondary" disabled={loading || !configured} onClick={() => void onGoogle()}>
          Continue with Google
        </button>
        <button type="button" className="secondary" onClick={() => void onReset()}>
          Forgot password
        </button>
      </form>

      <p className="muted">
        Need an account? <Link to={invite ? `/signup?invite=${invite}` : '/signup'}>Sign up with an invite</Link>
      </p>
    </section>
  );
}
