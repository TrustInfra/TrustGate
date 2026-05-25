# TrustGate

A behavioral trust scoring primitive for the Arc testnet. TrustGate scores any
wallet, token, or contract based on its onchain activity, returning a normalized
trust score and a discrete tier other applications can gate on.

Scoring is derived entirely from Arcscan onchain data, using the following
signals:

- **Transaction count** — total onchain activity volume.
- **Contract deployments** — number of contracts the address has deployed.
- **Wallet age** — time elapsed since the address's first onchain activity.
- **Interaction patterns** — the diversity and structure of an address's
  interactions with other accounts and contracts.
- **Bot detection signals** — heuristics that flag automated or sybil-like
  behavior.

Live at [trustgated.xyz](https://trustgated.xyz).

---

## Drop-in Widget

The widget is the primary primitive. Embedding a live trust score is one script
tag and one data attribute — no build step, no SDK, no API key.

```html
<script src="https://trustgated.xyz/widget.js"
   data-address="0xYourAddress">
</script>
```

The script reads `data-address`, fetches the score, and renders the badge inline
at the script's location.

### Backing endpoint

```
GET /api/widget/score/[address]
```

- Open CORS — callable from any origin, including directly from the browser.
- Rate limit: 60 requests per minute per client.
- No API key required.

Use the widget for a rendered badge, or call the endpoint directly to integrate
the raw score into your own UI.

---

## Contracts on Arc Testnet

Chain ID `5042002`. Block explorer: [testnet.arcscan.app](https://testnet.arcscan.app).

| Contract | Address | Explorer |
|---|---|---|
| TrustScoringPlaintext | `0xEb979Dc25396ba4be6cEA41EAfEa894C55772246` | [View on Arcscan](https://testnet.arcscan.app/address/0xEb979Dc25396ba4be6cEA41EAfEa894C55772246) |
| AgentRegistry | `0x73d3cf7f2734C334927f991fe87D06d595d398b4` | [View on Arcscan](https://testnet.arcscan.app/address/0x73d3cf7f2734C334927f991fe87D06d595d398b4) |
| TrustGate | `0x52E17bC482d00776d73811680CbA9914e83E33CC` | [View on Arcscan](https://testnet.arcscan.app/address/0x52E17bC482d00776d73811680CbA9914e83E33CC) |

All three are verified on Arcscan; source for each lives in `contracts/`.

---

## Tier System

Scores are bucketed into four tiers:

| Tier | Meaning |
|---|---|
| `LOW` | Minimal or unproven onchain history |
| `MEDIUM` | Established, moderate activity |
| `HIGH` | Strong, consistent onchain reputation |
| `HIGH_ELITE` | Top tier — requires 10+ contract deployments |

`HIGH_ELITE` is gated on deployment count: an address must have deployed at least
10 contracts to qualify, regardless of other signals.

Bot detection is enforced. Wallets flagged as automated or sybil-like are capped
at a maximum score of 59, keeping them below the `HIGH` threshold.

---

## Token Shield

Token Shield extends scoring to contracts and tokens:

- **ERC-20 contracts** are scored via the oracle, which pulls and evaluates token
  metadata and onchain behavior.
- **Non-ERC-20 contracts** are scored locally with no payment required — scoring
  runs without invoking the paid oracle path.

---

## Repo Structure

```
frontend/     Next.js app — site, dashboard, widget, and API routes
contracts/    Solidity sources for the Arc testnet deployment
oracle/       Standalone oracle service for ERC-20 / token scoring
deploy/       Deployment scripts
deployments/  Recorded deployment addresses and artifacts
test/         Contract tests
```

### `frontend/`

The Next.js application. It serves the public site, the scoring dashboard, the
embeddable `widget.js`, and the API routes that back the widget and the broader
product — including `/api/widget/score/[address]`, `/api/arc-score/[address]`,
and the oracle proxy routes under `/api/oracle`.

### `contracts/`

The Solidity sources deployed to Arc testnet:

- `TrustScoringPlaintext.sol` — onchain trust scores in plaintext form.
- `AgentRegistry.sol` — registry of scored agents and addresses.
- `TrustGate.sol` — the gating contract that consumes scores.

Interfaces (`ITrustScoring.sol`, `IAgentRegistry.sol`) and contract tests are
included alongside the implementations.

---

## License

MIT — see [LICENSE](LICENSE).
