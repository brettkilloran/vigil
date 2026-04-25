/**
 * Shared bitwise utilities — hashing, PRNG, UUID fallback, constant-time compare.
 *
 * Centralizes patterns that were previously duplicated across many files (FNV-1a in 7+
 * files, the RFC4122 v4 UUID generator in 2, constant-time byte equality in 2). Having
 * them in one module means the bitwise ops live behind a typed function surface and
 * consumers do not need their own `// biome-ignore lint/suspicious/noBitwiseOperators`
 * comments per call site.
 */

const FNV1A_32_OFFSET_BASIS = 0x81_1c_9d_c5;
const FNV1A_32_PRIME = 0x01_00_01_93;

/**
 * FNV-1a 32-bit hash. Returns an unsigned 32-bit int (0..2^32-1).
 * Stable across runs for a given input — same seed always yields the same hash.
 *
 * Uses `Math.imul` for exact 32-bit integer multiplication. This is the canonical
 * variant; prefer this for new code.
 */
export function fnv1aHash32(input: string): number {
  let h = FNV1A_32_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: FNV-1a step — XOR the next byte into the running hash
    h ^= input.charCodeAt(i);
    h = Math.imul(h, FNV1A_32_PRIME);
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: clamp signed Math.imul result back to unsigned uint32
  return h >>> 0;
}

/**
 * FNV-1a 32-bit hash using ordinary float multiplication (`* prime`) instead of `Math.imul`.
 *
 * For products that exceed 2^53 (which happens routinely after a few FNV iterations) the
 * float multiply loses precision in low bits, so this variant produces *different* hash
 * values than {@link fnv1aHash32} on the same input. Existing layout / placement code that
 * uses this variant cannot switch to the canonical form without shifting every output —
 * use this when you need bit-exact compatibility with that legacy behavior.
 */
export function fnv1aHash32FloatMul(input: string): number {
  let h = FNV1A_32_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: FNV-1a step — XOR the next byte into the running hash
    h ^= input.charCodeAt(i);
    // biome-ignore lint/suspicious/noBitwiseOperators: float `*` then `>>> 0` is intentional — see fn doc
    h = (h * FNV1A_32_PRIME) >>> 0;
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: final clamp to uint32
  return h >>> 0;
}

/**
 * One xorshift32 avalanche step on a uint32 with a per-call salt. Used by callers that
 * need a salted re-mix of a base hash (e.g. derive multiple stable randoms from one seed).
 */
export function xorshift32Mix(base: number, salt: number): number {
  // biome-ignore lint/suspicious/noBitwiseOperators: salted hash mix — XOR salt then clamp to uint32
  let x = Math.imul(base ^ salt, 2_246_822_519) >>> 0;
  // biome-ignore lint/suspicious/noBitwiseOperators: avalanche step — fold high half into low half
  x ^= x >>> 16;
  // biome-ignore lint/suspicious/noBitwiseOperators: clamp post-multiply back into uint32
  x = Math.imul(x, 2_246_822_519) >>> 0;
  // biome-ignore lint/suspicious/noBitwiseOperators: final clamp to uint32
  return x >>> 0;
}

/**
 * xorshift32 PRNG state. Mutated in place by {@link xorshift32Random}. Caller seeds
 * `s` to any nonzero value (the function falls back to a default when `s === 0`).
 */
export interface Xorshift32State {
  s: number;
}

const XORSHIFT32_FALLBACK_SEED = 0x6e_ed_0e_9d;

/** xorshift32 PRNG step. Mutates `state` and returns the next number in `[0, 1)`. */
export function xorshift32Random(state: Xorshift32State): number {
  // biome-ignore lint/suspicious/noBitwiseOperators: coerce seed to signed 32-bit int for the xorshift32 PRNG below
  let x = state.s | 0;
  if (x === 0) {
    x = XORSHIFT32_FALLBACK_SEED;
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: xorshift32 step (x ^= x << 13)
  x ^= x << 13;
  // biome-ignore lint/suspicious/noBitwiseOperators: xorshift32 step (x ^= x >>> 17)
  x ^= x >>> 17;
  // biome-ignore lint/suspicious/noBitwiseOperators: xorshift32 step (x ^= x << 5)
  x ^= x << 5;
  state.s = x;
  // biome-ignore lint/suspicious/noBitwiseOperators: reinterpret signed int32 as uint32, then normalize to [0, 1)
  return (x >>> 0) * (1 / 4_294_967_296);
}

/**
 * RFC 4122 v4 UUID generator using `Math.random` (fallback for environments without
 * `crypto.randomUUID`). Prefer `crypto.randomUUID()` where available.
 */
export function generateUuidV4Fallback(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    // biome-ignore lint/suspicious/noBitwiseOperators: nibble truncation — Math.floor via | 0
    const r = (Math.random() * 16) | 0;
    // biome-ignore lint/suspicious/noBitwiseOperators: variant nibble — clear top two bits, set bit 3 so the digit is 8/9/a/b
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Constant-time equality check on two byte arrays of any length. Returns false if the
 * lengths differ; otherwise XORs each byte pair into an accumulator without short-
 * circuiting so timing does not leak which prefix matched.
 */
export function constantTimeBytesEqual(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let acc = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: constant-time byte compare — XOR each pair and OR diffs into the accumulator without short-circuiting
    acc |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return acc === 0;
}
