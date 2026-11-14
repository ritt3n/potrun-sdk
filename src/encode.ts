import { encodeFunctionData, erc20Abi } from "viem";
import { NATIVE_ETH } from "./constants";
import { InvalidAmountError } from "./errors";
import { isNativeToken } from "./format";
import { potrunPlayerAbi } from "./player-abi";
import type { PotrunNetwork } from "./networks";
import type {
  EncodeApproveArgs,
  EncodeClaimArgs,
  EncodeSpinArgs,
  EncodedTransaction,
} from "./types";
import { toBigInt } from "./utils";

export class EncodeModule {
  constructor(private readonly network: PotrunNetwork) {}

  spin(args: EncodeSpinArgs): EncodedTransaction {
    if (args.amount <= 0n) throw new InvalidAmountError(args.amount);

    const poolId = toBigInt(args.poolId);
    const native = !args.token || isNativeToken(args.token);
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

    return {
      chainId: this.network.chainId,
      to: this.network.potrun,
      data,
      ...(native ? { value: args.amount } : {}),
    };
  }

  approve(args: EncodeApproveArgs): EncodedTransaction {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [args.spender ?? this.network.potrun, args.amount],
    });

    return {
      chainId: this.network.chainId,
      to: args.token,
      data,
    };
  }

  claimPayout(args: EncodeClaimArgs = {}): EncodedTransaction {
    const token = args.token ?? NATIVE_ETH;
    const data = encodeFunctionData({
      abi: potrunPlayerAbi,
      functionName: "claimPendingPayout",
      args: [token],
    });

    return {
      chainId: this.network.chainId,
      to: this.network.potrun,
      data,
    };
  }
}
