/* eslint-disable react-hooks/set-state-in-effect -- spring tick seeds initial value */
import { useEffect, useRef, useState } from "react";

import {
  isSpringSettled,
  type SpringParams,
  stepSpring1d,
} from "@/src/lib/spring";

/**
 * On mount (and when `to` / `from` / spring coefficients change), animates scalar from `from` toward `to`.
 */
export function useSpringBetween(
  to: number,
  from: number,
  spring: SpringParams,
): number {
  const [value, setValue] = useState(from);
  const posRef = useRef(from);
  const velRef = useRef(0);

  useEffect(() => {
    posRef.current = from;
    velRef.current = 0;
    setValue(from);

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { value: x, velocity } = stepSpring1d(
        posRef.current,
        velRef.current,
        to,
        dt,
        spring,
      );
      posRef.current = x;
      velRef.current = velocity;
      setValue(x);
      if (!isSpringSettled(x, velocity, to)) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, spring]);

  return value;
}
