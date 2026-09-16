// Client-safe verified-issuer check for the discovery kit.
//
// We cannot import from lib/contract-scoring.ts here: that module is marked
// `import "server-only"`. Keep this list in sync with VERIFIED_ISSUER_ADDRESSES
// in lib/chain.ts.

import { VERIFIED_ISSUER_ADDRESSES } from "../chain";

const VERIFIED_ISSUERS = new Set<string>(VERIFIED_ISSUER_ADDRESSES);

export function isVerifiedIssuer(address: string): boolean {
  return VERIFIED_ISSUERS.has(address.toLowerCase());
}
