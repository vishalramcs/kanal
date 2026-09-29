"use client";
// React Bits <ElasticSlider />, made controlled and keyboard accessible (arrow keys, Home/End).
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion";
import { useRef, useState } from "react";

const MAX_OVERFLOW = 50;

function decay(value, max) {
  if (max === 0) return 0;
  return 2 * (1 / (1 + Math.exp(-value / max)) - 0.5) * max;
}

export default function ElasticSlider({ value, onChange, min = 0, max = 12, step = 0.5, label, format = (v) => v }) {
  const trackRef = useRef(null);
  const [region, setRegion] = useState("middle");
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);
  const clamp = (v) => Math.min(Math.max(Math.round(v / step) * step, min), max);

  useMotionValueEvent(clientX, "change", (latest) => {
    if (!trackRef.current) return;
    const { left, right } = trackRef.current.getBoundingClientRect();
    let over = 0;
    if (latest < left) { setRegion("left"); over = left - latest; }
    else if (latest > right) { setRegion("right"); over = latest - right; }
    else setRegion("middle");
    overflow.jump(decay(over, MAX_OVERFLOW));
  });

  const onPointerMove = (e) => {
    if (e.buttons === 0 || !trackRef.current) return;
    const { left, width } = trackRef.current.getBoundingClientRect();
    onChange(clamp(min + ((e.clientX - left) / width) * (max - min)));
    clientX.jump(e.clientX);
  };
  const onPointerDown = (e) => { onPointerMove(e); e.currentTarget.setPointerCapture(e.pointerId); };
  const release = () => animate(overflow, 0, { type: "spring", bounce: 0.5 });
  const onKeyDown = (e) => {
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
    if (d !== undefined) { e.preventDefault(); onChange(clamp(value + d)); }
    if (e.key === "Home") onChange(min);
    if (e.key === "End") onChange(max);
  };

  const scaleX = useTransform(() => 1 + overflow.get() / (trackRef.current?.getBoundingClientRect().width || 1));
  const scaleY = useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]);
  const origin = useTransform(() => {
    if (!trackRef.current) return "center";
    const { left, width } = trackRef.current.getBoundingClientRect();
    return clientX.get() < left + width / 2 ? "right" : "left";
  });
  const height = useTransform(scale, [1, 1.15], [12, 18]);
  const pct = ((value - min) / (max - min)) * 100;
  const iconBtn = "grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper font-extrabold";

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="font-display text-3xl font-extrabold leading-none" aria-hidden="true">{format(value)}</p>
      <motion.div
        className="flex w-full touch-none select-none items-center gap-3"
        onHoverStart={() => animate(scale, 1.15)} onHoverEnd={() => animate(scale, 1)}
        onTouchStart={() => animate(scale, 1.15)} onTouchEnd={() => animate(scale, 1)}
      >
        <motion.button type="button" className={iconBtn} aria-label={`Less ${label}`} animate={{ scale: region === "left" ? [1, 1.35, 1] : 1 }} onClick={() => onChange(clamp(value - step))}>−</motion.button>
        <div
          ref={trackRef} role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={String(format(value))}
          className="relative flex grow cursor-grab touch-none items-center py-4 active:cursor-grabbing"
          onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onKeyDown={onKeyDown}
        >
          <motion.div className="flex grow" style={{ scaleX, scaleY, transformOrigin: origin, height }}>
            <div className="relative grow overflow-hidden rounded-full border-2 border-ink bg-paper">
              <div className="absolute inset-y-0 left-0 rounded-full bg-cobalt" style={{ width: `${pct}%` }} />
            </div>
          </motion.div>
        </div>
        <motion.button type="button" className={iconBtn} aria-label={`More ${label}`} animate={{ scale: region === "right" ? [1, 1.35, 1] : 1 }} onClick={() => onChange(clamp(value + step))}>+</motion.button>
      </motion.div>
    </div>
  );
}
