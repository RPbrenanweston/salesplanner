// @crumb frontend-lib-oauth-csrf
// Auth/OAuth/Security | nonce_generation | session_storage | nonce_validation
// why: CSRF protection for OAuth flows — generate, store, and validate nonces to prevent state forgery attacks
// in:provider string,crypto.getRandomValues out:nonce string,validation boolean err:sessionStorage unavailable;nonce mismatch on cross-origin popup
// hazard: sessionStorage is per-origin — popup OAuth flows on different origin cannot access stored nonce
// hazard: Single-use nonce removal means retry after validation failure requires new OAuth flow
// edge:frontend/src/hooks/useOAuthCallback.ts -> SERVES

const STORAGE_PREFIX = 'oauth_csrf_nonce_';

/** Generate a cryptographic nonce for CSRF protection and store it in sessionStorage */
export function generateOAuthNonce(provider: string): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const nonce = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );

  sessionStorage.setItem(`${STORAGE_PREFIX}${provider}`, nonce);
  return nonce;
}

/** Validate a nonce from the OAuth callback against the stored nonce.
 *  Removes the stored nonce after validation (single-use). */
export function validateOAuthNonce(
  provider: string,
  nonce: string
): boolean {
  const storageKey = `${STORAGE_PREFIX}${provider}`;
  const storedNonce = sessionStorage.getItem(storageKey);

  // Clean up regardless of result (single-use)
  sessionStorage.removeItem(storageKey);

  if (!storedNonce || !nonce) {
    return false;
  }

  return storedNonce === nonce;
}
