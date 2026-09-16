export interface LiveToken {
  name: string;
  symbol: string;
  address: `0x${string}`;
}

// Arc Mainnet ERC-20s shown on /discovery. Official Circle issuers only until
// more mainnet tokens are confirmed. Launch order is not trust order.
export const LIVE_TOKENS: LiveToken[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: "0x3600000000000000000000000000000000000000",
  },
  {
    name: "Euro Coin",
    symbol: "EURC",
    address: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
  },
  {
    name: "USYC",
    symbol: "USYC",
    address: "0x8a5D989Bbb96929F689B0200f435f53dA42bF490",
  },
];
