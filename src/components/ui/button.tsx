import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "primary" | "secondary";
};

export function Button({
  children,
  className,
  tone = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[6px] px-4 py-2.5 text-sm font-medium transition duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-60",
        tone === "primary"
          ? "theme-button-primary"
          : "theme-button-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
