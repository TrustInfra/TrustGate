export interface LiveToken {
  name: string;
  symbol: string;
  address: `0x${string}`;
}

// Arc Testnet ERC-20s shown on /discovery. Launch order is not trust order.
// Official Circle USDC stays only because two other contracts reuse the
// ticker — that is the ranking case. EURC, CircBTC, and USYC are omitted;
// they are already known issuers and have no clones in this list.
export const LIVE_TOKENS: LiveToken[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: "0xd5413b391B3790CBEF25d9655d82a2ad99cD8b31",
  },
  {
    name: "USD Coin",
    symbol: "USDC",
    address: "0x3600000000000000000000000000000000000000",
  },
  {
    name: "Swaparc Token",
    symbol: "SWPRC",
    address: "0xBE7477BF91526FC9988C8f33e91B6db687119D45",
  },
  {
    name: "USD Coin",
    symbol: "USDC",
    address: "0x634b984958e56a5A57dB2CCfB11c48404B86f507",
  },
];
