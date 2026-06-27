# TrustGate — Session Log

**Last updated:** June 27, 2026

---

## Shipped

- Homepage hero: two-column layout, `HeroVisual` with brand logo, HUD frame
- Stat bar: 3 primary metrics + compact Transactions / Unique Wallets row underneath
- Trust model v1 docs: trust vs reputation vs risk, agent definition, philosophy line
- API: `scoringVersion` + `limitations` on wallet oracle responses
- OG image regenerated from `logo.png`; cache-bust `?v=2` in layout metadata
- `frontend/scripts/generate-og-image.mjs` for future OG refreshes

## Next

1. Deploy to Vercel — OG image + hero visual go live after push
2. Re-share `trustgated.xyz` in Discord to refresh cached preview
3. Optional v1.1: `scoreStability`, direction drivers, trust snapshots (needs score history store)

## Notes

- `frontend/.env.local` is gitignored — scoring secrets stay local / Vercel dashboard only
- `mcps/` and `terminals/` are gitignored (harness noise, not project code)