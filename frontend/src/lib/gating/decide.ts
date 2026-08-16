/**
 * Combine ladder + attestation + version checks into a single allow bit.
 * Explicit flags only — never regex-match reason strings (that fail-opens).
 */
export function computeGatingAllowed(opts: {
  walletAllowed: boolean;
  /** undefined = token was not part of the check */
  tokenAllowed?: boolean;
  attestationValid: boolean;
  scoringVersionAllowed: boolean;
}): boolean {
  return (
    opts.walletAllowed &&
    opts.tokenAllowed !== false &&
    opts.attestationValid &&
    opts.scoringVersionAllowed
  );
}
