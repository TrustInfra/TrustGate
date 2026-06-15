// Client-safe verified-issuer check for the discovery kit.
//
// We cannot import from lib/contract-scoring.ts here: that module is marked
// `import "server-only"`, so pulling it into a client component (the /discovery
// page, the batch client) fails the Next build. This is a small client-safe
// copy of the same four Circle addresses, kept in sync with the VERIFIED_ISSUERS
// set in contract-scoring.ts.
//
// If the Circle allowlist ever changes there, update it here too. These are the
// only two places the addresses live.

const VERIFIED_ISSUERS = new Set<string>([
  "0x3600000000000000000000000000000000000000", // USDC
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a", // EURC
  "0xe9185f0c5f296ed1797aae4238d26ccabeadb86c", // USYC
  "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf", // cirBTC
]);

export function isVerifiedIssuer(address: string): boolean {
  return VERIFIED_ISSUERS.has(address.toLowerCase());
}
