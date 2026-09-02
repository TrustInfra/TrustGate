export interface LiveToken {
  name: string;
  symbol: string;
  address: `0x${string}`;
}

// Arc Testnet ERC-20s shown on /discovery. Launch order is not trust order.
// Three entries share ticker USDC: the Circle issuer and two other contracts
// that reuse the ticker. Addresses from testnet.arcscan.app, EIP-55 checksummed.
export const LIVE_TOKENS: LiveToken[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: "0xd5413b391B3790CBEF25d9655d82a2ad99cD8b31",
  },
  {
    name: "Euro Coin",
    symbol: "EURC",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
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
  {
    name: "Circle Bitcoin",
    symbol: "CircBTC",
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
  },
  {
    name: "USYC",
    symbol: "USYC",
    address: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
  },
];
