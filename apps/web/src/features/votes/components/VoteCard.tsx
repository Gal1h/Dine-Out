import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, MapPin, Utensils } from "lucide-react";
import type { VoteSummary } from "@dineout/shared";
import { StatusBadge } from "../../../components/ui/badge";
import { formatDateShort, hostOf } from "../../../lib/utils";
import { Countdown } from "./Countdown";

export function VoteCard({ vote }: { vote: VoteSummary }) {
  const deadline = vote.status === "open" ? vote.voteDeadline : vote.orderDeadline;

  return (
    <Link
      to={`/votes/${vote.id}`}
      className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/25"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{vote.storeName}</h3>
            <StatusBadge status={vote.status} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{hostOf(vote.mapsUrl)}</span>
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" /> Voting: {formatDateShort(vote.voteDeadline)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Utensils className="h-3 w-3" /> Pesanan: {formatDateShort(vote.orderDeadline)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        {vote.status === "closed" ? (
          <span className="text-2xs text-muted-foreground">Voting selesai</span>
        ) : (
          <Countdown
            deadline={deadline}
            label={vote.status === "open" ? "Sisa voting" : "Sisa form"}
            compact
          />
        )}
        <div className="flex items-center gap-2 text-2xs">
          {vote.hasMyOrder ? (
            <span className="whitespace-nowrap font-medium text-success">Pesanan terkirim</span>
          ) : vote.status !== "open" ? (
            <span className="whitespace-nowrap font-medium text-primary">Belum pesan</span>
          ) : null}
          {typeof vote.orderCount === "number" ? (
            <span className="nums whitespace-nowrap text-muted-foreground">
              {vote.orderCount} pesanan
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
