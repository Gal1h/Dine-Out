import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ExternalLink,
  MapPin,
  Pencil,
  ReceiptText,
  Utensils,
} from "lucide-react";
import { ITEM_TYPE_LABEL } from "@dineout/shared";
import { useMyOrder, useVote } from "../queries";
import { Badge, StatusBadge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/card";
import { LoadingBlock } from "../../../components/ui/feedback";
import { FormError } from "../../../components/ui/form";
import { formatDate, hostOf } from "../../../lib/utils";
import { Countdown } from "../components/Countdown";
import { OrderForm } from "../components/OrderForm";
import { OrdersPanel } from "../components/OrdersPanel";
import { useQueryClient } from "@tanstack/react-query";

export function VoteDetailPage() {
  const { voteId } = useParams<{ voteId: string }>();
  const queryClient = useQueryClient();
  const voteQuery = useVote(voteId);
  const myOrder = useMyOrder(voteId);

  if (!voteId) return null;
  if (voteQuery.isLoading) return <LoadingBlock label="Memuat voting" />;
  if (voteQuery.isError || !voteQuery.data) {
    return <FormError>Voting tidak ditemukan atau Anda tidak punya akses.</FormError>;
  }

  const { vote, role } = voteQuery.data;
  const canManage = role === "admin" || role === "mod";
  const isAdmin = role === "admin";

  return (
    <div className="space-y-5">
      <Link
        to={`/groups/${vote.groupId}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke grup
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{vote.storeName}</h1>
            <StatusBadge status={vote.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <a
              href={vote.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" /> {hostOf(vote.mapsUrl)}
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> Voting: {formatDate(vote.voteDeadline)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Utensils className="h-3.5 w-3.5" /> Pesanan: {formatDate(vote.orderDeadline)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage && vote.status === "open" ? (
            <Link to={`/votes/${vote.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
          ) : null}
          {canManage && vote.status !== "open" ? (
            <Link to={`/votes/${vote.id}/summary`}>
              <Button variant="outline" size="sm">
                <ReceiptText className="h-3.5 w-3.5" /> Rekap & tagihan
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardBody className="space-y-2 p-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              {vote.status === "open" ? "Sisa waktu voting" : vote.status === "ordering" ? "Sisa waktu isi form" : "Status"}
            </p>
            {vote.status === "closed" ? (
              <p className="text-lg font-semibold">Voting selesai</p>
            ) : (
              <p className="nums text-lg font-semibold">
                {vote.status === "open" ? (
                  <Countdown deadline={vote.voteDeadline} />
                ) : (
                  <Countdown deadline={vote.orderDeadline} />
                )}
              </p>
            )}
            <p className="text-2xs text-muted-foreground">
              {vote.status === "open"
                ? "Form pesanan dibuka setelah batas voting lewat."
                : vote.status === "ordering"
                  ? "Pesanan bisa diubah sampai batas isi form."
                  : "Pesanan dan tagihan sudah dikunci."}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Pesanan masuk</p>
              <p className="nums mt-1 text-lg font-semibold">{vote.orderCount ?? 0}</p>
              <p className="text-2xs text-muted-foreground">
                {vote.hasMyOrder ? "Pesanan Anda sudah tersimpan" : "Anda belum mengisi pesanan"}
              </p>
            </div>
            {vote.orderCount && canManage ? (
              <Link to={`/votes/${vote.id}/summary`}>
                <Button size="sm" variant="secondary">
                  Lihat rekap <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Menu</CardTitle>
          <a href={vote.mapsUrl} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">
              Buka Maps <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </CardHeader>
        <CardBody className="space-y-3">
          {vote.menuImageUrl ? (
            <a href={vote.menuImageUrl} target="_blank" rel="noreferrer" className="block">
              <img
                src={vote.menuImageUrl}
                alt={`Menu ${vote.storeName}`}
                className="max-h-96 w-full rounded-md border border-border bg-muted/30 object-contain"
              />
            </a>
          ) : null}
          {vote.menuText ? (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-sans text-[13px] leading-relaxed text-foreground">
              {vote.menuText}
            </pre>
          ) : null}
          {!vote.menuImageUrl && !vote.menuText ? (
            <p className="text-[13px] text-muted-foreground">Belum ada menu.</p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form pesanan</CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {vote.status === "open"
              ? "Form dibuka setelah batas voting lewat."
              : vote.status === "ordering"
                ? "Tulis nama item sesuai menu, atur jumlah, dan tambahkan catatan bila perlu."
                : "Batas isi form sudah lewat. Pesanan terkunci."}
          </p>
        </CardHeader>
        <CardBody>
          {vote.status === "open" ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
              <p className="text-[13px] font-medium">Voting masih berjalan</p>
              <p className="mt-1 text-2xs text-muted-foreground">
                Form pesanan terbuka setelah {formatDate(vote.voteDeadline)}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrder.data?.order && vote.status === "closed" ? (
                <div className="rounded-md border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-[13px] font-semibold">Pesanan Anda</span>
                    <Badge variant="outline">{formatDate(myOrder.data.order.updatedAt)}</Badge>
                  </div>
                  <div className="divide-y divide-border">
                    {(["food", "drink"] as const).map((type) => {
                      const items = myOrder.data.order?.items.filter((i) => i.itemType === type) ?? [];
                      if (items.length === 0) return null;
                      return (
                        <div key={type} className="px-3 py-2">
                          <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                            {ITEM_TYPE_LABEL[type]}
                          </p>
                          <ul className="mt-1 space-y-0.5 text-[13px]">
                            {items.map((item) => (
                              <li key={item.id}>
                                <span className="nums font-medium">{item.qty}×</span> {item.name}
                                {item.note ? (
                                  <span className="text-muted-foreground"> — {item.note}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <OrderForm
                  voteId={vote.id}
                  myOrder={myOrder.data}
                  disabled={vote.status !== "ordering"}
                  onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ["vote", vote.id] });
                    queryClient.invalidateQueries({ queryKey: ["vote", vote.id, "orders"] });
                  }}
                />
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {canManage ? <OrdersPanel voteId={vote.id} canRecap={isAdmin || canManage} /> : null}
    </div>
  );
}
