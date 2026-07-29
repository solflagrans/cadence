"use client";

import {
  type InputHTMLAttributes,
  useEffect,
  useRef,
} from "react";

export const sanitizeNumericInput = (
  candidate: string,
  previous: string,
  allowDecimal = true,
  decimalPlaces = 2,
): string => {
  const normalized = candidate.replace(",", ".");
  const pattern = allowDecimal ? /^\d*(?:\.\d*)?$/ : /^\d*$/;
  if (!pattern.test(normalized)) return previous;
  if (
    allowDecimal &&
    normalized.includes(".") &&
    normalized.split(".")[1].length > decimalPlaces
  ) {
    return previous;
  }
  return normalized;
};

export const numericValue = (value: string): number | null => {
  if (!value.trim() || value === ".") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function NumericInput({
  value,
  onValueChange,
  allowDecimal = true,
  decimalPlaces = 2,
  min,
  max,
  required = false,
  className = "",
  onBlur,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "min" | "max"
> & {
  value: number;
  onValueChange: (value: number) => void;
  allowDecimal?: boolean;
  decimalPlaces?: number;
  min?: number;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(String(value));

  useEffect(() => {
    if (
      document.activeElement === inputRef.current ||
      numericValue(draftRef.current) === value
    ) {
      return;
    }
    draftRef.current = String(value);
    if (inputRef.current) inputRef.current.value = String(value);
  }, [value]);

  const validate = (nextDraft: string) => {
    const parsed = numericValue(nextDraft);
    const message =
      required && parsed === null
        ? "Введите значение"
        : parsed !== null && min !== undefined && parsed < min
          ? `Минимальное значение: ${min}`
          : parsed !== null && max !== undefined && parsed > max
            ? `Максимальное значение: ${max}`
            : "";
    inputRef.current?.setCustomValidity(message);
    return !message;
  };

  return (
    <input
      {...props}
      ref={inputRef}
      className={`numeric-input ${className}`.trim()}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      defaultValue={String(value)}
      required={required}
      onChange={(event) => {
        const next = sanitizeNumericInput(
          event.target.value,
          draftRef.current,
          allowDecimal,
          decimalPlaces,
        );
        if (next !== event.target.value) event.target.value = next;
        draftRef.current = next;
        inputRef.current?.setCustomValidity("");
        const parsed = numericValue(next);
        if (parsed !== null) onValueChange(parsed);
      }}
      onBlur={(event) => {
        validate(draftRef.current);
        onBlur?.(event);
      }}
    />
  );
}
