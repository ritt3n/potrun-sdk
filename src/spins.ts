import { encodeFunctionData, erc20Abi, maxUint256, parseEventLogs } from "viem";
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_POLL_TIMEOUT_MS,
} from "./constants";
import {
  ApprovalRequiredError,
  InvalidAmountError,
  PotrunError,
  SpinTimeoutError,
  toPotrunError,
} from "./errors";
import { computeMaxPayout } from "./format";
import { potrunPlayerAbi } from "./player-abi";
import type { PotrunClient } from "./client";
import type {
  PlayArgs,
  PreparedSpin,
  SpinArgs,
  SpinOutcome,
  SpinRequest,
  SpinSent,
  WaitOptions,
} from "./types";
import { sleep, toBigInt } from "./utils";

export class SpinsModule {
  constructor(private readonly client: PotrunClient) {}

  async get(requestId: bigint | number): Promise<SpinRequest> {
    const id = toBigInt(requestId);
    const [poolId, player, amount, fulfilled, outcomeNumber, payoutAmount] =
      await this.client.publicClient.readContract({
        address: this.client.potrunAddress,
        abi: potrunPlayerAbi,
        functionName: "spinRequests",
        args: [id],
      });

    return {
      requestId: id,
      poolId,
      player,
      amount,
      fulfilled,
      outcomeNumber: Number(outcomeNumber),
      payoutAmount,
    };
  }

  async prepare(args: {
    poolId: bigint | number;
    amount: bigint;
  }): Promise<PreparedSpin> {
    if (args.amount <= 0n) throw new InvalidAmountError(args.amount);

    const poolId = toBigInt(args.poolId);
    const pool = await this.client.pools.get(poolId);

    const platformFeePct =
      await this.client.publicClient.readContract({
        address: this.client.potrunAddress,
        abi: potrunPlayerAbi,
        functionName: "platformFeePct",
      });

    let allowance = 0n;
    if (!pool.isNative && this.client.address) {
      allowance = await this.client.publicClient.readContract({
        address: pool.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [this.client.address, this.client.potrunAddress],
      });
    }

    const [jackpotPreview] =
      await this.client.publicClient.readContract({
        address: this.client.potrunAddress,
        abi: potrunPlayerAbi,
        functionName: "previewPayout",
        args: [poolId, 9, args.amount],
      });

    return {
      pool,
      amount: args.amount,
      isNative: pool.isNative,
      needsApproval: !pool.isNative && allowance < args.amount,
      allowance,
      maxPayout: computeMaxPayout(pool.pot),
      jackpotPreview,
      platformFeePct: Number(platformFeePct) / 1_000,
    };
  }

  async send(args: SpinArgs): Promise<SpinSent> {
    try {
      const poolId = toBigInt(args.poolId);
      if (args.amount <= 0n) throw new InvalidAmountError(args.amount);

      const prepared = await this.prepare({
        poolId,
        amount: args.amount,
      });
      const { walletClient, account } = this.client.requireWallet();
      await this.client.assertWalletChain(walletClient);

      const approveMode = args.approve ?? "exact";
      if (prepared.needsApproval) {
        if (approveMode === false) {
          throw new ApprovalRequiredError(
            prepared.pool.token,
            prepared.allowance,
            args.amount,
          );
        }

        const approvalAmount =
          approveMode === "max" ? maxUint256 : args.amount;
        const approvalHash = await walletClient.writeContract({
          account,
          chain: this.client.network.chain,
          address: prepared.pool.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [this.client.potrunAddress, approvalAmount],
        });
        await this.client.publicClient.waitForTransactionReceipt({
          hash: approvalHash,
        });
      }

      const native = prepared.pool.isNative;
      const data = native
        ? encodeFunctionData({
            abi: potrunPlayerAbi,
            functionName: "spin",
            args: [poolId],
          })
        : encodeFunctionData({
            abi: potrunPlayerAbi,
            functionName: "spin",
            args: [poolId, args.amount],
          });
      const value = native ? args.amount : undefined;

      if (args.simulate !== false) {
        await this.client.publicClient.call({
          account,
          to: this.client.potrunAddress,
          data,
          value,
        });
      }

      const hash = await walletClient.sendTransaction({
        account,
        chain: this.client.network.chain,
        to: this.client.potrunAddress,
        data,
        value,
      });
      const receipt = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        throw new PotrunError(
          "TRANSACTION_REVERTED",
          `Spin transaction ${hash} reverted.`,
        );
      }

      const [event] = parseEventLogs({
        abi: potrunPlayerAbi,
        eventName: "SpinRequested",
        logs: receipt.logs,
      });
      if (!event) {
        throw new PotrunError(
          "SPIN_EVENT_NOT_FOUND",
          "SpinRequested event was not found in the transaction receipt.",
        );
      }

      return {
        requestId: event.args.requestId,
        txHash: hash,
        poolId,
        token: prepared.pool.token,
        amount: args.amount,
      };
    } catch (error) {
      throw toPotrunError(error);
    }
  }

  async wait(
    requestId: bigint | number,
    options: WaitOptions = {},
  ): Promise<SpinOutcome> {
    const id = toBigInt(requestId);
    const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;

    while (true) {
      const request = await this.get(id);

      if (request.fulfilled) {
        const [outcomes, pool] = await Promise.all([
          this.client.outcomes.get(),
          this.client.pools.get(request.poolId),
        ]);
        const multiplier =
          outcomes.multipliers[request.outcomeNumber - 1] ?? 0;

        return {
          requestId: id,
          poolId: request.poolId,
          player: request.player,
          amount: request.amount,
          outcomeNumber: request.outcomeNumber,
          multiplier,
          payoutAmount: request.payoutAmount,
          remainingPot: pool.pot,
          isWin: multiplier > 0,
        };
      }

      if (Date.now() >= deadline) {
        throw new SpinTimeoutError(id, timeoutMs);
      }

      await sleep(intervalMs);
    }
  }

  async play(args: PlayArgs): Promise<SpinOutcome & SpinSent> {
    const sent = await this.send(args);
    const outcome = await this.wait(sent.requestId, args);
    return { ...sent, ...outcome };
  }
}
