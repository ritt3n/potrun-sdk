import { describe, expect, it, vi } from "vitest";
import type { Address, WalletClient } from "viem";
import { NATIVE_ETH } from "../src/constants";
import { NoPendingPayoutError } from "../src/errors";
import { NETWORKS } from "../src/networks";
import { PayoutsModule } from "../src/payouts";
import type { PotrunClient } from "../src/client";

const PLAYER = "0x0000000000000000000000000000000000000003" as Address;

function createPayouts(pendingAmount: bigint) {
  const readContract = vi.fn(
    async (call: { functionName: string }) => {
      if (call.functionName === "pendingWithdrawals") return pendingAmount;
      throw new Error(`Unexpected function: ${call.functionName}`);
    },
  );
  const sendTransaction = vi.fn().mockResolvedValue("0xclaim");
  const walletClient = {
    account: { address: PLAYER },
    sendTransaction,
  } as unknown as WalletClient;

  const client = {
    potrunAddress: NETWORKS.baseMainnet.potrun,
    network: NETWORKS.baseMainnet,
    publicClient: {
      readContract,
      call: vi.fn().mockResolvedValue("0x"),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: "success",
      }),
    },
    walletClient,
    address: PLAYER,
    requireWallet: vi.fn().mockReturnValue({
      walletClient,
      account: walletClient.account,
    }),
    assertWalletChain: vi.fn().mockResolvedValue(undefined),
  } as unknown as PotrunClient;

  return { payouts: new PayoutsModule(client), sendTransaction };
}

describe("PayoutsModule", () => {
  it("reads the pending native ETH payout", async () => {
    const { payouts } = createPayouts(500n);

    await expect(payouts.pending()).resolves.toBe(500n);
  });

  it("claims a pending payout", async () => {
    const { payouts, sendTransaction } = createPayouts(500n);

    const result = await payouts.claim();

    expect(result).toMatchObject({
      token: NATIVE_ETH,
      amount: 500n,
      txHash: "0xclaim",
    });
    expect(sendTransaction).toHaveBeenCalledOnce();
  });

  it("rejects a claim when nothing is pending", async () => {
    const { payouts } = createPayouts(0n);

    await expect(payouts.claim()).rejects.toBeInstanceOf(NoPendingPayoutError);
  });
});
