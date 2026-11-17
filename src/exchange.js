// JagoSwap: real swaps on GIWA Sepolia (91342) through @ammora-protocol/sdk.
// Quotes are read-only. Sends happen only after the user presses "Swap" and signs in their own wallet.
import {
  AmmoraSwapClient,
  giwaSepoliaAutoRouteDeployment,
  giwaSepoliaAutoRoutePoolProfiles,
} from '@ammora-protocol/sdk';
import {
  createPublicClient, createWalletClient, custom, http, defineChain,
  parseEther, formatUnits, erc20Abi, getAddress,
} from 'viem';

const D = giwaSepoliaAutoRouteDeployment;
export const WETH = D.contracts.tokens.wrappedNative;
export const EXPLORER = D.chain.blockExplorerUrl;
export const chain = defineChain({
  id: D.chain.id,
  name: D.chain.name,
  nativeCurrency: D.chain.nativeCurrency,
  rpcUrls: { default: { http: [D.chain.rpcUrls[0]] } },
  blockExplorers: { default: { name: 'GIWA Explorer', url: EXPLORER } },
});

// Pools found on-chain with the SDK's discoverAmmoraPools() over the auto-route factories.
export const POOLS = [
  { label: 'MUSE · Ammora concentrated pool', model: 'concentrated', pool: '0x035Fc63BDA999C076daC5C7FD5dcD0c48dFD6a5A' },
];

const publicClient = createPublicClient({ chain, transport: http() });
let swapsPromise;
const swaps = () => (swapsPromise ??= AmmoraSwapClient.create(publicClient, {
  deploymentCatalog: { [chain.id]: D },
  factoryProfiles: giwaSepoliaAutoRoutePoolProfiles,
}));

let account = null;
let wallet = null;

export async function connectWallet() {
  if (!window.ethereum) throw new Error('No wallet found. Open this page in MetaMask / OKX / Rabby browser.');
  const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const hex = '0x' + chain.id.toString(16);
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e) {
    if (e.code === 4902 || /Unrecognized|not added/i.test(e.message || '')) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
        chainId: hex, chainName: chain.name, nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls.default.http, blockExplorerUrls: [EXPLORER],
      }] });
    } else throw e;
  }
  account = getAddress(addr);
  wallet = createWalletClient({ account, chain, transport: custom(window.ethereum) });
  return account;
}

export async function balance() {
  if (!account) return null;
  return formatUnits(await publicClient.getBalance({ address: account }), 18);
}

const symbols = {};
async function symbol(token) {
  if (!symbols[token]) symbols[token] = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' });
  return symbols[token];
}

let prepared = null;
let preparedFor = null;
let lastParams = null;

// Read-only quote: ETH in -> pool's other token out. Uses the reviewed native router path.
export async function quote({ model, pool, amountEth, slippageBps = 100 }) {
  lastParams = { model, pool, amountEth, slippageBps };
  const payer = account ?? '0x000000000000000000000000000000000000dEaD';
  preparedFor = account;
  const s = await swaps();
  prepared = await s.prepareExactIn({
    model, pool: getAddress(pool), tokenIn: WETH, inputAsset: 'native',
    amountIn: parseEther(String(amountEth)), payer, recipient: payer,
    slippageBps, executionMode: 'direct-wallet',
  });
  const q = prepared.quote;
  const out = q.tokenOut;
  const dec = await publicClient.readContract({ address: out, abi: erc20Abi, functionName: 'decimals' });
  return {
    tokenOut: out, symbol: await symbol(out),
    expected: formatUnits(q.expectedAmountOut, dec),
    minimum: formatUnits(q.minimumAmountOut, dec),
    block: String(q.quoteBlockNumber),
    forWallet: !!account,
  };
}

// Signed by the player's own wallet. The SDK re-checks the quote, simulates, sends, and reconciles the receipt.
export async function executeSwap(onStatus) {
  if (!wallet) throw new Error('Connect wallet first');
  if (!lastParams) throw new Error('Get a quote first');
  if (!prepared || preparedFor !== account || prepared.isExpired()) await quote(lastParams);
  const r = await prepared.execute(wallet, { onStatus });
  prepared = null;
  return { hash: r.hash, block: String(r.receipt.blockNumber) };
}
