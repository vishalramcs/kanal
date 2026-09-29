/** Wavy section edge. `fill` is the colour of the section it belongs to; place it after (or flip before) the section. */
export default function Wave({ fill = "var(--color-sun)", flip = false, className = "" }) {
  return (
    <svg
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`block h-10 w-full sm:h-[60px] ${flip ? "-scale-y-100" : ""} ${className}`}
    >
      <path d="M0,0 H1440 V24 C1080,72 360,-24 0,38 Z" fill={fill} />
    </svg>
  );
}
