import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { countdown, cn } from "../../../lib/utils";

export function Countdown({
  deadline,
  label,
  compact,
}: {
  deadline: string;
  label?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const value = countdown(deadline, now);
  const urgent = !value.expired && value.days === 0 && value.hours < 1;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        compact ? "text-2xs" : "text-[13px]",
        value.expired ? "text-muted-foreground" : urgent ? "text-destructive" : "text-foreground",
      )}
    >
      <Clock className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <span className="nums font-medium">{compact ? value.shortLabel : value.label}</span>
    </span>
  );
}
