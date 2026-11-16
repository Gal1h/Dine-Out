import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore } from "../../lib/store";
import { cn } from "../../lib/utils";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end">
      {toasts.map((item) => {
        const Icon =
          item.variant === "success" ? CheckCircle2 : item.variant === "error" ? XCircle : Info;
        return (
          <div
            key={item.id}
            className={cn(
              "animate-fade-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-sm shadow-pop",
              item.variant === "error"
                ? "border-destructive/30"
                : item.variant === "success"
                  ? "border-success/30"
                  : "border-border",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                item.variant === "error"
                  ? "text-destructive"
                  : item.variant === "success"
                    ? "text-success"
                    : "text-primary",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Tutup notifikasi"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
