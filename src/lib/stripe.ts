import { httpsCallable } from 'firebase/functions';
import app, { auth, getFirebaseFunctions } from './firebase';

export const BASIC_PRICE_CENTS = 999;
export const BASIC_PRICE_LABEL = '$9.99';

type CheckoutResponse = {
  url: string;
  sessionId: string;
};

/**
 * Starts Stripe Checkout for Basic ($9.99 one-time).
 * Requires Firebase Auth + deployed `createCheckoutSession` Cloud Function.
 */
export async function startBasicCheckout(): Promise<void> {
  if (!app || !auth?.currentUser) {
    throw new Error('Sign in before purchasing.');
  }

  const functions = getFirebaseFunctions();
  if (!functions) {
    throw new Error('Payments are not configured yet.');
  }

  const createCheckoutSession = httpsCallable<
    { successPath?: string; cancelPath?: string; origin?: string },
    CheckoutResponse
  >(functions, 'createCheckoutSession');

  const result = await createCheckoutSession({
    successPath: '/upgrade/success',
    cancelPath: '/pricing',
    origin: window.location.origin,
  });

  const url = result.data?.url;
  if (!url) {
    throw new Error('Checkout session did not return a URL.');
  }

  window.location.assign(url);
}
