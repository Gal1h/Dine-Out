import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList } from "lucide-react";
import { ITEM_TYPE_LABEL, type ItemType } from "@dineout/shared";
import { useVoteOrders } from "../queries";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/card";
import { EmptyState, LoadingBlock } from "../../../components/ui/feedback";
import { formatDateShort, initials } from "../../../lib/utils";

export function OrdersPanel({ voteId, canRecap }: { voteId: string; canRecap: boolean }) {
  const query = useVoteOrders(voteId);

  if (query.isLoading) return <LoadingBlock label="Memuat pesanan masuk" />;
  if (query.isError || !query.data) return null;

  const { orders, notOrdered, totals } = query.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> Pesanan masuk
          </CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            <span className="nums">{totals.people} orang</span> sudah mengisi ·{" "}
            <span className="nums">{totals.foodItems}</span> makanan ·{" "}
            <span className="nums">{totals.drinkItems}</span> minuman
          </p>
        </div>
        {canRecap ? (
          <Link to={`/votes/${voteId}/summary`}>
            <Button variant="outline" size="sm">
              Rekap <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        ) : null}
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Belum pesan · {notOrdered.length}
          </p>
          {notOrdered.length === 0 ? (
            <p className="text-[13px] text-success">Semua anggota sudah mengisi pesanan.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {notOrdered.map((member) => (
                <Badge key={member.userId} variant="warning" className="normal-case tracking-normal">
                  {member.displayName}
                  {member.username ? ` · @${member.username}` : ""}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title="Belum ada pesanan"
            description="Pesanan akan tampil di sini begitu anggota menyimpan form."
          />
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {orders.map((order) => (
              <div key={order.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
                      {initials(order.displayName)}
                    </span>
                    <span className="text-[13px] font-medium">{order.displayName}</span>
                    {order.username ? (
                      <span className="text-2xs text-muted-foreground">@{order.username}</span>
                    ) : null}
                  </div>
                  <span className="text-2xs text-muted-foreground">{formatDateShort(order.updatedAt)}</span>
                </div>
                <div className="mt-1.5 space-y-0.5 pl-8">
                  {(["food", "drink"] as ItemType[]).map((type) => {
                    const items = order.items.filter((i) => i.itemType === type);
                    if (items.length === 0) return null;
                    return (
                      <div key={type} className="text-[13px] leading-snug">
                        <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                          {ITEM_TYPE_LABEL[type]}:
                        </span>{" "}
                        {items.map((item, index) => (
                          <span key={item.id}>
                            <span className="nums font-medium">{item.qty}×</span> {item.name}
                            {item.note ? (
                              <span className="text-muted-foreground"> ({item.note})</span>
                            ) : null}
                            {index < items.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
