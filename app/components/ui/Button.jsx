import Link from "next/link";

const VARIANTS = {
  sun: "bg-sun text-ink",
  cobalt: "bg-cobalt text-cream",
  paper: "bg-paper text-ink",
  ink: "bg-ink text-cream",
  bubble: "bg-bubble text-ink",
};
const SIZES = {
  sm: "min-h-9 px-3.5 text-sm gap-1.5 shadow-hard-sm",
  md: "min-h-11 px-5 text-[15px] gap-2 shadow-hard",
  lg: "min-h-14 px-7 text-lg gap-2.5 shadow-hard",
};

/** Pressable button: hard offset shadow, lifts on hover, presses flat on click. Renders a Link when `href` is set. */
export default function Button({ variant = "paper", size = "md", href, className = "", children, ...props }) {
  const cls = [
    "inline-flex items-center justify-center rounded-full border-2 border-ink font-extrabold whitespace-nowrap",
    "transition-[transform,box-shadow] duration-[120ms] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg",
    "active:translate-x-1 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  ].join(" ");
  if (href) return <Link href={href} className={cls} {...props}>{children}</Link>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}
