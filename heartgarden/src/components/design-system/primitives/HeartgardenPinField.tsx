"use client";

import { ArrowRight } from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/src/components/ui/Button";
import { cx } from "@/src/lib/cx";
import { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";

import styles from "./HeartgardenPinField.module.css";

const SLOTS = HEARTGARDEN_BOOT_PIN_LENGTH;

export interface HeartgardenPinFieldProps {
  /** Focus first cell on mount (e.g. when console opens) */
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  /** Optional prefix for stable ids in tests */
  id?: string;
  /** Accessible name; visually hidden via `.legend` */
  legend: string;
  /** When focus leaves this control and `value` is still empty (e.g. dismiss boot access console). */
  onEmptyBlur?: () => void;
  onSubmit: () => void;
  onValueChange: (next: string) => void;
  submitting?: boolean;
  value: string;
  /** Shown above the PIN row (legend stays screen-reader-only unless you rely on this for sighted users). */
  visibleCaption?: string;
}

function clampPin(raw: string): string {
  return raw.replace(/\s+/gu, "").slice(0, SLOTS);
}

export function HeartgardenPinField({
  id: idProp,
  legend,
  visibleCaption,
  value,
  onValueChange,
  onSubmit,
  disabled = false,
  submitting = false,
  errorMessage = null,
  autoFocus = false,
  onEmptyBlur,
  className,
}: HeartgardenPinFieldProps) {
  const reactId = useId();
  const baseId = idProp ?? `hg-pin-${reactId.replace(/:/gu, "")}`;
  const errorId = `${baseId}-error`;
  const captionId = `${baseId}-caption`;
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const prevValueLenRef = useRef(0);
  const pulseTimeoutsRef = useRef<number[]>([]);
  const [pulseSlots, setPulseSlots] = useState(() => new Set<number>());

  const setRef = useCallback(
    (i: number) => (el: HTMLInputElement | null) => {
      refs.current[i] = el;
    },
    []
  );

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
    [onValueChange]
  );

  const handleChange = useCallback(
    (index: number, e: ChangeEvent<HTMLInputElement>) => {
      if (disabled || submitting) {
        return;
      }
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
    [disabled, submitting, value, onValueChange, focusAt]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled || submitting) {
        return;
      }
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
      if (e.key === "Enter" && value.length === SLOTS) {
        e.preventDefault();
        onSubmit();
      }
    },
    [disabled, submitting, value, onValueChange, onSubmit, focusAt]
  );

  const handlePaste = useCallback(
    (index: number, e: ClipboardEvent<HTMLInputElement>) => {
      if (disabled || submitting) {
        return;
      }
      const text = e.clipboardData.getData("text");
      if (!text) {
        return;
      }
      e.preventDefault();
      const head = value.slice(0, index);
      const tail = value.slice(index);
      const merged = clampPin(head + text + tail);
      applyFullPin(merged);
      const nextIdx = merged.length >= SLOTS ? SLOTS - 1 : merged.length;
      queueMicrotask(() => focusAt(nextIdx));
    },
    [disabled, submitting, value, applyFullPin, focusAt]
  );

  const complete = value.length === SLOTS;
  const block = disabled || submitting;
  const showError = Boolean(errorMessage);
  const describedBy =
    [visibleCaption ? captionId : null, showError ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  useLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!(el && onEmptyBlur)) {
      return;
    }
    const onFocusOut = (e: FocusEvent) => {
      if (disabled || submitting) {
        return;
      }
      const next = e.relatedTarget as Node | null;
      if (next && el.contains(next)) {
        return;
      }
      if (valueRef.current.length > 0) {
        return;
      }
      onEmptyBlur();
    };
    el.addEventListener("focusout", onFocusOut, true);
    return () => el.removeEventListener("focusout", onFocusOut, true);
  }, [onEmptyBlur, disabled, submitting]);

  useEffect(
    () => () => {
      for (const id of pulseTimeoutsRef.current) {
        window.clearTimeout(id);
      }
      pulseTimeoutsRef.current = [];
    },
    []
  );

  useEffect(() => {
    const prev = prevValueLenRef.current;
    if (value.length < prev) {
      prevValueLenRef.current = value.length;
      return;
    }
    if (value.length > prev) {
      for (let j = prev; j < value.length; j++) {
        const idx = j;
        const delay = (j - prev) * 46;
        const t1 = window.setTimeout(() => {
          setPulseSlots((s) => new Set(s).add(idx));
          const t2 = window.setTimeout(() => {
            setPulseSlots((s) => {
              const n = new Set(s);
              n.delete(idx);
              return n;
            });
          }, 460);
          pulseTimeoutsRef.current.push(t2);
        }, delay);
        pulseTimeoutsRef.current.push(t1);
      }
      prevValueLenRef.current = value.length;
    }
  }, [value]);

  return (
    <div className={cx(styles.wrap, className)} ref={wrapRef}>
      <fieldset
        aria-describedby={describedBy}
        aria-invalid={showError ? true : undefined}
        className={styles.fieldset}
        disabled={block}
      >
        <legend className={styles.legend}>{legend}</legend>
        {visibleCaption ? (
          <p className={styles.visibleCaption} id={captionId}>
            {visibleCaption}
          </p>
        ) : null}
        <div
          className={cx(styles.console, styles.consoleEnter)}
          style={
            {
              "--pin-slot-count": SLOTS,
            } as CSSProperties
          }
        >
          <div
            aria-label={legend}
            className={cx(styles.slots, styles.slotsEnter)}
            role="group"
          >
            {Array.from({ length: SLOTS }, (_, i) => {
              const char = value[i] ?? "";
              const inputId = `${baseId}-${i + 1}`;
              return (
                <input
                  aria-label={`Character ${i + 1} of ${SLOTS}`}
                  autoComplete="off"
                  autoCorrect="off"
                  autoFocus={autoFocus && i === 0}
                  className={cx(
                    styles.cell,
                    showError && styles.cellInvalid,
                    pulseSlots.has(i) && styles.cellPulse
                  )}
                  id={inputId}
                  inputMode="text"
                  key={i}
                  maxLength={1}
                  name={`${baseId}-char-${i + 1}`}
                  onChange={(ev) => handleChange(i, ev)}
                  onKeyDown={(ev) => handleKeyDown(i, ev)}
                  onPaste={(ev) => handlePaste(i, ev)}
                  ref={setRef(i)}
                  spellCheck={false}
                  style={{ "--pin-i": i } as CSSProperties}
                  type="password"
                  value={char}
                />
              );
            })}
          </div>
          <Button
            aria-label="Submit access code"
            className={cx(
              styles.submit,
              complete && !block && styles.submitReady
            )}
            disabled={!complete || block}
            iconOnly
            leadingIcon={<ArrowRight aria-hidden size={18} weight="bold" />}
            leadingIcon={<ArrowRight aria-hidden size={18} weight="bold" />}
            onClick={() => onSubmit()}
            size="icon"
            tone="solid"
            type="button"
          />
        </div>
      </fieldset>
      <p aria-live="polite" className={styles.error} id={errorId} role="status">
        {errorMessage ?? ""}
      </p>
    </div>
  );
}
