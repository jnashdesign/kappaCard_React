import {
  doc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from './firebase';
import { getFirebaseFunctions } from './firebase';

export const FOUNDING_LIMIT_DEFAULT = 100;

export type FoundingPromoStatus = {
  limit: number;
  claimed: number;
  remaining: number;
  enabled: boolean;
};

export type ClaimFoundingResult = FoundingPromoStatus & {
  status: 'granted' | 'already' | 'exhausted' | 'excluded';
  foundingSlot?: number;
  inauguralSlot?: number;
};

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}

/** Live countdown for Pricing / Landing. */
export function subscribeFoundingPromo(
  onChange: (status: FoundingPromoStatus | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const database = requireDb();
  return onSnapshot(
    doc(database, 'config', 'foundingPromo'),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data() || {};
      const limit =
        typeof data.limit === 'number' ? data.limit : FOUNDING_LIMIT_DEFAULT;
      const claimed = typeof data.claimed === 'number' ? data.claimed : 0;
      const enabled = data.enabled !== false;
      onChange({
        limit,
        claimed,
        enabled,
        remaining: enabled ? Math.max(0, limit - claimed) : 0,
      });
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
      onChange(null);
    }
  );
}

/** Ensures promo doc exists (seeds claimed from current members) and returns status. */
export async function fetchFoundingPromoStatus(): Promise<FoundingPromoStatus> {
  const functions = getFirebaseFunctions();
  if (!functions) {
    return {
      limit: FOUNDING_LIMIT_DEFAULT,
      claimed: 0,
      remaining: FOUNDING_LIMIT_DEFAULT,
      enabled: true,
    };
  }
  const callable = httpsCallable<Record<string, never>, FoundingPromoStatus>(
    functions,
    'getFoundingPromoStatus'
  );
  const result = await callable({});
  return result.data;
}

/** Claim one free Inaugural Basic unlock for the signed-in free member. */
export async function claimFoundingBasic(): Promise<ClaimFoundingResult> {
  const functions = getFirebaseFunctions();
  if (!functions) {
    throw new Error('Cloud Functions are not configured.');
  }
  const callable = httpsCallable<Record<string, never>, ClaimFoundingResult>(
    functions,
    'claimFoundingBasic'
  );
  const result = await callable({});
  return result.data;
}

/** Admin: exclude (or re-include) a member from the Inaugural 100 counter + badge. */
export async function setInauguralExclusion(
  userId: string,
  exclude: boolean
): Promise<FoundingPromoStatus & { status: string; userId: string }> {
  const functions = getFirebaseFunctions();
  if (!functions) {
    throw new Error('Cloud Functions are not configured.');
  }
  const callable = httpsCallable<
    { userId: string; exclude: boolean },
    FoundingPromoStatus & { status: string; userId: string }
  >(functions, 'setInauguralExclusion');
  const result = await callable({ userId, exclude });
  return result.data;
}

/** Public badge eligibility. */
export function isInauguralMember(user: {
  inauguralMember?: boolean;
  foundingMember?: boolean;
  excludeFromInaugural?: boolean;
}): boolean {
  if (user.excludeFromInaugural) return false;
  return Boolean(user.inauguralMember || user.foundingMember);
}

export function inauguralSlotOf(user: {
  inauguralSlot?: number;
  foundingSlot?: number;
}): number | undefined {
  if (typeof user.inauguralSlot === 'number') return user.inauguralSlot;
  if (typeof user.foundingSlot === 'number') return user.foundingSlot;
  return undefined;
}
