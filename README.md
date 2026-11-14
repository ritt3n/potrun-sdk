# potrun-sdk

Headless TypeScript SDK for playing [Potrun](https://potrun.xyz) on Base. Built for agents and scripts that already have an EVM wallet.

- Discover every onchain pool and resolve ERC20 metadata.
- Read outcomes, chances, RTP, and live payout caps.
- Spin with native ETH or ERC20 tokens, with approval and simulation helpers.
- Wait for Chainlink VRF v2.5 fulfillment.
- Claim pending payouts.
- Build wallet-agnostic transactions with `{ chainId, to, data, value }`.

## Install

`viem` is a peer dependency.

```bash
npm install github:ritt3n/potrun-sdk viem
pnpm add github:ritt3n/potrun-sdk viem
bun add github:ritt3n/potrun-sdk viem
```

The package runs `prepare` on install to build `dist/`.

## Quick start

```ts
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPotrunClient } from "potrun-sdk";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const potrun = createPotrunClient({
  network: "baseMainnet",
  publicClient,
  walletClient,
});

const pools = await potrun.pools.list();
const ethPool = await potrun.pools.nativeEth();
const outcomes = await potrun.outcomes.get();

console.log(pools);
console.log(outcomes.winChance, outcomes.rtp);
```

Reads work without a wallet client. Write methods require a wallet client or an address for JSON-RPC accounts.

## Play

```ts
const amount = parseEther("0.0001");

const prepared = await potrun.spins.prepare({
  poolId: 1n,
  amount,
});

console.log({
  needsApproval: prepared.needsApproval,
  maxPayout: prepared.maxPayout,
  jackpotPreview: prepared.jackpotPreview,
  platformFeePct: prepared.platformFeePct,
});

const result = await potrun.play({
  poolId: 1n,
  amount,
});

console.log({
  requestId: result.requestId,
  outcomeNumber: result.outcomeNumber,
  multiplier: result.multiplier,
  payoutAmount: result.payoutAmount,
  remainingPot: result.remainingPot,
  isWin: result.isWin,
});
```

`spins.send()` returns the request ID and transaction hash immediately:

```ts
const sent = await potrun.spins.send({ poolId: 1n, amount });
const outcome = await potrun.spins.wait(sent.requestId);
```

VRF fulfillment is asynchronous. `spins.wait()` polls `spinRequests` every 3 seconds for up to 5 minutes by default. Override it with `{ timeoutMs, intervalMs }`.

## ERC20 pools

```ts
import { erc20Abi, parseUnits } from "viem";

const token = "0x...";
const pool = await potrun.pools.getByToken(token);
const amount = parseUnits("10", pool.decimals);

const prepared = await potrun.spins.prepare({
  poolId: pool.poolId,
  amount,
});

const sent = await potrun.spins.send({
  poolId: pool.poolId,
  amount,
  approve: "exact", // default; use "max" for unlimited approval, or false to require an existing allowance
});
```

The SDK reads `allowance` and sends `approve` before the spin when needed. Transactions are simulated by default; pass `simulate: false` to skip the preflight call.

## Wallet-agnostic transactions

If the agent has its own wallet or signer, use the encode helpers:

```ts
const tx = potrun.encode.spin({
  poolId: 1n,
  amount: parseEther("0.0001"),
});

// tx = { chainId, to, data, value }
// Send it through your wallet's transaction API.
```

```ts
const approval = potrun.encode.approve({
  token: "0x...",
  amount: 10_000n,
});

const claim = potrun.encode.claimPayout();
```

For an ERC20 spin, pass the token address:

```ts
const tx = potrun.encode.spin({
  poolId: 2n,
  amount: 10_000n,
  token: "0x...",
});
```

Without `token`, `encode.spin` assumes native ETH.

## Pending payouts

```ts
const pending = await potrun.payouts.pending(); // native ETH by default

if (pending > 0n) {
  await potrun.payouts.claim();
}
```

For ERC20 pending payouts, pass the token address to both methods.

## API

### `createPotrunClient(config)`

| Option | Description |
| --- | --- |
| `network` | `"baseMainnet"` (default), `"baseSepolia"`, or a custom network object |
| `publicClient` | Optional viem public client; the SDK creates one from the network RPC if omitted |
| `walletClient` | Optional viem wallet client for writes |
| `address` | Optional player address when using a JSON-RPC account |

### `potrun.pools`

- `list()` — enumerate every onchain pool, including test/mock pools.
- `get(poolId)` — read one pool.
- `getByToken(token)` — read a pool by token address.
- `findByToken(token)` — return `null` when no pool exists.
- `nativeEth()` — find the pool whose token is the `NATIVE_ETH` sentinel.

### `potrun.outcomes`

- `get()` — weights, multipliers, win chance, RTP, and a per-outcome table.
- `preview(poolId, outcomeNumber, amount)` — live capped payout preview.
- `maxPayout(poolId)` — 80% of the current pot.

### `potrun.spins`

- `get(requestId)` — read a spin request.
- `prepare({ poolId, amount })` — pool, allowance, approval flag, fee, and payout cap.
- `send({ poolId, amount, approve?, simulate? })` — approve if needed, simulate, send, and parse `SpinRequested`.
- `wait(requestId, { timeoutMs?, intervalMs? })` — wait for VRF fulfillment.
- `play({ ...send, ...wait })` — send and wait in one call.

### `potrun.payouts`

- `pending(token?)` — pending payout for the configured player.
- `claim({ token?, simulate? })` — claim the pending balance.

### `potrun.encode`

- `spin({ poolId, amount, token? })`
- `approve({ token, amount, spender? })`
- `claimPayout({ token? })`

### Other exports

`potrunAbi`, `potrunPlayerAbi`, `erc20Abi`, `NATIVE_ETH`, network presets, formatting helpers (`formatAmount`, `formatMultiplier`, `formatChance`, `computeWinChance`, `computeRtp`, `computeMaxPayout`), and typed error classes.

## Networks

| Preset | Chain ID | Potrun |
| --- | --- | --- |
| `baseMainnet` | 8453 | `0x24f2858928B5b16bb1F4942cEBD5e825f7CC2b6F` |
| `baseSepolia` | 84532 | `0xD4A61C518E80eBbec84cF63cf3C489F3EeeEB9Aa` |

The ETH pool is identified by the `NATIVE_ETH` sentinel (`0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`). The SDK maps it to symbol `ETH` and 18 decimals automatically.

Custom deployments:

```ts
import { anvil } from "viem/chains";
import { createPotrunClient } from "potrun-sdk";

const potrun = createPotrunClient({
  network: {
    name: "Anvil",
    chainId: anvil.id,
    potrun: "0x...",
    rpcUrl: "http://127.0.0.1:8545",
    chain: anvil,
  },
  walletClient,
});
```

## Risk

Potrun is a game of chance. The current outcome table has a theoretical RTP of 81.30%, meaning an expected loss of 18.70% per spin before gas. Payouts are capped at 80% of the live pool pot, and short sessions can deviate significantly from the average. Only spend what you can afford to lose.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## License

MIT
