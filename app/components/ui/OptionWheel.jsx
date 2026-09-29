"use client";
// React Bits <OptionWheel /> (sound removed). Scroll, drag, click or use arrow keys.
import { useCallback, useEffect, useRef, useState } from "react";

export default function OptionWheel({
  items,
  defaultSelected = 0,
  onChange,
  label = "Options",
  textColor = "#8e8aa8",
  activeColor = "#ffffff",
  fontSize = 1.7,
  spacing = 1.4,
  curve = 1,
  tilt = 8,
  blur = 1.5,
  fade = 0.3,
  minOpacity = 0.05,
  smoothing = 160,
  inset = 28,
}) {
  const rootRef = useRef(null);
  const itemRefs = useRef([]);
  const posRef = useRef(defaultSelected);
  const targetRef = useRef(defaultSelected);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const cfgRef = useRef({});
  const onChangeRef = useRef(onChange);
  const selectedRef = useRef(defaultSelected);
  const wheelTimerRef = useRef(null);
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [selected, setSelected] = useState(defaultSelected);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    onChangeRef.current = onChange;
    cfgRef.current = { count: items.length, items, rowH: Math.max(fontSize * spacing * remPx, 1), curve, tilt, blur, fade, minOpacity, smoothing };
  });

  // One rAF loop eases toward the target and lays each option out along the curve.
  const runFrame = useCallback((now) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const cfg = cfgRef.current;
    const k = 1 - Math.exp(-dt / (Math.max(cfg.smoothing, 1) / 1000));
    let next = posRef.current + (targetRef.current - posRef.current) * k;
    const settled = Math.abs(targetRef.current - next) < 0.001;
    if (settled) next = targetRef.current;
    posRef.current = next;
    const tiltRad = (cfg.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;
    for (let i = 0; i < cfg.count; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const d = i - next;
      const dist = Math.abs(d);
      let x = 0;
      let y = d * cfg.rowH;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        y = R * Math.sin(ang);
        x = -R * (1 - Math.cos(ang)) * cfg.curve;
        rot = (ang * 180) / Math.PI;
      }
      el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
      el.style.filter = cfg.blur > 0 ? `blur(${(dist * cfg.blur).toFixed(2)}px)` : "none";
      el.style.setProperty("--ow-p", Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
    }
    rafRef.current = settled ? null : requestAnimationFrame(runFrame);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const applyTarget = useCallback((value, snap) => {
    const cfg = cfgRef.current;
    let v = Math.min(Math.max(value, 0), Math.max(cfg.count - 1, 0));
    if (snap) v = Math.round(v);
    targetRef.current = v;
    const idx = Math.round(v);
    if (idx !== selectedRef.current) {
      selectedRef.current = idx;
      setSelected(idx);
      onChangeRef.current?.(idx, cfg.items[idx]);
    }
    startLoop();
  }, [startLoop]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      applyTarget(targetRef.current + Math.max(-1, Math.min(1, delta / cfgRef.current.rowH)), false);
      clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => applyTarget(targetRef.current, true), 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); clearTimeout(wheelTimerRef.current); };
  }, [applyTarget]);

  useEffect(() => { applyTarget(targetRef.current, false); }, [items, applyTarget]);
  useEffect(() => () => rafRef.current != null && cancelAnimationFrame(rafRef.current), []);

  const onPointerDown = (e) => {
    dragRef.current = { y: e.clientY, start: targetRef.current, id: e.pointerId };
    dragMovedRef.current = false;
    setDragging(true);
  };
  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!dragMovedRef.current && Math.abs(dy) > 4) {
      dragMovedRef.current = true;
      rootRef.current?.setPointerCapture(drag.id);
    }
    if (dragMovedRef.current) applyTarget(drag.start - dy / cfgRef.current.rowH, false);
  };
  const onPointerEnd = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (dragMovedRef.current) applyTarget(targetRef.current, true);
  };
  const onKeyDown = (e) => {
    const delta = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    applyTarget(Math.round(targetRef.current) + delta, true);
  };

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`ow-${label}-${selected}`}
      className={`option-wheel${dragging ? " option-wheel--dragging" : ""}`}
      style={{ "--ow-text-color": textColor, "--ow-active-color": activeColor, "--ow-font-size": `${fontSize}rem`, "--ow-inset": `${inset}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      {items.map((text, index) => (
        <div
          key={text}
          id={`ow-${label}-${index}`}
          ref={(el) => { itemRefs.current[index] = el; }}
          role="option"
          aria-selected={selected === index}
          className={`option-wheel__item${selected === index ? " option-wheel__item--selected" : ""}`}
          onClick={() => !dragMovedRef.current && applyTarget(index, true)}
        >
          {text}
        </div>
      ))}
    </div>
  );
}
