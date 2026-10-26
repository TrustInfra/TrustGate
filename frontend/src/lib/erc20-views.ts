/**
 * Decide whether three eth_call results are an ERC-20.
 * Used when the indexer did not label the contract. A match is decimals
 * in 0..36, a short printable symbol, and a 32-byte totalSupply word.
 */

function hexBody(hex: string): string | null {
  const body = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (body.length === 0 || body.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(body)) return null;
  return body.toLowerCase();
}

function word(body: string, index: number): string | null {
  const start = index * 64;
  if (body.length < start + 64) return null;
  return body.slice(start, start + 64);
}

/** ABI uint256. Rejects words longer than 32 bytes. */
export function decodeAbiUint(hex: string | null | undefined): bigint | null {
  if (!hex || typeof hex !== "string") return null;
  const body = hexBody(hex);
  if (!body || body.length > 64) return null;
  try {
    return BigInt(`0x${body}`);
  } catch {
    return null;
  }
}

function bytesToPrintable(bytes: string): string | null {
  if (bytes.length === 0 || bytes.length > 64) return null;
  let text = "";
  for (let i = 0; i < bytes.length; i += 2) {
    const code = Number.parseInt(bytes.slice(i, i + 2), 16);
    if (!Number.isFinite(code) || code < 0x20 || code > 0x7e) return null;
    text += String.fromCharCode(code);
  }
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return null;
  return trimmed;
}

/**
 * ABI dynamic string, or a bytes32 symbol (some tokens return the latter).
 * Length is capped at 32 bytes so a hostile return cannot allocate.
 */
export function decodeAbiString(hex: string | null | undefined): string | null {
  if (!hex || typeof hex !== "string") return null;
  const body = hexBody(hex);
  if (!body) return null;

  if (body.length === 64) {
    const end = body.replace(/00+$/, "");
    return bytesToPrintable(end);
  }

  if (body.length < 192 || body.length > 64 * 4) return null;
  const offsetWord = word(body, 0);
  const lengthWord = word(body, 1);
  if (!offsetWord || !lengthWord) return null;
  let offset: bigint;
  let length: bigint;
  try {
    offset = BigInt(`0x${offsetWord}`);
    length = BigInt(`0x${lengthWord}`);
  } catch {
    return null;
  }
  if (offset !== 32n || length < 1n || length > 32n) return null;
  const data = body.slice(128, 128 + Number(length) * 2);
  if (data.length !== Number(length) * 2) return null;
  return bytesToPrintable(data);
}

export function erc20ViewResultsMatch(
  decimalsHex: string | null | undefined,
  symbolHex: string | null | undefined,
  supplyHex: string | null | undefined
): boolean {
  if (!decimalsHex || !supplyHex) return false;
  const decimalsBody = hexBody(decimalsHex);
  const supplyBody = hexBody(supplyHex);
  if (!decimalsBody || decimalsBody.length !== 64) return false;
  if (!supplyBody || supplyBody.length !== 64) return false;
  const decimals = decodeAbiUint(decimalsHex);
  if (decimals === null || decimals > 36n) return false;
  if (decodeAbiUint(supplyHex) === null) return false;
  const symbol = decodeAbiString(symbolHex);
  return symbol !== null;
}
