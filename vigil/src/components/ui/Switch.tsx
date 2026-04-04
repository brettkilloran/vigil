"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cx } from "@/src/lib/cx";

import styles from "./Switch.module.css";

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>;

/**
 * Accessible toggle (Radix Switch) with Vigil canvas chrome styling.
 * @see https://www.radix-ui.com/primitives/docs/components/switch
 */
export const Switch = React.forwardRef<React.ComponentRef<typeof SwitchPrimitives.Root>, SwitchProps>(
  function Switch({ className, ...props }, ref) {
    return (
      <SwitchPrimitives.Root ref={ref} className={cx(styles.root, className)} {...props}>
        <SwitchPrimitives.Thumb className={styles.thumb} />
      </SwitchPrimitives.Root>
    );
  },
);

Switch.displayName = "Switch";
