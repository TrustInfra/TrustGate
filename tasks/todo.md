# TrustGate — Session Log

**Last updated:** July 3, 2026

---

## Shipped

- Homepage hero: two-column layout, `HeroVisual` with brand logo, HUD frame
- Stat bar: 3 primary metrics + compact Transactions / Unique Wallets row underneath
- Trust model v1 docs: trust vs reputation vs risk, agent definition, philosophy line
- API: `scoringVersion` + `limitations` on wallet oracle responses
- OG image regenerated from `logo.png`; cache-bust `?v=2` in layout metadata
- `frontend/scripts/generate-og-image.mjs` for future OG refreshes
- **Trust Source toggle (platform-only):** Behavioral vs Graph on `/oracle` and `/token-shield`
  - `TrustSourceShell` + toggle + graph view components
  - Real graph trust via `/api/graph-trust` proxy to Intuition MCP (`mcp-trust.intuition.box`)
  - `USE_MOCK = false` in `frontend/src/lib/graph-trust/index.ts` (mock still in `mock.ts` for local dev)
  - Global composite fallback (`explain_trust_score`) when no personalized path; `resultType` + `explainer` on GraphTrust

## Next

1. Deploy to Vercel — graph-trust proxy + trust source toggle go live after push
2. Optional: set `GRAPH_TRUST_ANCHOR_ADDRESSES` in Vercel env for personalized anchor set
3. Optional v1.1: `scoreStability`, direction drivers, trust snapshots (needs score history store)

## Notes

- `frontend/.env.local` is gitignored — scoring secrets stay local / Vercel dashboard only
- `mcps/` and `terminals/` are gitignored (harness noise, not project code)