# TrustGate Site Copy Updates
# Save this file to C:\Users\RIKI\TrustGate\docs\site-copy-updates.md
# Then tell Claude Code: "Read CLAUDE.md then read docs\site-copy-updates.md and follow all instructions exactly."

---

## INSTRUCTIONS FOR CLAUDE CODE

Read CLAUDE.md before doing anything.

You are updating site copy across multiple pages to anchor on the new positioning language. Do NOT change any design, layout, structure, or functionality. Text content only.

Do not run any git commands.
Confirm every file change on the dev server before stopping.

---

## CHANGE 1 — Homepage (frontend/src/app/page.tsx)

Find the current homepage hero section. Update the subheading or description text that currently describes TrustGate as a payment or trust scoring product.

Replace with:
"TrustGate is behavioral state infrastructure for onchain systems. Score any wallet, token, or contract by what it has actually done — not who it claims to be."

If there is a secondary description line, replace it with:
"Trust builds slowly. Trust collapses quickly. TrustGate makes that asymmetry operational."

---

## CHANGE 2 — Docs Overview page (frontend/src/app/docs/page.tsx or wherever the overview lives)

Find the "What it is" section body text.

Replace with:
"TrustGate is behavioral state infrastructure for wallets and contracts on Arc. Score any address by onchain history, deployment credibility, holder behavior, and coordination signals. Trust scores route payments, gate protocol access, and surface risk — automatically."

Find the "The problem" section body text.

Replace with:
"Most trust systems analyze identity or static reputation. Web3 protocols, DEXs, and AI agents need something different: a system that models behavioral state over time — what an address has actually done, how that behavior has changed, and whether coordination patterns signal risk. TrustGate is that system."

---

## CHANGE 3 — Privacy section in Docs Overview

Find any text that says something like "No KYC. No biometric identity. No social graph deanonymization." or similar list of things TrustGate does not do.

Replace the entire privacy paragraph with:
"TrustGate models behavioral reputation, not personal identity. It cannot tell you who owns a wallet. It can tell you what that wallet has done, how its behavior has changed over time, and whether its patterns signal risk. This distinction matters legally and operationally — behavioral reputation infrastructure is a fundamentally different category from identity systems."

---

## CHANGE 4 — Developer Docs page (frontend/src/app/docs/developer/page.tsx)

Find the opening description line at the top of the page that currently reads:
"TrustGate is a behavioral trust oracle for wallets and contracts on Arc."

Replace with:
"TrustGate is behavioral state infrastructure for onchain systems. Query any address and receive a behavioral trust score, tier, confidence level, and coordination flags."

---

## CHANGE 5 — Roadmap page (frontend/src/app/roadmap/page.tsx)

Find the page subtitle that currently reads:
"Building the trust layer for Web3. One oracle. Every chain. Every use case."

Replace with:
"Behavioral state infrastructure for autonomous onchain systems. Trust builds slowly. Trust collapses quickly."

---

## CHANGE 6 — Add differentiation line to Docs Overview

In the Docs Overview page, after the "What it is" section, add a new short paragraph:

"Most trust systems analyze identity or static reputation. TrustGate models behavioral state over time. That distinction is the product."

---

## AFTER ALL CHANGES

Verify each page renders correctly on the dev server.
Confirm the new positioning phrases appear in the rendered HTML.
Report which files were changed.
Do not run any git commands.
