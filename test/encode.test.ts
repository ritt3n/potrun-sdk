import { describe, expect, it } from "vitest";
import type { Address, PublicClient } from "viem";
import { toFunctionSelector } from "viem";
import { createPotrunClient } from "../src/client";
import { NATIVE_ETH } from "../src/constants";
import { InvalidAmountError } from "../src/errors";
import { NETWORKS } from "../src/networks";

const TOKEN = "0x0000000000000000000000000000000000000002" as Address;

function createClient() {
  return createPotrunClient({
    publicClient: {} as PublicClient,
  });
}

describe("encode helpers", () => {
  it("encodes a native ETH spin", () => {
    const client = createClient();
    const tx = client.encode.spin({ poolId: 1n, amount: 1_000n });

    expect(tx.chainId).toBe(8453);
    expect(tx.to).toBe(NETWORKS.baseMainnet.potrun);
    expect(tx.value).toBe(1_000n);
    expect(tx.data.startsWith(toFunctionSelector("spin(uint256)"))).toBe(true);
  });

  it("encodes an ERC20 spin without a value", () => {
    const client = createClient();
    const tx = client.encode.spin({
      poolId: 2n,
      amount: 1_000n,
      token: TOKEN,
    });

    expect(tx.value).toBeUndefined();
    expect(tx.data.startsWith(toFunctionSelector("spin(uint256,uint256)"))).toBe(
      true,
    );
  });

  it("encodes an approval", () => {
    const client = createClient();
    const tx = client.encode.approve({ token: TOKEN, amount: 1_000n });

    expect(tx.to).toBe(TOKEN);
    expect(tx.chainId).toBe(8453);
    expect(tx.data.startsWith(toFunctionSelector("approve(address,uint256)"))).toBe(
      true,
    );
  });

  it("encodes a pending payout claim", () => {
    const client = createClient();
    const tx = client.encode.claimPayout();

    expect(tx.to).toBe(NETWORKS.baseMainnet.potrun);
    expect(tx.data.startsWith(toFunctionSelector("claimPendingPayout(address)"))).toBe(
      true,
    );
    expect(tx.value).toBeUndefined();
    expect(NATIVE_ETH).toBe("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
  });

  it("rejects zero amounts", () => {
    const client = createClient();

    expect(() => client.encode.spin({ poolId: 1n, amount: 0n })).toThrow(
      InvalidAmountError,
    );
  });
});
