import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  canUseCardFeatures,
  createAdminShareInvite,
  createInviteForUser,
  deactivateInvite,
  getAdminShareInvite,
  getInvitesForUser,
  setInviteActive,
} from '../lib/users';
import type { InviteRecord } from '../types';

function inviteStatus(invite: InviteRecord): 'active' | 'used' | 'disabled' {
  if (!invite.multiUse && invite.usedBy) return 'used';
  if (!invite.active) return 'disabled';
  return 'active';
}

export default function InvitesPage() {
  const { profile } = useAuth();
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [shareInvite, setShareInvite] = useState<InviteRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function refresh() {
    if (!profile) return;
    const next = await getInvitesForUser(profile.id);
    setInvites(next.filter((invite) => !invite.multiUse));
    if (profile.admin) {
      setShareInvite(await getAdminShareInvite(profile.id));
    } else {
      setShareInvite(null);
    }
  }

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load invites.')
    );
  }, [profile?.id, profile?.admin]);

  if (!profile) return <div className="panel">Loading…</div>;
  if (!canUseCardFeatures(profile)) {
    return (
      <div className="panel stack">
        <h1>Invites</h1>
        <p className="muted">Basic tier is required to invite new members.</p>
        <Link className="button" to="/upgrade">
          Unlock Basic
        </Link>
      </div>
    );
  }

  async function createInvite() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const invite = await createInviteForUser(profile);
      await refresh();
      setMessage(`Created invite code ${invite.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite.');
    } finally {
      setLoading(false);
    }
  }

  async function createShareCode() {
    if (!profile) return;
    setShareLoading(true);
    setError(null);
    setMessage(null);
    try {
      const invite = await createAdminShareInvite(profile);
      await refresh();
      setMessage(`Chapter share code ready: ${invite.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create share code.');
    } finally {
      setShareLoading(false);
    }
  }

  async function copyLink(code: string) {
    const url = `${window.location.origin}/signup?invite=${code}`;
    await navigator.clipboard.writeText(url);
    setMessage('Invite link copied.');
  }

  async function onDisable(invite: InviteRecord) {
    if (!profile) return;
    setTogglingId(invite.id);
    setError(null);
    setMessage(null);
    try {
      await deactivateInvite(invite.id, profile.id);
      await refresh();
      setMessage(`Invite ${invite.code} disabled.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable invite.');
    } finally {
      setTogglingId(null);
    }
  }

  async function onToggleShare(active: boolean) {
    if (!profile || !shareInvite) return;
    setTogglingId(shareInvite.id);
    setError(null);
    setMessage(null);
    try {
      await setInviteActive(shareInvite.id, profile.id, active);
      await refresh();
      setMessage(active ? 'Chapter share code is active.' : 'Chapter share code disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update share code.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section className="stack">
      <div>
        <h1>Invites</h1>
        <p className="muted">
          Every new member is tied to the brother who invited them. Use one-time codes for
          individuals
          {profile.admin ? ', or your chapter share code when inviting a whole group' : ''}.
        </p>
      </div>

      {profile.admin && (
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Chapter share code</h2>
          <p className="muted" style={{ margin: 0 }}>
            One reusable code for your chapter. Anyone can sign up with it while Active. Turn it off
            anytime to stop new signups.
          </p>

          {!shareInvite ? (
            <button type="button" onClick={() => void createShareCode()} disabled={shareLoading}>
              {shareLoading ? 'Creating…' : 'Create chapter share code'}
            </button>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.25rem', letterSpacing: '0.06em' }}>
                  {shareInvite.code}
                </strong>
                <span className="badge">{shareInvite.active ? 'Active' : 'Disabled'}</span>
              </div>
              <span className="muted">
                Used {shareInvite.useCount ?? 0} time{(shareInvite.useCount ?? 0) === 1 ? '' : 's'}
                {shareInvite.lastUsedAt
                  ? ` · last ${new Date(shareInvite.lastUsedAt).toLocaleString()}`
                  : ''}
              </span>
              <div className="row">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void copyLink(shareInvite.code)}
                >
                  Copy signup link
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={togglingId === shareInvite.id}
                  onClick={() => void onToggleShare(!shareInvite.active)}
                >
                  {togglingId === shareInvite.id
                    ? 'Updating…'
                    : shareInvite.active
                      ? 'Disable'
                      : 'Enable'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>One-time invites</h2>
        <p className="muted" style={{ margin: 0 }}>
          Each code works once. Disable unused codes if you no longer want them shared.
        </p>
        <button type="button" onClick={() => void createInvite()} disabled={loading}>
          {loading ? 'Creating…' : 'Generate new invite'}
        </button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="stack">
        {invites.length === 0 && <p className="muted">No one-time invites yet.</p>}
        {invites.map((invite) => {
          const status = inviteStatus(invite);
          return (
            <div key={invite.id} className="list-card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{invite.code}</strong>
                <span className="badge">
                  {status === 'active' && 'Active'}
                  {status === 'used' && 'Used'}
                  {status === 'disabled' && 'Disabled'}
                </span>
              </div>
              <span className="muted">Created {new Date(invite.createdAt).toLocaleString()}</span>
              {status === 'used' && invite.usedAt && (
                <span className="muted">Redeemed {new Date(invite.usedAt).toLocaleString()}</span>
              )}
              {status === 'active' && (
                <div className="row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void copyLink(invite.code)}
                  >
                    Copy signup link
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={togglingId === invite.id}
                    onClick={() => void onDisable(invite)}
                  >
                    {togglingId === invite.id ? 'Disabling…' : 'Disable'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
