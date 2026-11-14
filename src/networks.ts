import type { Address, Chain } from "viem";
import { base, baseSepolia } from "viem/chains";

export type PotrunNetworkName = "baseMainnet" | "baseSepolia";

export type PotrunNetwork = {
  name: string;
  chainId: number;
  potrun: Address;
  rpcUrl: string;
  chain: Chain;
};

export const NETWORKS = {
  baseMainnet: {
    name: "Base",
    chainId: base.id,
    potrun: "0x24f2858928B5b16bb1F4942cEBD5e825f7CC2b6F",
    rpcUrl: "https://mainnet.base.org",
    chain: base,
  },
  baseSepolia: {
    name: "Base Sepolia",
    chainId: baseSepolia.id,
    potrun: "0xD4A61C518E80eBbec84cF63cf3C489F3EeeEB9Aa",
    rpcUrl: "https://sepolia.base.org",
    chain: baseSepolia,
  },
} as const satisfies Record<PotrunNetworkName, PotrunNetwork>;

export function resolveNetwork(
  network?: PotrunNetworkName | PotrunNetwork,
): PotrunNetwork {
  if (!network) return NETWORKS.baseMainnet;

  if (typeof network === "string") {
    const preset = (NETWORKS as Record<string, PotrunNetwork>)[network];
    if (!preset) {
      throw new Error(`Unknown Potrun network: ${network}`);
    }
    return preset;
  }

  return network;
}
