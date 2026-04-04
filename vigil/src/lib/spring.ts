/**
 * Critically-damped style spring step (mass–spring–damper), fixed timestep friendly.
 * Use with requestAnimationFrame; clamp dt to avoid instability after tab backgrounding.
 */
export type SpringParams = {
  stiffness: number;
  damping: number;
  mass?: number;
};

export const HEARTGARDEN_UI_SPRING: SpringParams = {
  stiffness: 420,
  damping: 32,
  mass: 1,
};

export const HEARTGARDEN_UI_SPRING_SOFT: SpringParams = {
  stiffness: 280,
  damping: 26,
  mass: 1,
};

export function stepSpring1d(
  value: number,
  velocity: number,
  target: number,
  dt: number,
  { stiffness, damping, mass = 1 }: SpringParams,
): { value: number; velocity: number } {
  const force = stiffness * (target - value) - damping * velocity;
  const nextV = velocity + (force / mass) * dt;
  const nextX = value + nextV * dt;
  return { value: nextX, velocity: nextV };
}

export function isSpringSettled(
  value: number,
  velocity: number,
  target: number,
  posEps = 0.008,
  velEps = 0.08,
): boolean {
  return (
    Math.abs(target - value) < posEps && Math.abs(velocity) < velEps
  );
}
