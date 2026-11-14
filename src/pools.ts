import { erc20Abi } from "viem";
import type { Address } from "viem";
import { NATIVE_ETH } from "./constants";
import { isNativeToken } from "./format";
import { potrunPlayerAbi } from "./player-abi";
import type { PotrunClient } from "./client";
import type { Pool } from "./types";
import { toBigInt } from "./utils";

export class PoolsModule {
  constructor(private readonly client: PotrunClient) {}

  async list(): Promise<Pool[]> {
    const poolCount = await this.client.publicClient.readContract({
      address: this.client.potrunAddress,
      abi: potrunPlayerAbi,
      functionName: "poolCount",
    });

    const ids = Array.from({ length: Number(poolCount) }, (_, index) =>
      BigInt(index + 1),
    );

    return Promise.all(ids.map((poolId) => this.get(poolId)));
  }

  async get(poolId: bigint | number): Promise<Pool> {
    const id = toBigInt(poolId);
    const [token, pot, totalSpins] =
      await this.client.publicClient.readContract({
        address: this.client.potrunAddress,
        abi: potrunPlayerAbi,
        functionName: "getPool",
        args: [id],
      });

    return this.resolvePool(id, token, pot, totalSpins);
  }

  async getByToken(token: Address): Promise<Pool> {
    const [poolId, pot, totalSpins] =
      await this.client.publicClient.readContract({
        address: this.client.potrunAddress,
        abi: potrunPlayerAbi,
        functionName: "getPoolByToken",
        args: [token],
      });

    return this.resolvePool(poolId, token, pot, totalSpins);
  }

  async findByToken(token: Address): Promise<Pool | null> {
    const poolId = await this.client.publicClient.readContract({
      address: this.client.potrunAddress,
      abi: potrunPlayerAbi,
      functionName: "tokenToPoolId",
      args: [token],
    });

    if (poolId === 0n) return null;
    return this.get(poolId);
  }

  async nativeEth(): Promise<Pool | null> {
    return this.findByToken(NATIVE_ETH);
  }

  private async resolvePool(
    poolId: bigint,
    token: Address,
    pot: bigint,
    totalSpins: bigint,
  ): Promise<Pool> {
    if (isNativeToken(token)) {
      return {
        poolId,
        token,
        isNative: true,
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
        pot,
        totalSpins,
      };
    }

    const name = await this.client.publicClient
      .readContract({
        address: token,
        abi: erc20Abi,
        functionName: "name",
      })
      .catch(() => "Unknown token");

    const symbol = await this.client.publicClient
      .readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
      })
      .catch(() => "UNKNOWN");

    const decimals = await this.client.publicClient
      .readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      })
      .catch(() => 18);

    return {
      poolId,
      token,
      isNative: false,
      name,
      symbol,
      decimals,
      pot,
      totalSpins,
    };
  }
}
