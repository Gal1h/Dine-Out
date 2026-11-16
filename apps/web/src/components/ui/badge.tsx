import type { HTMLAttributes } from "react";
import type { VoteStatus } from "@dineout/shared";
import { cn } from "../../lib/utils";

type Variant = "neutral" | "primary" | "success" | "warning" | "danger" | "outline";

const styles: Record<Variant, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-amber-500/10 text-amber-700",
  danger: "bg-destructive/10 text-destructive",
  outline: "border border-border text-muted-foreground",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

const statusMap: Record<VoteStatus, { label: string; variant: Variant }> = {
  open: { label: "Voting", variant: "warning" },
  ordering: { label: "Isi pesanan", variant: "primary" },
  closed: { label: "Selesai", variant: "neutral" },
};

export function StatusBadge({ status }: { status: VoteStatus }) {
  const info = statusMap[status];
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

const roleMap: Record<string, { label: string; variant: Variant }> = {
  admin: { label: "Admin", variant: "primary" },
  mod: { label: "Mod", variant: "success" },
  member: { label: "Member", variant: "outline" },
};

export function RoleBadge({ role }: { role: string }) {
  const info = roleMap[role] ?? roleMap.member;
  return <Badge variant={info.variant}>{info.label}</Badge>;
}
