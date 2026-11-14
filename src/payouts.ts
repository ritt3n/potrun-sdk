import { encodeFunctionData } from "viem";
import type { Address, Hash } from "viem";
import { NATIVE_ETH } from "./constants";
import {
  NoPendingPayoutError,
  PotrunError,
  WalletRequiredError,
  toPotrunError,
} from "./errors";
import { potrunPlayerAbi } from "./player-abi";
import type { PotrunClient } from "./client";
import type { ClaimArgs } from "./types";

export type PayoutClaimResult = {
  txHash: Hash;
  token: Address;
  amount: bigint;
};

export class PayoutsModule {
  constructor(private readonly client: PotrunClient) {}

  async pending(token: Address = NATIVE_ETH): Promise<bigint> {
    if (!this.client.address) throw new WalletRequiredError();

    return this.client.publicClient.readContract({
      address: this.client.potrunAddress,
      abi: potrunPlayerAbi,
      functionName: "pendingWithdrawals",
      args: [this.client.address, token],
    });
  }

  async claim(args: ClaimArgs = {}): Promise<PayoutClaimResult> {
    try {
      const token = args.token ?? NATIVE_ETH;
      const { walletClient, account } = this.client.requireWallet();
      await this.client.assertWalletChain(walletClient);

      const amount = await this.pending(token);
      if (amount === 0n) throw new NoPendingPayoutError(token);

      const data = encodeFunctionData({
        abi: potrunPlayerAbi,
        functionName: "claimPendingPayout",
        args: [token],
      });

      if (args.simulate !== false) {
        await this.client.publicClient.call({
          account,
          to: this.client.potrunAddress,
          data,
        });
      }

      const hash = await walletClient.sendTransaction({
        account,
        chain: this.client.network.chain,
        to: this.client.potrunAddress,
        data,
      });
      const receipt = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        throw new PotrunError(
          "TRANSACTION_REVERTED",
          `Claim transaction ${hash} reverted.`,
        );
      }

      return { txHash: hash, token, amount };
    } catch (error) {
      throw toPotrunError(error);
    }
  }
}
