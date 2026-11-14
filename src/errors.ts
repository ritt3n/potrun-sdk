import { BaseError, ContractFunctionRevertedError } from "viem";
import type { Address } from "viem";

export type PotrunErrorCode =
  | "WALLET_REQUIRED"
  | "WRONG_CHAIN"
  | "APPROVAL_REQUIRED"
  | "SPIN_TIMEOUT"
  | "SPIN_EVENT_NOT_FOUND"
  | "TRANSACTION_REVERTED"
  | "NO_PENDING_PAYOUT"
  | "INVALID_OUTCOME"
  | "INVALID_AMOUNT"
  | "INVALID_ARGUMENT"
  | "VIEM_ERROR"
  | "UNKNOWN";

export class PotrunError extends Error {
  readonly code: PotrunErrorCode;

  constructor(
    code: PotrunErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PotrunError";
    this.code = code;
  }
}

export class WalletRequiredError extends PotrunError {
  constructor(
    message = "A wallet client with an account is required for this operation.",
  ) {
    super("WALLET_REQUIRED", message);
    this.name = "WalletRequiredError";
  }
}

export class WrongChainError extends PotrunError {
  constructor(expectedChainId: number, actualChainId: number) {
    super(
      "WRONG_CHAIN",
      `Wrong chain: expected ${expectedChainId}, received ${actualChainId}.`,
    );
    this.name = "WrongChainError";
  }
}

export class ApprovalRequiredError extends PotrunError {
  constructor(token: Address, allowance: bigint, required: bigint) {
    super(
      "APPROVAL_REQUIRED",
      `Token ${token} needs approval before spinning: allowance ${allowance}, required ${required}.`,
    );
    this.name = "ApprovalRequiredError";
  }
}

export class SpinTimeoutError extends PotrunError {
  constructor(requestId: bigint, timeoutMs: number) {
    super(
      "SPIN_TIMEOUT",
      `Spin request ${requestId} was not fulfilled within ${timeoutMs}ms. Check it again with spins.get().`,
    );
    this.name = "SpinTimeoutError";
  }
}

export class NoPendingPayoutError extends PotrunError {
  constructor(token: Address) {
    super(
      "NO_PENDING_PAYOUT",
      `No pending payout is available for token ${token}.`,
    );
    this.name = "NoPendingPayoutError";
  }
}

export class InvalidOutcomeError extends PotrunError {
  constructor(outcomeNumber: number) {
    super(
      "INVALID_OUTCOME",
      `Invalid outcome number ${outcomeNumber}; expected 1 through 9.`,
    );
    this.name = "InvalidOutcomeError";
  }
}

export class InvalidAmountError extends PotrunError {
  constructor(amount: bigint) {
    super("INVALID_AMOUNT", `Amount must be greater than zero; received ${amount}.`);
    this.name = "InvalidAmountError";
  }
}

export function toPotrunError(error: unknown): PotrunError {
  if (error instanceof PotrunError) return error;

  if (error instanceof ContractFunctionRevertedError) {
    const errorName = error.data?.errorName;
    return new PotrunError(
      "TRANSACTION_REVERTED",
      errorName ? `${errorName}: ${error.shortMessage}` : error.shortMessage,
      { cause: error },
    );
  }

  if (error instanceof BaseError) {
    return new PotrunError("VIEM_ERROR", error.shortMessage, { cause: error });
  }

  if (error instanceof Error) {
    return new PotrunError("UNKNOWN", error.message, { cause: error });
  }

  return new PotrunError("UNKNOWN", String(error), { cause: error });
}
