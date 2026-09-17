import { mnemonicToAccount } from "viem/accounts"
import { bytesToHex } from "viem"

/**
 * Deriva um endereco de deposito UNICO por usuario a partir de uma seed mestra
 * (HD wallet, BIP-44 path m/44'/60'/0'/0/{index}).
 *
 * Como todas as redes EVM (Ethereum, BSC, Polygon, Arbitrum) usam o mesmo
 * algoritmo de derivacao (secp256k1) e o mesmo formato de endereco, UM endereco
 * derivado funciona em TODAS as 4 redes ao mesmo tempo.
 *
 * Vantagem de seguranca: como o endereco e exclusivo de cada usuario, qualquer
 * transferencia que chega nele e comprovadamente daquele usuario — nao ha como
 * confundir com pagamento de outra pessoa.
 *
 * O operador controla a seed mestra (HD_WALLET_MNEMONIC), entao pode varrer
 * (sweep) os fundos de qualquer endereco derivado quando quiser.
 */
export function deriveDepositAddress(index: number): string {
  const mnemonic = process.env.HD_WALLET_MNEMONIC
  if (!mnemonic) {
    throw new Error("HD_WALLET_MNEMONIC nao configurada")
  }
  const account = mnemonicToAccount(mnemonic, { addressIndex: index })
  return account.address
}

/**
 * Deriva a CHAVE PRIVADA do endereco de deposito de um indice.
 *
 * USO RESTRITO AO ADMIN: com essa chave o operador importa o endereco na
 * MetaMask/Trust Wallet e saca (transfere) os fundos. A mesma chave controla o
 * endereco em TODAS as redes EVM (BSC, Ethereum, Polygon, Arbitrum).
 *
 * NUNCA exponha essa funcao para usuarios comuns — apenas em actions com
 * requireAdmin().
 */
export function deriveDepositPrivateKey(index: number): { address: string; privateKey: string } {
  const mnemonic = process.env.HD_WALLET_MNEMONIC
  if (!mnemonic) {
    throw new Error("HD_WALLET_MNEMONIC nao configurada")
  }
  const account = mnemonicToAccount(mnemonic, { addressIndex: index })
  const hdKey = account.getHdKey()
  if (!hdKey.privateKey) {
    throw new Error("Falha ao derivar chave privada")
  }
  return { address: account.address, privateKey: bytesToHex(hdKey.privateKey) }
}
