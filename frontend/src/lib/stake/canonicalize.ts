import { keccak256, toBytes } from "viem";
import { CHAIN_ID } from "../chain";
import { isSubjectKind, type SubjectKind } from "./kinds";

export interface CanonicalSubject {
  kind: SubjectKind;
  canonical: string;
  display: string;
  input: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HANDLE_RE = /^[A-Za-z0-9_.]{1,64}$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DISCORD_SNOWFLAKE_RE = /^\d{5,32}$/;

function strip(input: string): string {
  return input.trim();
}

function stripAt(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

function tryUrl(raw: string): URL | null {
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)
      ? raw
      : `https://${raw}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^www\./i, "").toLowerCase();
}

function pathParts(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

function asAddress(raw: string): `0x${string}` | null {
  const s = strip(raw);
  if (!ADDRESS_RE.test(s)) return null;
  return s.toLowerCase() as `0x${string}`;
}

function websiteOrigin(url: URL): string {
  const host = url.hostname.toLowerCase();
  const protocol = url.protocol === "http:" ? "http:" : "https:";
  const port = url.port ? `:${url.port}` : "";
  return `${protocol}//${host}${port}`;
}

function fromX(url: URL, parts: string[]): CanonicalSubject | null {
  const host = hostOf(url);
  if (host !== "x.com" && host !== "twitter.com") return null;
  const handle = stripAt(parts[0] ?? "");
  if (!HANDLE_RE.test(handle)) return null;
  const canonical = handle.toLowerCase();
  return {
    kind: "x",
    canonical,
    display: `@${canonical}`,
    input: url.toString(),
  };
}

function fromLinkedIn(url: URL, parts: string[]): CanonicalSubject | null {
  if (hostOf(url) !== "linkedin.com") return null;
  const kind = parts[0];
  const slug = (parts[1] ?? "").toLowerCase();
  if (!slug || !HANDLE_RE.test(slug.replace(/-/g, "_"))) return null;
  if (kind === "in") {
    return {
      kind: "linkedin",
      canonical: `in:${slug}`,
      display: `linkedin.com/in/${slug}`,
      input: url.toString(),
    };
  }
  if (kind === "company") {
    return {
      kind: "linkedin",
      canonical: `company:${slug}`,
      display: `linkedin.com/company/${slug}`,
      input: url.toString(),
    };
  }
  return null;
}

function fromGitHub(url: URL, parts: string[]): CanonicalSubject | null {
  if (hostOf(url) !== "github.com") return null;
  if (parts.length === 0) return null;
  const owner = parts[0].toLowerCase();
  if (!HANDLE_RE.test(owner.replace(/-/g, "_"))) return null;
  if (parts.length === 1) {
    return {
      kind: "github",
      canonical: owner,
      display: `github.com/${owner}`,
      input: url.toString(),
    };
  }
  const repo = parts[1].toLowerCase();
  return {
    kind: "github",
    canonical: `${owner}/${repo}`,
    display: `github.com/${owner}/${repo}`,
    input: url.toString(),
  };
}

function fromDiscord(url: URL, parts: string[]): CanonicalSubject | null {
  const host = hostOf(url);
  if (host === "discord.gg") {
    const code = (parts[0] ?? "").toLowerCase();
    if (!code) return null;
    return {
      kind: "discord",
      canonical: `invite:${code}`,
      display: `discord.gg/${code}`,
      input: url.toString(),
    };
  }
  if (host !== "discord.com") return null;
  if (parts[0] === "invite" && parts[1]) {
    const code = parts[1].toLowerCase();
    return {
      kind: "discord",
      canonical: `invite:${code}`,
      display: `discord.gg/${code}`,
      input: url.toString(),
    };
  }
  if (parts[0] === "users" && parts[1] && DISCORD_SNOWFLAKE_RE.test(parts[1])) {
    return {
      kind: "discord",
      canonical: `user:${parts[1]}`,
      display: `discord user ${parts[1]}`,
      input: url.toString(),
    };
  }
  if (
    (parts[0] === "channels" || parts[0] === "servers") &&
    parts[1] &&
    DISCORD_SNOWFLAKE_RE.test(parts[1])
  ) {
    return {
      kind: "discord",
      canonical: `server:${parts[1]}`,
      display: `discord server ${parts[1]}`,
      input: url.toString(),
    };
  }
  return null;
}

function fromTelegram(url: URL, parts: string[]): CanonicalSubject | null {
  const host = hostOf(url);
  if (host !== "t.me" && host !== "telegram.me") return null;
  const handle = stripAt(parts[0] ?? "").toLowerCase();
  if (!HANDLE_RE.test(handle)) return null;
  return {
    kind: "telegram",
    canonical: handle,
    display: `@${handle}`,
    input: url.toString(),
  };
}

function fromWebsite(url: URL): CanonicalSubject {
  const origin = websiteOrigin(url);
  return {
    kind: "website",
    canonical: origin,
    display: origin.replace(/^https:\/\//, ""),
    input: url.toString(),
  };
}

function walletCanonical(address: `0x${string}`): CanonicalSubject {
  return {
    kind: "wallet",
    canonical: `eip155:${CHAIN_ID}:${address}`,
    display: address,
    input: address,
  };
}

function tokenCanonical(address: `0x${string}`): CanonicalSubject {
  return {
    kind: "token",
    canonical: `eip155:${CHAIN_ID}/erc20:${address}`,
    display: address,
    input: address,
  };
}

function uriFallback(input: string): CanonicalSubject {
  const canonical = strip(input).toLowerCase();
  return {
    kind: "uri",
    canonical,
    display: strip(input),
    input,
  };
}

/**
 * Parse free text into a canonical stake subject.
 * `addressKind` lets the caller force 0x input to wallet vs token after
 * eth_getCode. Unknown input becomes `uri` so anything is stakeable.
 */
export function canonicalizeSubject(
  raw: string,
  options?: { addressKind?: "wallet" | "token"; kind?: SubjectKind }
): CanonicalSubject | null {
  const input = strip(raw);
  if (!input) return null;

  if (options?.kind && !isSubjectKind(options.kind)) return null;

  const addr = asAddress(input);
  if (addr) {
    if (options?.kind === "token" || options?.addressKind === "token") {
      return tokenCanonical(addr);
    }
    if (options?.kind === "wallet" || options?.addressKind === "wallet") {
      return walletCanonical(addr);
    }
    return walletCanonical(addr);
  }

  const url = tryUrl(input);
  if (url) {
    const parts = pathParts(url);
    const social =
      fromX(url, parts) ||
      fromLinkedIn(url, parts) ||
      fromGitHub(url, parts) ||
      fromDiscord(url, parts) ||
      fromTelegram(url, parts);
    if (social) {
      if (options?.kind && options.kind !== social.kind) {
        return { ...social, kind: options.kind };
      }
      return social;
    }
    if (url.hostname.includes(".")) {
      const site = fromWebsite(url);
      if (options?.kind && options.kind !== "website") {
        return { ...site, kind: options.kind };
      }
      return site;
    }
  }

  const noAt = stripAt(input);
  if (options?.kind === "x" && HANDLE_RE.test(noAt)) {
    const canonical = noAt.toLowerCase();
    return { kind: "x", canonical, display: `@${canonical}`, input };
  }
  if (options?.kind === "telegram" && HANDLE_RE.test(noAt)) {
    const canonical = noAt.toLowerCase();
    return { kind: "telegram", canonical, display: `@${canonical}`, input };
  }
  if (options?.kind === "github" && GITHUB_REPO_RE.test(noAt)) {
    const canonical = noAt.toLowerCase();
    return {
      kind: "github",
      canonical,
      display: `github.com/${canonical}`,
      input,
    };
  }
  if (options?.kind === "github" && HANDLE_RE.test(noAt.replace(/-/g, "_"))) {
    const canonical = noAt.toLowerCase();
    return {
      kind: "github",
      canonical,
      display: `github.com/${canonical}`,
      input,
    };
  }

  if (options?.kind === "uri" || !options?.kind) {
    return uriFallback(input);
  }

  const fallback = uriFallback(input);
  return { ...fallback, kind: options.kind };
}

/** Must match SubjectStake.subjectIdOf: keccak256(abi.encodePacked(kind, ":", canonical)). */
export function subjectId(kind: string, canonical: string): `0x${string}` {
  return keccak256(toBytes(`${kind}:${canonical}`));
}
