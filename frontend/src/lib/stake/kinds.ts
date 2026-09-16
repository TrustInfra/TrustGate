export const SUBJECT_KINDS = [
  "x",
  "linkedin",
  "github",
  "discord",
  "telegram",
  "token",
  "wallet",
  "website",
  "uri",
  "claim",
] as const;

export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export function isSubjectKind(value: string): value is SubjectKind {
  return (SUBJECT_KINDS as readonly string[]).includes(value);
}
