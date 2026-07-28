"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../button/button";
import { IconButton } from "../icon-button/icon-button";

const PALETTE = [
  "#3f654f",
  "#5278d9",
  "#7357b5",
  "#a65383",
  "#b34f48",
  "#c26a32",
  "#b08a32",
  "#5f7f3e",
  "#33817a",
  "#4d6f8f",
  "#6b6f76",
  "#252925",
];

export const normalizeHexColor = (value: string): string | null => {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    return `#${withHash
      .slice(1)
      .split("")
      .map((character) => character.repeat(2))
      .join("")
      .toUpperCase()}`;
  }
  return null;
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const saturationUnit = saturation / 100;
  const lightnessUnit = lightness / 100;
  const chroma =
    (1 - Math.abs(2 * lightnessUnit - 1)) * saturationUnit;
  const part = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightnessUnit - chroma / 2;
  const [red, green, blue] =
    hue < 60
      ? [chroma, part, 0]
      : hue < 120
        ? [part, chroma, 0]
        : hue < 180
          ? [0, chroma, part]
          : hue < 240
            ? [0, part, chroma]
            : hue < 300
              ? [part, 0, chroma]
              : [chroma, 0, part];
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
};

export function ColorPicker({
  value,
  onChange,
  label = "Цвет",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const normalizedValue = normalizeHexColor(value) ?? "#3F654F";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(normalizedValue);
  const [hexDraft, setHexDraft] = useState(normalizedValue);
  const [hue, setHue] = useState(140);
  const shades = useMemo(
    () =>
      [32, 43, 54, 65, 76].map((lightness) =>
        hslToHex(hue, 42, lightness),
      ),
    [hue],
  );
  const validHex = normalizeHexColor(hexDraft);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const choose = (color: string) => {
    setDraft(color);
    setHexDraft(color);
  };
  const openPicker = () => {
    setDraft(normalizedValue);
    setHexDraft(normalizedValue);
    setOpen(true);
  };

  return (
    <div className="color-picker-field">
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="color-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        <i style={{ background: normalizedValue }} />
        <span>{normalizedValue}</span>
      </button>
      {open && (
        <div
          className="color-picker-backdrop"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="color-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Выбор цвета"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <strong>Выберите цвет</strong>
              <IconButton
                icon="x"
                size="small"
                label="Закрыть выбор цвета"
                onClick={() => setOpen(false)}
              />
            </header>
            <div className="color-current">
              <i style={{ background: draft }} />
              <strong>{draft}</strong>
            </div>
            <div className="color-palette" aria-label="Палитра">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={draft === color.toUpperCase() ? "selected" : ""}
                  style={{ background: color }}
                  aria-label={`Выбрать ${color}`}
                  onClick={() => choose(color.toUpperCase())}
                />
              ))}
            </div>
            <label className="hue-control">
              <span>Оттенок</span>
              <input
                type="range"
                min="0"
                max="359"
                value={hue}
                onChange={(event) => setHue(Number(event.target.value))}
              />
            </label>
            <div className="color-shades" aria-label="Оттенки цвета">
              {shades.map((color) => (
                <button
                  key={color}
                  type="button"
                  style={{ background: color }}
                  aria-label={`Выбрать ${color}`}
                  onClick={() => choose(color)}
                />
              ))}
            </div>
            <label className="hex-control">
              <span>HEX</span>
              <input
                value={hexDraft}
                spellCheck={false}
                aria-invalid={!validHex}
                onChange={(event) => {
                  const next = event.target.value;
                  setHexDraft(next);
                  const normalized = normalizeHexColor(next);
                  if (normalized) setDraft(normalized);
                }}
              />
              {!validHex && <small>Введите 3 или 6 HEX-символов</small>}
            </label>
            <footer>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                disabled={!validHex}
                onClick={() => {
                  if (!validHex) return;
                  onChange(validHex);
                  setOpen(false);
                }}
              >
                Выбрать
              </Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
