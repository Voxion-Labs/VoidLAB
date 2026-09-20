import { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  label: string;
};

export function Input({ className, icon, label, ...props }: InputProps) {
  return (
    <label className="block">
      <span className="theme-muted mb-2 block text-sm">{label}</span>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 theme-muted">
            {icon}
          </span>
        ) : null}
        <input
          className={cn(
            "theme-input w-full rounded-[6px] px-4 py-3 outline-none transition",
            icon ? "pl-11" : "",
            className,
          )}
          {...props}
        />
      </div>
    </label>
  );
}
