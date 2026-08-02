import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  approveInviteRequest,
  listInviteRequests,
  setInviteRequestStatus,
} from '../lib/inviteRequests';
import { listAccountDeletions, listAllInvites, listUsers, setUserAdmin, setUserTier } from '../lib/users';
import { useEffect, useState } from 'react';
import type {
  AccountDeletion,
  InviteRecord,
  InviteRequest,
  MembershipTier,
  UserProfile,
} from '../types';
import AdminAnalytics from './AdminAnalytics';

export default function AdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [deletions, setDeletions] = useState<AccountDeletion[]>([]);
  const [inviteRequests, setInviteRequests] = useState<InviteRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'analytics' | 'ops'>('analytics');

  async function refresh() {
    const [nextUsers, nextRequests, nextInvites, nextDeletions] = await Promise.all([
      listUsers(),
      listInviteRequests(),
      listAllInvites(),
      listAccountDeletions(),
    ]);
    setUsers(nextUsers.sort((a, b) => a.name.localeCompare(b.name)));
    setInviteRequests(nextRequests);
    setInvites(nextInvites);
    setDeletions(nextDeletions);
  }

  useEffect(() => {
    if (!profile?.admin) return;
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load admin data.')
    );
  }, [profile?.admin, profile?.id, profile?.stats?.logins]);

  if (!profile) return <div className="panel">Loading…</div>;
  if (!profile.admin) return <Navigate to="/my-card" replace />;

  const pendingRequests = inviteRequests.filter((r) => r.status === 'pending');
  const reviewedRequests = inviteRequests.filter((r) => r.status !== 'pending');

  async function onToggleAdmin(user: UserProfile) {
    if (!profile) return;
    setError(null);
    setMessage(null);
    try {
      if (user.id === profile.id && user.admin) {
        setError('You cannot remove your own admin access.');
        return;
      }
      await setUserAdmin(user.id, !user.admin);
      await refresh();
      setMessage(`${user.name} is now ${!user.admin ? 'an admin' : 'a regular member'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update admin.');
    }
  }

  async function onTierChange(user: UserProfile, tier: MembershipTier) {
    setError(null);
    try {
      await setUserTier(user.id, tier);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update tier.');
    }
  }

  async function onApprove(request: InviteRequest, grantsBasic = false) {
    if (!profile) return;
    setBusyId(request.id);
    setError(null);
    setMessage(null);
    try {
      const { code, signupUrl } = await approveInviteRequest(profile, request, { grantsBasic });
      await navigator.clipboard.writeText(signupUrl);
      await refresh();
      setMessage(
        grantsBasic
          ? `Approved ${request.name} with complimentary Basic. Invite ${code} copied — email it to ${request.email}.`
          : `Approved ${request.name} (paywalled). Invite ${code} copied — email it to ${request.email}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve request.');
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(request: InviteRequest) {
    setBusyId(request.id);
    setError(null);
    setMessage(null);
    try {
      await setInviteRequestStatus(request.id, 'declined');
      await refresh();
      setMessage(`Declined request from ${request.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline request.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="stack admin-analytics">
      <div>
        <h1>Admin</h1>
        <p className="muted">
          Track adoption and usage, review invite requests, and manage membership tiers.
        </p>
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className={tab === 'analytics' ? undefined : 'secondary'}
            onClick={() => setTab('analytics')}
          >
            Analytics
          </button>
          <button
            type="button"
            className={tab === 'ops' ? undefined : 'secondary'}
            onClick={() => setTab('ops')}
          >
            Members &amp; requests
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {tab === 'analytics' ? (
        <AdminAnalytics users={users} invites={invites} deletions={deletions} />
      ) : (
        <>
          <div className="panel stack">
            <h2 style={{ margin: 0 }}>Invite requests ({pendingRequests.length} pending)</h2>
            <p className="muted" style={{ margin: 0 }}>
              Verify name, chapter, and year against membership records before approving. Choose
              paywalled (default — they pay $9.99 later) or complimentary Basic for adoption.
            </p>
            {pendingRequests.length === 0 && <p className="muted">No pending requests.</p>}
            {pendingRequests.map((request) => (
              <div key={request.id} className="list-card">
                <strong>{request.name}</strong>
                <span className="muted">
                  {request.chapter} ◆ {request.initiationYear}
                </span>
                <span className="muted">{request.email}</span>
                <span className="muted">
                  Requested {request.createdAt ? new Date(request.createdAt).toLocaleString() : '—'}
                </span>
                <div className="row">
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => void onApprove(request, false)}
                  >
                    {busyId === request.id ? 'Working…' : 'Approve (paywalled)'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === request.id}
                    onClick={() => void onApprove(request, true)}
                  >
                    Approve + complimentary Basic
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyId === request.id}
                    onClick={() => void onDecline(request)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}

            {reviewedRequests.length > 0 && (
              <>
                <h3 style={{ margin: '0.5rem 0 0' }}>Recent reviews</h3>
                {reviewedRequests.slice(0, 8).map((request) => (
                  <div key={request.id} className="list-card">
                    <strong>
                      {request.name}{' '}
                      <span className="badge">{request.status}</span>
                    </strong>
                    <span className="muted">
                      {request.chapter} ◆ {request.initiationYear} · {request.email}
                    </span>
                    {request.inviteCode && (
                      <span className="muted">Invite code: {request.inviteCode}</span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="panel stack">
            <h2 style={{ margin: 0 }}>Members ({users.length})</h2>
            {users.map((user) => (
              <div key={user.id} className="list-card">
                <strong>
                  {user.name} {user.admin ? '· ADMIN' : ''}
                  {user.activatedAt ? ' · Activated' : ''}
                </strong>
                <span className="muted">
                  @{user.username} · {user.email} · invited by @{user.invitedByUsername || '—'}
                </span>
                <div className="row">
                  <label style={{ minWidth: 200 }}>
                    Tier
                    <select
                      value={user.tier}
                      onChange={(e) => void onTierChange(user, e.target.value as MembershipTier)}
                    >
                      <option value="free">free</option>
                      <option value="basic">basic</option>
                      <option value="premium">premium</option>
                    </select>
                  </label>
                  <button
                    style={{ margin: '52px 10px 25px 10px', borderRadius: '10px !important' }}
                    type="button"
                    className="primary"
                    onClick={() => void onToggleAdmin(user)}
                  >
                    {user.admin ? 'Revoke admin' : 'Make admin'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
