# JagoSwap

**Giwa. Anytime. Anywhere.**

A mobile-first swap app on GIWA Sepolia (chain 91342), built with [`@ammora-protocol/sdk`](https://www.npmjs.com/package/@ammora-protocol/sdk).

- Live, read-only quotes from Ammora pools (`AmmoraSwapClient.prepareExactIn`, auto-route deployment)
- Native ETH in, `direct-wallet` execution, 1% slippage guard
- Every swap is signed in the user's own wallet (`PreparedExactInputSwap.execute`); no keys ever touch the page
- Custom Ammora pool input (concentrated / compounding / almm)

## Run

```
npm install
npm run build   # bundles src/ into app.js
```

Serve the repo root (GitHub Pages serves it from `main` / root).

Testnet only, no real value.
