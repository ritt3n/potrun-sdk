import { describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Log,
  type WalletClient,
} from "viem";
import { NATIVE_ETH } from "../src/constants";
import { SpinTimeoutError } from "../src/errors";
import { NETWORKS } from "../src/networks";
import { potrunPlayerAbi } from "../src/player-abi";
import { SpinsModule } from "../src/spins";
import type { PotrunClient } from "../src/client";

const WEIGHTS = [537_000, 140_000, 140_000, 90_000, 60_000, 24_000, 8_000, 800, 200];
const MULTIPLIERS = [0, 5_000, 12_000, 15_000, 20_000, 50_000, 100_000, 1_000_000, 2_000_000];
const PLAYER = "0x0000000000000000000000000000000000000003" as Address;
const REQUEST_ID = 42n;

function createLog(): Log {
  const topics = encodeEventTopics({
    abi: potrunPlayerAbi,
    eventName: "SpinRequested",
    args: {
      requestId: REQUEST_ID,
      poolId: 1n,
      player: PLAYER,
    },
  });
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [NATIVE_ETH, 1_000n],
  );

  return {
    address: NETWORKS.baseMainnet.potrun,
    topics: topics as Log["topics"],
    data,
    blockHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    blockNumber: 1n,
    logIndex: 0,
    transactionHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    transactionIndex: 0,
    removed: false,
  };
}

function createSpins(options: { fulfilled?: boolean } = {}) {
  const fulfilled = options.fulfilled ?? true;
  const readContract = vi.fn(
    async (call: { functionName: string; args?: readonly unknown[] }) => {
      switch (call.functionName) {
        case "getPool":
          return [NATIVE_ETH, 10_000n, 1n];
        case "platformFeePct":
          return 10_000;
        case "previewPayout":
          return [100n, 2_000_000, 200, 1_000_000];
        case "spinRequests":
          return [1n, PLAYER, 1_000n, fulfilled, fulfilled ? 9 : 0, fulfilled ? 500n : 0n];
        case "getOutcomes":
          return [WEIGHTS, MULTIPLIERS, 1_000_000];
        default:
          throw new Error(`Unexpected function: ${call.functionName}`);
      }
    },
  );

  const call = vi.fn().mockResolvedValue("0x");
  const waitForTransactionReceipt = vi.fn().mockResolvedValue({
    status: "success",
    logs: [createLog()],
  });
  const sendTransaction = vi.fn().mockResolvedValue("0xhash");
  const walletClient = {
    account: { address: PLAYER },
    sendTransaction,
    writeContract: vi.fn().mockResolvedValue("0xapprove"),
  } as unknown as WalletClient;

  const poolsGet = vi.fn().mockResolvedValue({
    poolId: 1n,
    token: NATIVE_ETH,
    isNative: true,
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
    pot: 10_000n,
    totalSpins: 1n,
  });
  const outcomesGet = vi.fn().mockResolvedValue({
    weights: WEIGHTS,
    multipliers: MULTIPLIERS,
    totalWeight: 1_000_000,
    winChance: 0.463,
    rtp: 0.813,
    table: [],
  });

  const client = {
    potrunAddress: NETWORKS.baseMainnet.potrun,
    network: NETWORKS.baseMainnet,
    publicClient: { readContract, call, waitForTransactionReceipt },
    walletClient,
    address: PLAYER,
    pools: { get: poolsGet },
    outcomes: { get: outcomesGet },
    requireWallet: vi.fn().mockReturnValue({
      walletClient,
      account: walletClient.account,
    }),
    assertWalletChain: vi.fn().mockResolvedValue(undefined),
  } as unknown as PotrunClient;

  return {
    spins: new SpinsModule(client),
    readContract,
    call,
    sendTransaction,
    waitForTransactionReceipt,
  };
}

describe("SpinsModule", () => {
  it("prepares a native ETH spin", async () => {
    const { spins } = createSpins();

    const result = await spins.prepare({ poolId: 1n, amount: 1_000n });

    expect(result).toMatchObject({
      isNative: true,
      needsApproval: false,
      maxPayout: 8_000n,
      jackpotPreview: 100n,
      platformFeePct: 10,
    });
    expect(result.pool.symbol).toBe("ETH");
  });

  it("sends a spin and parses the request id", async () => {
    const { spins, call, sendTransaction } = createSpins();

    const result = await spins.send({ poolId: 1n, amount: 1_000n });

    expect(result).toMatchObject({
      requestId: REQUEST_ID,
      txHash: "0xhash",
      poolId: 1n,
      token: NATIVE_ETH,
      amount: 1_000n,
    });
    expect(call).toHaveBeenCalledOnce();
    expect(sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        to: NETWORKS.baseMainnet.potrun,
        value: 1_000n,
      }),
    );
  });

  it("waits for a fulfilled request", async () => {
    const { spins } = createSpins();

    const result = await spins.wait(REQUEST_ID);

    expect(result).toMatchObject({
      requestId: REQUEST_ID,
      poolId: 1n,
      player: PLAYER,
      amount: 1_000n,
      outcomeNumber: 9,
      multiplier: 2_000_000,
      payoutAmount: 500n,
      remainingPot: 10_000n,
      isWin: true,
    });
  });

  it("plays a spin end to end", async () => {
    const { spins } = createSpins();

    const result = await spins.play({ poolId: 1n, amount: 1_000n });

    expect(result).toMatchObject({
      requestId: REQUEST_ID,
      txHash: "0xhash",
      multiplier: 2_000_000,
      payoutAmount: 500n,
      isWin: true,
    });
  });

  it("times out when the request is not fulfilled", async () => {
    const { spins } = createSpins({ fulfilled: false });

    await expect(
      spins.wait(REQUEST_ID, { timeoutMs: 0, intervalMs: 1 }),
    ).rejects.toBeInstanceOf(SpinTimeoutError);
  });
});
