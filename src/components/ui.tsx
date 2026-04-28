import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-11 min-w-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:brightness-105",
        variant === "secondary" &&
          "border bg-card text-card-foreground hover:bg-muted",
        variant === "ghost" && "text-foreground hover:bg-muted",
        variant === "danger" &&
          "bg-destructive text-white shadow-lg shadow-destructive/15 hover:brightness-105",
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = "primary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Link
      className={cn(
        "inline-flex h-11 min-w-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition hover:-translate-y-0.5",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:brightness-105",
        variant === "secondary" &&
          "border bg-card text-card-foreground hover:bg-muted",
        variant === "ghost" && "text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[1.5rem] border bg-card/88 p-4 text-card-foreground shadow-xl shadow-black/5 backdrop-blur sm:rounded-[2rem] sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      <span>{label}</span>
      <input
        className={cn(
          "h-11 w-full min-w-0 rounded-2xl border bg-background px-4 text-sm outline-none transition focus:ring-2 focus:ring-ring",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      <span>{label}</span>
      <select
        className={cn(
          "h-11 w-full min-w-0 rounded-2xl border bg-background px-4 text-sm outline-none transition focus:ring-2 focus:ring-ring",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
