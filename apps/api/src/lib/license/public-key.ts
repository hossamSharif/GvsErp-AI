/**
 * Public half of the license signing key. License keys are verified against it.
 *
 * !!! This is the TEST key. Its private half is committed in
 * apps/api/tests/fixtures/license-test-private.pem, so anyone could issue
 * licenses for a build that embeds it. Before the first real client:
 *   1. On your own PC: node scripts/license/keygen.mjs --out <folder outside the repo>
 *   2. Paste the printed public key below and set IS_TEST_KEY = false.
 * Release image builds (Phase 4 CI) refuse to run while IS_TEST_KEY is true.
 */

export const IS_TEST_KEY = true;

export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAaf33gsJnibSoS05Z2C7YNSWRkTni7BlgJjFccem479g=
-----END PUBLIC KEY-----`;
