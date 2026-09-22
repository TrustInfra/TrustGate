import { describe, expect, it } from "vitest";
import { mapIndexerPath, normalizeIndexerBody } from "./indexer-map";

describe("mapIndexerPath", () => {
  it("maps Blockscout address txs onto Arcscan v1", () => {
    expect(
      mapIndexerPath(
        "/api/v2/addresses/0x3600000000000000000000000000000000000000/transactions?limit=50"
      )
    ).toBe(
      "/v1/address/0x3600000000000000000000000000000000000000/txs?limit=50"
    );
  });

  it("forwards cursor pagination", () => {
    expect(
      mapIndexerPath(
        "/api/v2/addresses/0x3600000000000000000000000000000000000000/transactions?cursor=abc"
      )
    ).toBe(
      "/v1/address/0x3600000000000000000000000000000000000000/txs?cursor=abc"
    );
  });

  it("maps counters and token metadata", () => {
    expect(
      mapIndexerPath(
        "/api/v2/addresses/0x3600000000000000000000000000000000000000/counters"
      )
    ).toBe("/v1/address/0x3600000000000000000000000000000000000000");
    expect(
      mapIndexerPath(
        "/api/v2/tokens/0x3600000000000000000000000000000000000000"
      )
    ).toBe("/v1/tokens/0x3600000000000000000000000000000000000000");
  });
});

describe("normalizeIndexerBody", () => {
  it("marks Arcscan v1 contracts as is_contract", () => {
    const out = normalizeIndexerBody(
      "/v1/address/0x7c7489163b1060333e71229bb7a9f8cb7094a7a9",
      {
        address: "0x7c7489163b1060333e71229bb7a9f8cb7094a7a9",
        type: "contract",
        token: { standard: "erc20", symbol: "FOCI" },
        verified: true,
        creation: { from: { address: "0xabc" } },
      }
    ) as { is_contract: boolean; token_type: string; creator_address_hash: string };
    expect(out.is_contract).toBe(true);
    expect(out.token_type).toBe("ERC-20");
    expect(out.creator_address_hash).toBe("0xabc");
  });

  it("flattens txs to Blockscout-like items", () => {
    const out = normalizeIndexerBody(
      "/v1/address/0x3600000000000000000000000000000000000000/txs",
      {
      items: [
        {
          timestamp: 1789549144,
          from: { address: "0x11", is_contract: false },
          to: { address: "0x22", is_contract: true },
          created_contract: null,
          method: { selector: "0x095ea7b3", name: "approve", is_creation: false },
          value: { raw: "0" },
          status: "success",
        },
      ],
      page: { next: "cur", has_more: true },
    }) as {
      items: Array<{
        from: { hash: string };
        to: { hash: string; is_contract: boolean };
        method: string;
        transaction_types: string[];
        timestamp: string;
      }>;
      next_page_params: { cursor: string };
    };
    expect(out.items[0].from.hash).toBe("0x11");
    expect(out.items[0].to.is_contract).toBe(true);
    expect(out.items[0].method).toBe("approve");
    expect(out.items[0].transaction_types).toContain("contract_call");
    expect(out.items[0].timestamp).toContain("T");
    expect(out.next_page_params.cursor).toBe("cur");
  });
});
