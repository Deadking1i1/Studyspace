"use client";

import { useEffect, useRef, useState } from "react";

const MIN_WIDTH = 208;
const MAX_WIDTH = 380;
const DEFAULT_WIDTH = 252;
const STORAGE_KEY = "study-space-sidebar-width";

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export function ResizableSidebar({ children }: Readonly<{ children: React.ReactNode }>) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const widthRef = useRef(DEFAULT_WIDTH);

  function applyWidth(nextWidth: number, persist = false) {
    const clampedWidth = clampWidth(nextWidth);
    widthRef.current = clampedWidth;
    setWidth(clampedWidth);
    document.documentElement.style.setProperty("--study-sidebar-width", `${clampedWidth}px`);
    if (persist) localStorage.setItem(STORAGE_KEY, String(clampedWidth));
  }

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(storedWidth)) applyWidth(storedWidth);
  }, []);

  function beginResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (window.matchMedia("(max-width: 960px)").matches) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = widthRef.current;

    const move = (pointerEvent: PointerEvent) => applyWidth(startWidth + pointerEvent.clientX - startX);
    const end = () => {
      applyWidth(widthRef.current, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function resizeWithKeyboard(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      applyWidth(event.key === "Home" ? MIN_WIDTH : MAX_WIDTH, true);
      return;
    }
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    applyWidth(widthRef.current + direction * (event.shiftKey ? 24 : 12), true);
  }

  return (
    <>
      <aside className="sidebar" id="study-space-sidebar">{children}</aside>
      <button
        aria-controls="study-space-sidebar"
        aria-label="Resize navigation"
        aria-orientation="vertical"
        aria-valuemax={MAX_WIDTH}
        aria-valuemin={MIN_WIDTH}
        aria-valuenow={width}
        aria-valuetext={`${width} pixels wide`}
        className="sidebar-resize-handle"
        onKeyDown={resizeWithKeyboard}
        onPointerDown={beginResize}
        role="separator"
        title="Drag to resize navigation"
        type="button"
      >
        <span aria-hidden="true" />
      </button>
    </>
  );
}
