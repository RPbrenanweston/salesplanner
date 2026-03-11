/**
 * @crumb
 * @id frontend-lib-oauth-csrf
 * @area Auth/OAuth/Security
 * @intent CSRF protection for OAuth flows — generate, store, and validate nonces to prevent state forgery attacks
 * @responsibilities Generate cryptographic nonces, store in sessionStorage with provider key, validate nonces on callback
 * @contracts generateOAuthNonce(provider) -> string; validateOAuthNonce(provider, nonce) -> boolean
 */

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
