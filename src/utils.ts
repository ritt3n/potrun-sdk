import { PotrunError } from "./errors";

export function toBigInt(value: bigint | number): bigint {
  if (typeof value === "bigint") return value;
  if (!Number.isInteger(value) || value < 0) {
    throw new PotrunError(
      "INVALID_ARGUMENT",
      `Expected a non-negative integer, received ${value}.`,
    );
  }
  return BigInt(value);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
