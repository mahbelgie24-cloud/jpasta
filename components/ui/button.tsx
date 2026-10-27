import { cn } from "@/lib/utils";

/**
 * Button system — 44px minimum targets (spec §6), pill shape, palette-only.
 * `buttonStyles` is exported for styling <Link> as a button.
 */

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "dark" | "outline-light";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-full font-bold transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-basil-700 text-cream-50 shadow-card hover:bg-basil-600 hover:shadow-lift",
  secondary:
    "border border-cream-300 bg-cream-100 text-basil-800 hover:bg-cream-200",
  ghost: "text-basil-700 hover:bg-basil-50",
  dark: "bg-basil-800 text-cream-50 hover:bg-basil-700",
  "outline-light":
    "border border-cream-50/40 text-cream-50 hover:bg-cream-50/10",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-11 px-6",
  lg: "min-h-13 px-8 text-lg",
};

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles(variant, size, className)}
      {...props}
    />
  );
}
