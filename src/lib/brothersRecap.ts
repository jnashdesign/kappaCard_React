import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from './firebase';

/**
 * QA: send an end-of-day Brothers recap for the signed-in user immediately
 * (ignores 8pm window; still requires today’s QR meets + preference on).
 */
export async function requestBrothersRecapNow(): Promise<{
  status: 'sent' | 'skipped';
  to?: string | null;
}> {
  const functions = getFirebaseFunctions();
  if (!functions) {
    throw new Error('Cloud Functions are not configured.');
  }

  const callable = httpsCallable<
    Record<string, never>,
    { status: string; to?: string | null }
  >(functions, 'sendBrothersRecapNow');
  const result = await callable({});
  const status = result.data?.status;
  if (status === 'sent' || status === 'skipped') {
    return { status, to: result.data?.to ?? null };
  }
  throw new Error('Unexpected recap response.');
}
