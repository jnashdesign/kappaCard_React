import type { AccountDeletion, InviteRecord, UserProfile } from '../types';
import { isProfileComplete } from './userStats';

export type PeriodGrain = 'day' | 'week' | 'month';

export type ChartMetric =
  | 'registrations'
  | 'invitesSent'
  | 'invitesClaimed'
  | 'profilesCompleted'
  | 'accountDeletions';

export interface PeriodBucket {
  key: string;
  label: string;
  startMs: number;
  count: number;
}

export interface FunnelCounts {
  registered: number;
  profileCompleted: number;
  cardDownloaded: number;
  publicCardViewed: number;
  contactDownloaded: number;
  activated: number;
}

export interface RecruiterRow {
  user: UserProfile;
  invitesSent: number;
  directSignups: number;
  conversion: number;
  totalDescendants: number;
  maxDepth: number;
}

export interface ChapterRow {
  chapter: string;
  members: number;
  activated: number;
  cardViews: number;
  contactDownloads: number;
  invitesSent: number;
  newThisWeek: number;
  newPrevWeek: number;
  weekOverWeek: number | null;
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function periodKey(ms: number, grain: PeriodGrain): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (grain === 'day') return `${y}-${m}-${day}`;
  if (grain === 'month') return `${y}-${m}`;
  // ISO week (UTC)
  const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodLabel(key: string, grain: PeriodGrain): string {
  if (grain === 'month') {
    const [y, m] = key.split('-');
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString(undefined, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  if (grain === 'week') return key;
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function parseTs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function buildPeriodSeries(
  timestamps: Array<string | undefined>,
  grain: PeriodGrain,
  periods: number
): PeriodBucket[] {
  const now = Date.now();
  const keys: string[] = [];
  for (let i = periods - 1; i >= 0; i -= 1) {
    let cursor = now;
    if (grain === 'day') cursor = now - i * 86400000;
    else if (grain === 'week') cursor = now - i * 7 * 86400000;
    else {
      const d = new Date(now);
      cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1);
    }
    keys.push(periodKey(cursor, grain));
  }
  const uniqueKeys = [...new Set(keys)];
  const counts = new Map(uniqueKeys.map((k) => [k, 0]));
  for (const ts of timestamps) {
    const ms = parseTs(ts);
    if (ms == null) continue;
    const key = periodKey(ms, grain);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return uniqueKeys.map((key) => ({
    key,
    label: periodLabel(key, grain),
    startMs: 0,
    count: counts.get(key) ?? 0,
  }));
}

export function metricTimestamps(
  users: UserProfile[],
  invites: InviteRecord[],
  metric: ChartMetric,
  deletions: AccountDeletion[] = []
): Array<string | undefined> {
  if (metric === 'registrations') return users.map((u) => u.createdAt);
  if (metric === 'profilesCompleted') return users.map((u) => u.profileCompletedAt);
  if (metric === 'accountDeletions') return deletions.map((d) => d.deletedAt);
  if (metric === 'invitesSent') {
    return invites
      .filter((inv) => !String(inv.id).endsWith('_SHARE') || (inv.useCount ?? 0) >= 0)
      .map((inv) => inv.createdAt);
  }
  // claimed: prefer users with invitedBy (signup time)
  return users.filter((u) => u.invitedBy).map((u) => u.createdAt);
}

export function computeFunnel(users: UserProfile[]): FunnelCounts {
  return {
    registered: users.length,
    profileCompleted: users.filter((u) => u.profileCompletedAt || isProfileComplete(u)).length,
    cardDownloaded: users.filter((u) => u.firstCardImageDownloadedAt || u.stats.cardImageDownloads > 0)
      .length,
    publicCardViewed: users.filter((u) => u.firstCardViewedAt || u.stats.cardViews > 0).length,
    contactDownloaded: users.filter(
      (u) => u.firstContactDownloadedAt || u.stats.contactDownloads > 0
    ).length,
    activated: users.filter((u) => u.activatedAt).length,
  };
}

export function computeInviteTrees(users: UserProfile[]): {
  childrenByParent: Map<string, string[]>;
  depthFrom: (userId: string) => number;
  descendantCount: (userId: string) => number;
} {
  const childrenByParent = new Map<string, string[]>();
  for (const user of users) {
    if (!user.invitedBy) continue;
    const list = childrenByParent.get(user.invitedBy) ?? [];
    list.push(user.id);
    childrenByParent.set(user.invitedBy, list);
  }

  const memoDesc = new Map<string, number>();
  const memoDepth = new Map<string, number>();

  function descendantCount(userId: string, stack = new Set<string>()): number {
    if (memoDesc.has(userId)) return memoDesc.get(userId)!;
    if (stack.has(userId)) return 0;
    stack.add(userId);
    const kids = childrenByParent.get(userId) ?? [];
    let total = kids.length;
    for (const kid of kids) total += descendantCount(kid, stack);
    stack.delete(userId);
    memoDesc.set(userId, total);
    return total;
  }

  function depthFrom(userId: string, stack = new Set<string>()): number {
    if (memoDepth.has(userId)) return memoDepth.get(userId)!;
    if (stack.has(userId)) return 0;
    stack.add(userId);
    const kids = childrenByParent.get(userId) ?? [];
    let max = 0;
    for (const kid of kids) max = Math.max(max, 1 + depthFrom(kid, stack));
    stack.delete(userId);
    memoDepth.set(userId, max);
    return max;
  }

  return { childrenByParent, depthFrom, descendantCount };
}

export function computeRecruiterLeaderboards(
  users: UserProfile[],
  invites: InviteRecord[]
): { recruiters: RecruiterRow[]; catalysts: RecruiterRow[] } {
  const byId = new Map(users.map((u) => [u.id, u]));
  const { childrenByParent, depthFrom, descendantCount } = computeInviteTrees(users);
  const sentBy = new Map<string, number>();
  for (const inv of invites) {
    // Count one-time invites + share codes as sent (1 each for share code creation)
    if (inv.multiUse) {
      sentBy.set(inv.inviterId, (sentBy.get(inv.inviterId) ?? 0) + 1);
    } else {
      sentBy.set(inv.inviterId, (sentBy.get(inv.inviterId) ?? 0) + 1);
    }
  }

  const rows: RecruiterRow[] = users.map((user) => {
    const directSignups = (childrenByParent.get(user.id) ?? []).length;
    const invitesSent = Math.max(sentBy.get(user.id) ?? 0, user.stats.invitesCreated, directSignups);
    return {
      user,
      invitesSent,
      directSignups,
      conversion: invitesSent > 0 ? directSignups / invitesSent : 0,
      totalDescendants: descendantCount(user.id),
      maxDepth: depthFrom(user.id),
    };
  });

  const recruiters = [...rows]
    .filter((r) => r.directSignups > 0 || r.invitesSent > 0)
    .sort((a, b) => b.directSignups - a.directSignups || b.invitesSent - a.invitesSent)
    .slice(0, 15);

  const catalysts = [...rows]
    .filter((r) => r.totalDescendants > r.directSignups)
    .sort(
      (a, b) =>
        b.totalDescendants - a.totalDescendants ||
        b.maxDepth - a.maxDepth ||
        b.directSignups - a.directSignups
    )
    .slice(0, 15);

  // Ensure catalysts include strong trees even if equal — also show top by descendants
  if (catalysts.length < 10) {
    const extra = [...rows]
      .filter((r) => r.totalDescendants > 0 && !catalysts.some((c) => c.user.id === r.user.id))
      .sort((a, b) => b.totalDescendants - a.totalDescendants)
      .slice(0, 10 - catalysts.length);
    catalysts.push(...extra);
  }

  void byId;
  return { recruiters, catalysts };
}

export function computeChapterRows(users: UserProfile[]): ChapterRow[] {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const twoWeeksAgo = now - 14 * 86400000;
  const map = new Map<string, ChapterRow>();

  for (const user of users) {
    const chapter = user.chapter?.trim() || 'Unknown';
    const row =
      map.get(chapter) ??
      ({
        chapter,
        members: 0,
        activated: 0,
        cardViews: 0,
        contactDownloads: 0,
        invitesSent: 0,
        newThisWeek: 0,
        newPrevWeek: 0,
        weekOverWeek: null,
      } satisfies ChapterRow);
    row.members += 1;
    if (user.activatedAt) row.activated += 1;
    row.cardViews += user.stats.cardViews;
    row.contactDownloads += user.stats.contactDownloads;
    row.invitesSent += user.stats.invitesCreated;
    const created = parseTs(user.createdAt);
    if (created != null) {
      if (created >= weekAgo) row.newThisWeek += 1;
      else if (created >= twoWeeksAgo) row.newPrevWeek += 1;
    }
    map.set(chapter, row);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      weekOverWeek:
        row.newPrevWeek === 0
          ? row.newThisWeek > 0
            ? null
            : 0
          : (row.newThisWeek - row.newPrevWeek) / row.newPrevWeek,
    }))
    .sort((a, b) => b.members - a.members);
}

export function groupCount(
  users: UserProfile[],
  keyFn: (u: UserProfile) => string
): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const user of users) {
    const key = keyFn(user) || '—';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function inviteConversion(users: UserProfile[], invites: InviteRecord[]): number {
  const oneTime = invites.filter((i) => !i.multiUse);
  const created = oneTime.length;
  if (created === 0) return 0;
  const claimed = oneTime.filter((i) => i.usedBy).length;
  // Also count multi-use redemptions approximately via users with invitedBy matching share inviters
  void users;
  return claimed / created;
}

export function startOfUtcDayMs(ms = Date.now()): number {
  return startOfUtcDay(ms);
}
