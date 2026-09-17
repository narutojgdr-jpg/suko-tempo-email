// Constantes publicas de pagamento — sem "use server" para funcionar em client components

export const WALLETS = {
  BEP20:    "0xFa5cB4f82A1DaD803A98afc6542072eCC5488d49",
  ETH:      "0xfa5cb4f82a1dad803a98afc6542072ecc5488d49",
  POLYGON:  "0xFa5cB4f82A1DaD803A98afc6542072eCC5488d49",
  ARBITRUM: "0xFa5cB4f82A1DaD803A98afc6542072eCC5488d49",
} as const

export type Network = keyof typeof WALLETS

export const NETWORK_COIN: Record<Network, string> = {
  BEP20:    "USDT",
  ETH:      "USDC",
  POLYGON:  "USDT",
  ARBITRUM: "USDT",
}

export const NETWORK_LABEL: Record<Network, string> = {
  BEP20:    "BNB Smart Chain (BEP20)",
  ETH:      "Ethereum (ERC20)",
  POLYGON:  "Polygon (MATIC)",
  ARBITRUM: "Arbitrum One",
}

export const BINANCE_PAY_ID = "1202935098"
