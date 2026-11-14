import { createPublicClient, http } from "viem";
import type { Account, Address, PublicClient, WalletClient } from "viem";
import { EncodeModule } from "./encode";
import { WalletRequiredError, WrongChainError } from "./errors";
import { OutcomesModule } from "./outcomes";
import { PayoutsModule } from "./payouts";
import { PoolsModule } from "./pools";
import { SpinsModule } from "./spins";
import { resolveNetwork } from "./networks";
import type { PotrunNetwork } from "./networks";
import type { PotrunClientConfig } from "./types";

export class PotrunClient {
  readonly network: PotrunNetwork;
  readonly potrunAddress: Address;
  readonly publicClient: PublicClient;
  readonly walletClient?: WalletClient;
  readonly address?: Address;

  readonly pools: PoolsModule;
  readonly outcomes: OutcomesModule;
  readonly spins: SpinsModule;
  readonly payouts: PayoutsModule;
  readonly encode: EncodeModule;

  constructor(config: PotrunClientConfig = {}) {
    const network = resolveNetwork(config.network);

    this.network = network;
    this.potrunAddress = network.potrun;
    this.publicClient =
      config.publicClient ??
      createPublicClient({
        chain: network.chain,
        transport: http(network.rpcUrl),
      });

    if (
      this.publicClient.chain &&
      this.publicClient.chain.id !== network.chainId
    ) {
      throw new WrongChainError(network.chainId, this.publicClient.chain.id);
    }

    this.walletClient = config.walletClient;
    this.address = config.walletClient?.account?.address ?? config.address;

    this.pools = new PoolsModule(this);
    this.outcomes = new OutcomesModule(this);
    this.spins = new SpinsModule(this);
    this.payouts = new PayoutsModule(this);
    this.encode = new EncodeModule(this.network);
  }

  requireWallet(): {
    walletClient: WalletClient;
    account: Account | Address;
  } {
    if (!this.walletClient) throw new WalletRequiredError();

    const account = this.walletClient.account ?? this.address;
    if (!account) {
      throw new WalletRequiredError(
        "A wallet account is required. Pass a wallet client with an account or provide an address.",
      );
    }

    return { walletClient: this.walletClient, account };
  }

  async assertWalletChain(walletClient: WalletClient): Promise<void> {
    const chainId = walletClient.chain?.id ?? (await walletClient.getChainId());

    if (chainId !== this.network.chainId) {
      throw new WrongChainError(this.network.chainId, chainId);
    }
  }
}

export function createPotrunClient(
  config: PotrunClientConfig = {},
): PotrunClient {
  return new PotrunClient(config);
}
