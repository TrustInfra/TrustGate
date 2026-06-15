# TrustGate Discovery Integration (Phase 2b)

Trust signals for token discovery surfaces. You get the score, you decide how to
use it. None of this takes over your UI. Every piece is opt-in and you control
placement and styling.

There are two ways in: a React kit, or a single script tag.

---

## What you get back

One batch call scores a list of token addresses and returns one object per
address:

```
{
  address: "0x...",
  score: 71,              // raw score
  tier: "HIGH",           // BLOCKED | LOW | MEDIUM | HIGH | ELITE | VERIFIED
  confidence: 82,         // number or label like "low"
  flags: ["COORDINATED_BUY"],
  state: "graduated"      // "graduated" or "mining"
}
```

Notes:
- ELITE and VERIFIED show tier only, no number.
- LOW and BLOCKED are meant to be deprioritized, marked not hidden.
- A `mining` token has no liquidity pool yet, so its score and tier describe the
  deployer wallet, not the token. Show it as deployer trust, clearly labeled.

---

## Option A: React kit

Import the components and the client. Place the badge wherever your card already
puts things.

```tsx
import { scoreBatch } from "@/lib/discovery/client";
import { TrustBadge } from "@/lib/discovery/TrustBadge";
import { TrustFlags } from "@/lib/discovery/TrustFlags";

const scores = await scoreBatch(addresses); // one call for the whole list

// in your row, your layout, your call:
<TrustBadge score={score} />
<TrustFlags flags={score.flags} size="sm" />
```

`TrustBadge` defaults to a compact mark, a tiny tier-colored "{score} {SHORT}"
(like a small yellow "58 MID") that tucks into a dense row without disturbing it.
For a detail view you can pass `variant="full"` for the larger labeled pill.

`TrustBadge` handles both states on its own: graduated tokens get the normal
badge, mining tokens get the deployer-trust treatment. You do not branch.

### Optional: order by trust

If, and only if, you want your list ranked by trust, call the helper on your own
data. It is pure, it never mutates your array, and it is never applied unless you
call it.

```tsx
import { reorderByTrust } from "@/lib/discovery/reorder";

const ordered = reorderByTrust(myItems, (item) => item.address, scores);
```

Higher tiers rise, LOW and BLOCKED sink to the bottom but stay, unscored sinks
below those. Your list, your choice.

---

## Option B: script tag

For pages without a framework. Add the script once, then mark each badge slot
with the token address. The script collects every slot, makes one batch call,
and fills them in.

```html
<script src="https://www.trustgated.xyz/widget-discovery.js"></script>

<!-- anywhere in your markup, placed by you -->
<span data-trustgate-badge="0xTOKENADDRESS"></span>
```

The widget shows the compact badge alone by default. Flags are off so nothing
widens your rows. To turn flags on, add `data-trustgate-flags="on"` to the
`<script>` tag (all slots) or to a single slot.

This is additive and does not interfere with the existing single-token
`widget.js`. You can use either, or both on different pages.

---

## The principle

The trust-ordered outcome happens because you choose to order by the score, not
because we force it. We provide the signal. The interface stays yours.
