import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { NATIVE_ETH } from "../src/constants";
import { PoolsModule } from "../src/pools";
import type { PotrunClient } from "../src/client";

const TOKEN = "0x0000000000000000000000000000000000000002" as Address;

function createPools() {
  const readContract = vi.fn(
    async (call: { functionName: string; args?: readonly unknown[] }) => {
      switch (call.functionName) {
        case "poolCount":
          return 2n;
        case "getPool":
          return call.args?.[0] === 1n
            ? [NATIVE_ETH, 1_000n, 5n]
            : [TOKEN, 2_000n, 6n];
        case "getPoolByToken":
          return call.args?.[0] === TOKEN ? [2n, 2_000n, 6n] : [1n, 1_000n, 5n];
        case "tokenToPoolId":
          if (
            String(call.args?.[0]).toLowerCase() === NATIVE_ETH.toLowerCase()
          ) {
            return 1n;
          }
          return String(call.args?.[0]).toLowerCase() === TOKEN.toLowerCase()
            ? 2n
            : 0n;
        case "name":
          return "Test Token";
        case "symbol":
          return "TKN";
        case "decimals":
          return 6;
        default:
          throw new Error(`Unexpected function: ${call.functionName}`);
      }
    },
  );

  const client = {
    publicClient: { readContract },
    potrunAddress: "0x0000000000000000000000000000000000000001",
  } as unknown as PotrunClient;

  return { pools: new PoolsModule(client), readContract };
}

describe("PoolsModule", () => {
  it("lists all pools and maps the native sentinel to ETH", async () => {
    const { pools } = createPools();

    const result = await pools.list();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      poolId: 1n,
      token: NATIVE_ETH,
      isNative: true,
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      pot: 1_000n,
      totalSpins: 5n,
    });
    expect(result[1]).toMatchObject({
      poolId: 2n,
      token: TOKEN,
      isNative: false,
      name: "Test Token",
      symbol: "TKN",
      decimals: 6,
      pot: 2_000n,
      totalSpins: 6n,
    });
  });

  it("finds the native ETH pool", async () => {
    const { pools } = createPools();

    await expect(pools.nativeEth()).resolves.toMatchObject({
      poolId: 1n,
      symbol: "ETH",
      isNative: true,
    });
  });

  it("finds a pool by token", async () => {
    const { pools } = createPools();

    await expect(pools.getByToken(TOKEN)).resolves.toMatchObject({
      poolId: 2n,
      symbol: "TKN",
      decimals: 6,
    });
  });

  it("returns null for an unknown token", async () => {
    const { pools } = createPools();

    await expect(
      pools.findByToken("0x0000000000000000000000000000000000000099"),
    ).resolves.toBeNull();
  });
});
