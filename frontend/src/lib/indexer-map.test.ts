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
    expect(
      mapIndexerPath(
        "/api/v2/tokens/0xeCe5cA8bf9220718E5727754026757512212cb3c/holders?limit=50"
      )
    ).toBe(
      "/v1/tokens/0xeCe5cA8bf9220718E5727754026757512212cb3c/holders?limit=50"
    );
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

  it("maps Arcscan holders to Blockscout value/hash and keeps holder_count", () => {
    const out = normalizeIndexerBody(
      "/v1/tokens/0xece5ca8bf9220718e5727754026757512212cb3c/holders",
      {
        items: [
          {
            address: {
              address: "0x000000000000000000000000000000000000dead",
            },
            balance: { raw: "63434308434603159736402356" },
            share: "0.0634",
            value: {
              usd: "1113671",
              price: { depth_usdc: "323233.99516" },
            },
          },
        ],
        holder_count: 19846,
        page: { next: "cur", has_more: true },
      }
    ) as {
      items: Array<{
        address: { hash: string };
        value: string;
        share: string;
        liquidity_usd: string;
      }>;
      holders_count: number;
      next_page_params: { cursor: string };
    };
    expect(out.holders_count).toBe(19846);
    expect(out.items[0].address.hash).toBe(
      "0x000000000000000000000000000000000000dead"
    );
    expect(out.items[0].value).toBe("63434308434603159736402356");
    expect(out.items[0].value).not.toBe("1113671");
    expect(out.items[0].liquidity_usd).toBe("323233.99516");
    expect(out.next_page_params.cursor).toBe("cur");
  });

  it("maps token holder_count and contract.verified", () => {
    const out = normalizeIndexerBody(
      "/v1/tokens/0xece5ca8bf9220718e5727754026757512212cb3c",
      {
        token: { name: "Argus", symbol: "ARGUS", decimals: 18, standard: "erc20" },
        holders: 19845,
        contract: { verified: false },
        total_supply: { raw: "1000000000000000000000000000" },
      }
    ) as {
      holders: number;
      holders_count: number;
      is_verified: boolean;
      total_supply: string;
    };
    expect(out.holders).toBe(19845);
    expect(out.holders_count).toBe(19845);
    expect(out.is_verified).toBe(false);
    expect(out.total_supply).toBe("1000000000000000000000000000");
  });
});
