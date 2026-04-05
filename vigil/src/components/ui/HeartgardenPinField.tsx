"use client";

import { ArrowRight } from "@phosphor-icons/react";
import {
  useCallback,
  useId,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@/src/components/ui/Button";
import { cx } from "@/src/lib/cx";
import { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";

import styles from "./HeartgardenPinField.module.css";

const SLOTS = HEARTGARDEN_BOOT_PIN_LENGTH;

export type HeartgardenPinFieldProps = {
  /** Optional prefix for stable ids in tests */
  id?: string;
  /** Accessible name; visually hidden via `.legend` */
  legend: string;
  value: string;
  onValueChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
  /** Focus first cell on mount (e.g. when console opens) */
  autoFocus?: boolean;
  className?: string;
};

function clampPin(raw: string): string {
  return raw.replace(/\s+/gu, "").slice(0, SLOTS);
}

export function HeartgardenPinField({
  id: idProp,
  legend,
  value,
  onValueChange,
  onSubmit,
  disabled = false,
  submitting = false,
  errorMessage = null,
  autoFocus = false,
  className,
}: HeartgardenPinFieldProps) {
  const reactId = useId();
  const baseId = idProp ?? `hg-pin-${reactId.replace(/:/gu, "")}`;
  const errorId = `${baseId}-error`;
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setRef = useCallback((i: number) => (el: HTMLInputElement | null) => {
    refs.current[i] = el;
  }, []);

  const focusAt = useCallback((i: number) => {
    const el = refs.current[Math.max(0, Math.min(SLOTS - 1, i))];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const applyFullPin = useCallback(
    (nextRaw: string) => {
      onValueChange(clampPin(nextRaw));
    },
    [onValueChange],
  );

  const handleChange = useCallback(
    (index: number, e: ChangeEvent<HTMLInputElement>) => {
      if (disabled || submitting) return;
      let chunk = e.target.value;
      if (chunk.length > 1) {
        chunk = chunk.slice(-1);
      }
      const head = value.slice(0, index);
      const tail = value.slice(index + 1);
      const merged = clampPin(head + (chunk || "") + tail);
      onValueChange(merged);
      if (chunk && index < SLOTS - 1) {
        queueMicrotask(() => focusAt(index + 1));
      }
    },
    [disabled, submitting, value, onValueChange, focusAt],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled || submitting) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusAt(index - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusAt(index + 1);
        return;
      }
      if (e.key === "Backspace" && !value[index] && index > 0) {
        e.preventDefault();
        const next = value.slice(0, index - 1) + value.slice(index);
        onValueChange(next);
        focusAt(index - 1);
        return;
      }
      if (e.key === "Enter") {
        if (value.length === SLOTS) {
          e.preventDefault();
          onSubmit();
        }
      }
    },
    [disabled, submitting, value, onValueChange, onSubmit, focusAt],
  );

  const handlePaste = useCallback(
    (index: number, e: ClipboardEvent<HTMLInputElement>) => {
      if (disabled || submitting) return;
      const text = e.clipboardData.getData("text");
      if (!text) return;
      e.preventDefault();
      const head = value.slice(0, index);
      const tail = value.slice(index);
      const merged = clampPin(head + text + tail);
      applyFullPin(merged);
      const nextIdx = merged.length >= SLOTS ? SLOTS - 1 : merged.length;
      queueMicrotask(() => focusAt(nextIdx));
    },
    [disabled, submitting, value, applyFullPin, focusAt],
  );

  const complete = value.length === SLOTS;
  const block = disabled || submitting;
  const showError = Boolean(errorMessage);

  return (
    <div className={cx(styles.wrap, className)}>
      <fieldset
        className={styles.fieldset}
        disabled={block}
        aria-describedby={showError ? errorId : undefined}
        aria-invalid={showError ? true : undefined}
      >
        <legend className={styles.legend}>{legend}</legend>
        <div className={styles.console}>
          <div className={styles.slots} role="group" aria-label={legend}>
            {Array.from({ length: SLOTS }, (_, i) => {
              const char = value[i] ?? "";
              const inputId = `${baseId}-${i + 1}`;
              return (
                <input
                  key={i}
                  ref={setRef(i)}
                  id={inputId}
                  className={cx(styles.cell, showError && styles.cellInvalid)}
                  type="password"
                  name={`${baseId}-char-${i + 1}`}
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={1}
                  value={char}
                  aria-label={`Character ${i + 1} of ${SLOTS}`}
                  autoFocus={autoFocus && i === 0}
                  onChange={(ev) => handleChange(i, ev)}
                  onKeyDown={(ev) => handleKeyDown(i, ev)}
                  onPaste={(ev) => handlePaste(i, ev)}
                />
              );
            })}
          </div>
          <Button
            type="button"
            variant="primary"
            tone="solid"
            size="icon"
            iconOnly
            className={cx(styles.submit, complete && !block && styles.submitReady)}
            disabled={!complete || block}
            aria-label="Submit access code"
            onClick={() => onSubmit()}
            leadingIcon={<ArrowRight size={22} weight="bold" aria-hidden />}
          />
        </div>
      </fieldset>
      <p id={errorId} className={styles.error} aria-live="polite" role="status">
        {errorMessage ?? ""}
      </p>
    </div>
  );
}
