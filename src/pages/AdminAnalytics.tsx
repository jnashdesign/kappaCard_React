import { useMemo, useState } from 'react';
import type { AccountDeletion, InviteRecord, UserProfile } from '../types';
import {
  buildPeriodSeries,
  computeChapterRows,
  computeFunnel,
  computeRecruiterLeaderboards,
  groupCount,
  inviteConversion,
  metricTimestamps,
  type ChartMetric,
  type PeriodGrain,
} from '../lib/adminAnalytics';
import './AdminAnalytics.css';

type Props = {
  users: UserProfile[];
  invites: InviteRecord[];
  deletions: AccountDeletion[];
};

const METRICS: Array<{ id: ChartMetric; label: string }> = [
  { id: 'registrations', label: 'New registrations' },
  { id: 'invitesSent', label: 'Invitations sent' },
  { id: 'invitesClaimed', label: 'Invitations claimed' },
  { id: 'profilesCompleted', label: 'Profiles completed' },
  { id: 'accountDeletions', label: 'Account deletions' },
];

export default function AdminAnalytics({ users, invites, deletions }: Props) {
  const [grain, setGrain] = useState<PeriodGrain>('day');
  const [metric, setMetric] = useState<ChartMetric>('registrations');

  const periods = grain === 'day' ? 14 : grain === 'week' ? 12 : 12;
  const series = useMemo(
    () => buildPeriodSeries(metricTimestamps(users, invites, metric, deletions), grain, periods),
    [users, invites, deletions, metric, grain, periods]
  );
  const maxBar = Math.max(1, ...series.map((b) => b.count));
  const funnel = useMemo(() => computeFunnel(users), [users]);
  const { recruiters, catalysts } = useMemo(
    () => computeRecruiterLeaderboards(users, invites),
    [users, invites]
  );
  const chapters = useMemo(() => computeChapterRows(users), [users]);
  const byYear = useMemo(
    () => groupCount(users, (u) => String(u.initiationYear)),
    [users]
  );
  const byCity = useMemo(
    () => groupCount(users, (u) => u.currentCity?.trim() || 'Unknown'),
    [users]
  );
  const byProvince = useMemo(
    () => groupCount(users, (u) => u.province?.trim() || 'Unknown'),
    [users]
  );

  const oneTime = invites.filter((i) => !i.multiUse);
  const claimedOneTime = oneTime.filter((i) => i.usedBy).length;
  const disabledUnused = oneTime.filter((i) => !i.active && !i.usedBy).length;
  const conversion = inviteConversion(users, invites);
  const completedRate =
    users.length === 0
      ? 0
      : users.filter((u) => u.profileCompletedAt).length / users.length;
  const activatedRate =
    users.length === 0 ? 0 : users.filter((u) => u.activatedAt).length / users.length;

  const deletionsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return deletions.filter((d) => {
      const ms = Date.parse(d.deletedAt);
      return Number.isFinite(ms) && ms >= weekAgo;
    }).length;
  }, [deletions]);

  const topActors = useMemo(() => {
    const invitesSentByUser = new Map<string, number>();
    for (const invite of invites) {
      invitesSentByUser.set(
        invite.inviterId,
        (invitesSentByUser.get(invite.inviterId) ?? 0) + 1
      );
    }
    return [...users]
      .map((u) => {
        const invitesCreated = Math.max(
          u.stats.invitesCreated,
          invitesSentByUser.get(u.id) ?? 0
        );
        const score =
          u.stats.cardImageDownloads +
          invitesCreated +
          u.stats.cardViews +
          u.stats.contactDownloads +
          u.stats.logins;
        return { user: u, score, invitesCreated };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [users, invites]);

  return (
    <div className="admin-analytics stack">
      <div>
        <h2 style={{ margin: 0 }}>Analytics</h2>
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Free baseline from members + invites. Primary chart shows <strong>new activity per
          period</strong> (not cumulative totals).
        </p>
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi">
          <span className="admin-kpi-label">Registered</span>
          <strong>{users.length}</strong>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Invite conversion</span>
          <strong>{Math.round(conversion * 100)}%</strong>
          <span className="muted">
            {claimedOneTime}/{oneTime.length} one-time claimed
          </span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Profile completed</span>
          <strong>{Math.round(completedRate * 100)}%</strong>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Activated</span>
          <strong>{Math.round(activatedRate * 100)}%</strong>
          <span className="muted">profile + card download</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Invites disabled unused</span>
          <strong>{disabledUnused}</strong>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Account deletions</span>
          <strong>{deletions.length}</strong>
          <span className="muted">{deletionsThisWeek} this week</span>
        </div>
      </div>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Activity over time</h3>
          <div className="row">
            {(['day', 'week', 'month'] as PeriodGrain[]).map((g) => (
              <button
                key={g}
                type="button"
                className={grain === g ? 'primary' : 'secondary'}
                onClick={() => setGrain(g)}
              >
                {g === 'day' ? 'Day' : g === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={metric === m.id ? 'primary' : 'secondary'}
              onClick={() => setMetric(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="admin-chart" role="img" aria-label={`${metric} by ${grain}`}>
          {series.map((bucket) => (
            <div key={bucket.key} className="admin-chart-col">
              <div className="admin-chart-value">{bucket.count}</div>
              <div
                className="admin-chart-bar"
                style={{ height: `${Math.max(4, (bucket.count / maxBar) * 140)}px` }}
              />
              <div className="admin-chart-label">{bucket.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Activation funnel</h3>
        <p className="muted" style={{ margin: 0 }}>
          Registered → profile completed → own card downloaded → public card viewed → contact
          downloaded. Activated = profile completed + own card downloaded.
        </p>
        <div className="admin-funnel">
          {(
            [
              ['Registered', funnel.registered],
              ['Profile completed', funnel.profileCompleted],
              ['Card downloaded', funnel.cardDownloaded],
              ['Public card viewed', funnel.publicCardViewed],
              ['Contact downloaded', funnel.contactDownloaded],
              ['Activated', funnel.activated],
            ] as const
          ).map(([label, count]) => (
            <div key={label} className="admin-funnel-step">
              <span>{label}</span>
              <strong>{count}</strong>
              <div
                className="admin-funnel-bar"
                style={{
                  width: `${Math.max(8, (count / Math.max(1, funnel.registered)) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="admin-split">
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>Best recruiters</h3>
          <p className="muted" style={{ margin: 0 }}>
            Highest direct successful invitations.
          </p>
          {recruiters.length === 0 && <p className="muted">No invite activity yet.</p>}
          {recruiters.map((row) => (
            <div key={row.user.id} className="list-card">
              <strong>
                {row.user.name}{' '}
                <span className="muted">@{row.user.username}</span>
              </strong>
              <span className="muted">
                Direct signups {row.directSignups} · Sent {row.invitesSent} · Conversion{' '}
                {Math.round(row.conversion * 100)}%
              </span>
            </div>
          ))}
        </section>

        <section className="panel stack">
          <h3 style={{ margin: 0 }}>Best catalysts</h3>
          <p className="muted" style={{ margin: 0 }}>
            Trees that keep spreading beyond the first generation.
          </p>
          {catalysts.length === 0 && <p className="muted">No multi-generation trees yet.</p>}
          {catalysts.map((row) => (
            <div key={row.user.id} className="list-card">
              <strong>
                {row.user.name}{' '}
                <span className="muted">@{row.user.username}</span>
              </strong>
              <span className="muted">
                Descendants {row.totalDescendants} · Depth {row.maxDepth} · Direct{' '}
                {row.directSignups}
              </span>
            </div>
          ))}
        </section>
      </div>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Who is active</h3>
        <p className="muted" style={{ margin: 0 }}>
          Lifetime action totals (logins, invites, card downloads, views, contacts). Login counts
          once per browser session; invite totals include invites already in Firestore.
        </p>
        {topActors.length === 0 && (
          <p className="muted">No tracked actions yet — counters start as members use the app.</p>
        )}
        {topActors.map(({ user, score, invitesCreated }) => (
          <div key={user.id} className="list-card">
            <strong>
              {user.name} <span className="muted">@{user.username}</span>
            </strong>
            <span className="muted">
              Score {score} · logins {user.stats.logins} · invites {invitesCreated} ·
              card DL {user.stats.cardImageDownloads} · views {user.stats.cardViews} · contacts{' '}
              {user.stats.contactDownloads}
            </span>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Chapter density</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Members</th>
                <th>Activated</th>
                <th>Views</th>
                <th>Contacts</th>
                <th>New this week</th>
                <th>WoW</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((row) => (
                <tr key={row.chapter}>
                  <td>{row.chapter}</td>
                  <td>{row.members}</td>
                  <td>
                    {row.activated} ({Math.round((row.activated / Math.max(1, row.members)) * 100)}
                    %)
                  </td>
                  <td>{row.cardViews}</td>
                  <td>{row.contactDownloads}</td>
                  <td>{row.newThisWeek}</td>
                  <td>
                    {row.weekOverWeek == null
                      ? row.newThisWeek > 0
                        ? 'new'
                        : '—'
                      : `${row.weekOverWeek >= 0 ? '+' : ''}${Math.round(row.weekOverWeek * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Recent account deletions</h3>
        <p className="muted" style={{ margin: 0 }}>
          Logged when a member deletes their account (profile is removed; this history remains).
        </p>
        {deletions.length === 0 && <p className="muted">No deletions recorded yet.</p>}
        {deletions.slice(0, 20).map((row) => (
          <div key={row.id} className="list-card">
            <strong>
              {row.name || 'Unknown'}{' '}
              <span className="muted">@{row.username || '—'}</span>
            </strong>
            <span className="muted">
              {row.chapter}
              {row.province ? ` · ${row.province}` : ''}
              {row.initiationYear ? ` · ${row.initiationYear}` : ''} · {row.tier}
              {row.wasActivated ? ' · was activated' : ''}
            </span>
            <span className="muted">
              Deleted {row.deletedAt ? new Date(row.deletedAt).toLocaleString() : '—'}
              {row.email ? ` · ${row.email}` : ''}
            </span>
          </div>
        ))}
      </section>

      <div className="admin-split">
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>By initiation year</h3>
          {byYear.slice(0, 12).map((row) => (
            <div key={row.key} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{row.key}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </section>
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>By city</h3>
          {byCity.slice(0, 12).map((row) => (
            <div key={row.key} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{row.key}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </section>
        <section className="panel stack">
          <h3 style={{ margin: 0 }}>By province</h3>
          <p className="muted" style={{ margin: 0 }}>
            Optional field — shows Unknown until members add province on profile.
          </p>
          {byProvince.slice(0, 12).map((row) => (
            <div key={row.key} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{row.key}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
