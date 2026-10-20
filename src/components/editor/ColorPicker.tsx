"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { PALETTE, PALETTE_COLUMNS, colorName, parseHexColor, readableTextOn } from "@/lib/diagram/palette";

const POPOVER_WIDTH = 256;

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  /** Accessible name of the trigger, e.g. "Colour for Microservices". */
  label: string;
  /** Who else uses each colour (lower-case hex → names), so people can avoid picking the same one twice. */
  usedBy?: Map<string, string[]>;
  /** Trigger size: small in the legend list, larger in the details panel. */
  size?: "sm" | "md";
}

/**
 * A swatch that opens a grid of named colours, with a custom colour underneath. Picking a swatch applies
 * it and closes; arrow keys move around the grid, Esc closes.
 */
export default function ColorPicker({ value, onChange, label, usedBy, size = "sm" }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [hexDraft, setHexDraft] = useState(value);
  const [hexInvalid, setHexInvalid] = useState(false);
  const current = value.toLowerCase();
  const selectedIndex = PALETTE.findIndex((color) => color.hex === current);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  // Place it under the trigger (or above, near the bottom of the screen), inside the window.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = popover.current?.offsetHeight ?? 300;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - POPOVER_WIDTH - 8);
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
    setPosition({ left, top });
  }, [open]);

  // Focus the chosen colour (or the first) when it opens; close on a click outside.
  useEffect(() => {
    if (!open) return;
    const buttons = popover.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    buttons?.[selectedIndex >= 0 ? selectedIndex : 0]?.focus();
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!popover.current?.contains(target) && !trigger.current?.contains(target)) close(false);
    }
    // It's placed against the trigger, so scrolling or resizing would leave it behind: close instead.
    function handleMove(event: Event) {
      if (!popover.current?.contains(event.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleMove, true);
    window.addEventListener("resize", handleMove);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleMove, true);
      window.removeEventListener("resize", handleMove);
    };
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: PALETTE_COLUMNS, ArrowUp: -PALETTE_COLUMNS }[event.key];
    const next = step === undefined ? (event.key === "Home" ? 0 : event.key === "End" ? PALETTE.length - 1 : null) : index + step;
    if (next === null || next < 0 || next >= PALETTE.length) return;
    event.preventDefault();
    popover.current?.querySelectorAll<HTMLButtonElement>("[role='radio']")[next]?.focus();
  }

  function commitHex() {
    const parsed = parseHexColor(hexDraft);
    setHexInvalid(!parsed);
    if (parsed) onChange(parsed);
  }

  const sizeClass = size === "sm" ? "h-6 w-6" : "h-8 w-10";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`${label}: ${colorName(value)}`}
        title={`${colorName(value)} — click to change`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${sizeClass} shrink-0 rounded-md border border-black/20 shadow-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-white/20`}
        style={{ backgroundColor: value }}
        onClick={() => {
          setHexDraft(value);
          setHexInvalid(false);
          setOpen((wasOpen) => !wasOpen);
        }}
      />
      {open &&
        createPortal(
          <div
            ref={popover}
            role="dialog"
            aria-label={label}
            className="fixed z-[250] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900"
            style={{ width: POPOVER_WIDTH, left: position?.left ?? -9999, top: position?.top ?? -9999 }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                close();
              }
            }}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Choose a colour</p>
              <p className="truncate text-[11px] text-zinc-500">{colorName(value)}</p>
            </div>
            <div role="radiogroup" aria-label="Colours" className="grid grid-cols-6 gap-1.5">
              {PALETTE.map((color, index) => {
                const selected = color.hex === current;
                const users = usedBy?.get(color.hex) ?? [];
                const description = users.length ? `${color.name}, also used by ${users.join(", ")}` : color.name;
                return (
                  <button
                    key={color.hex}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={description}
                    title={description}
                    tabIndex={index === (selectedIndex >= 0 ? selectedIndex : 0) ? 0 : -1}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-md border border-black/15 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-white/15 ${
                      selected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900" : ""
                    }`}
                    style={{ backgroundColor: color.hex }}
                    onKeyDown={(event) => moveFocus(event, index)}
                    onClick={() => {
                      onChange(color.hex);
                      close();
                    }}
                  >
                    {selected && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke={readableTextOn(color.hex)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {users.length > 0 && !selected && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-zinc-700 dark:border-zinc-900 dark:bg-zinc-200"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {usedBy && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span aria-hidden className="h-2 w-2 rounded-full bg-zinc-700 dark:bg-zinc-200" />
                Already used by another category
              </p>
            )}
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <p className="mb-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Custom colour</p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick any colour"
                  value={parseHexColor(value) ?? "#000000"}
                  onChange={(event) => {
                    setHexDraft(event.target.value);
                    setHexInvalid(false);
                    onChange(event.target.value);
                  }}
                  className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
                />
                <input
                  aria-label="Colour code"
                  aria-invalid={hexInvalid}
                  placeholder="#1f7a4d"
                  value={hexDraft}
                  spellCheck={false}
                  onChange={(event) => setHexDraft(event.target.value)}
                  onBlur={commitHex}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitHex();
                  }}
                  className={`h-8 min-w-0 flex-1 rounded-md border bg-white px-2 font-mono text-sm outline-none focus:ring-2 dark:bg-zinc-950 ${
                    hexInvalid
                      ? "border-red-400 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700"
                  }`}
                />
              </div>
              {hexInvalid && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">Use a code like #1f7a4d or #abc.</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
