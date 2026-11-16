import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bot, ListChecks, Receipt, Sparkles } from "lucide-react";
import type { OrderSummary, SummaryItemInput } from "@dineout/shared";
import { ITEM_TYPE_LABEL } from "@dineout/shared";
import { useVote } from "../../votes/queries";
import { useVoteOrders } from "../../votes/queries";
import {
  useAiSort,
  useSaveAiSummary,
  useSaveManualSummary,
  useSummaries,
} from "../queries";
import { useVoteBills } from "../../bills/queries";
import { useAuth } from "../../auth/use-auth";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/card";
import { EmptyState, LoadingBlock } from "../../../components/ui/feedback";
import { FormError } from "../../../components/ui/form";
import { toast } from "../../../lib/store";
import { errorMessage } from "../../../lib/api";
import { formatDate } from "../../../lib/utils";
import { SummaryEditor, aggregateOrders } from "../components/SummaryEditor";
import { OrdersPanel } from "../../votes/components/OrdersPanel";

type EditorState =
  | { mode: "manual"; items: ReturnType<typeof aggregateOrders> }
  | { mode: "ai"; items: Array<{ itemType: "food" | "drink"; name: string; totalQty: number }>; aiRaw: string }
  | null;

export function SummaryPage() {
  const { voteId } = useParams<{ voteId: string }>();
  const { me } = useAuth();
  const voteQuery = useVote(voteId);
  const canView = voteQuery.data?.role === "admin" || voteQuery.data?.role === "mod";
  const ordersQuery = useVoteOrders(voteId, canView);
  const summariesQuery = useSummaries(voteId, canView);
  const billsQuery = useVoteBills(voteId, canView);

  const manual = useSaveManualSummary(voteId ?? "");
  const ai = useAiSort(voteId ?? "");
  const saveAi = useSaveAiSummary(voteId ?? "");

  const [editor, setEditor] = useState<EditorState>(null);
  const [error, setError] = useState<string | null>(null);

  if (!voteId) return null;
  if (voteQuery.isLoading) return <LoadingBlock label="Memuat rekap" />;
  if (voteQuery.isError || !voteQuery.data) return <FormError>Voting tidak ditemukan.</FormError>;

  const { vote, role } = voteQuery.data;
  const isAdmin = role === "admin";
  const canEdit = isAdmin || role === "mod";

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <Link
          to={`/votes/${vote.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke voting
        </Link>
        <FormError>Hanya admin dan mod yang bisa membuka rekap dan tagihan.</FormError>
      </div>
    );
  }

  const startManual = () => {
    setError(null);
    if (!ordersQuery.data) {
      setError("Data pesanan belum siap. Coba lagi sebentar.");
      return;
    }
    setEditor({ mode: "manual", items: aggregateOrders(ordersQuery.data.orders) });
  };

  const startAi = () => {
    setError(null);
    ai.mutate(undefined, {
      onSuccess: (data) => {
        setEditor({ mode: "ai", items: data.items, aiRaw: data.aiRaw });
        toast("Hasil AI siap direview", { description: "Periksa dan edit sebelum disimpan." });
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };

  const handleSave = (items: SummaryItemInput[]) => {
    if (!editor) return;
    if (editor.mode === "manual") {
      manual.mutate(items, {
        onSuccess: () => {
          toast("Rekap manual disimpan", { variant: "success" });
          setEditor(null);
        },
        onError: (err) => setError(errorMessage(err)),
      });
    } else {
      saveAi.mutate(
        { items, aiRaw: editor.aiRaw },
        {
          onSuccess: () => {
            toast("Rekap AI disimpan", { variant: "success" });
            setEditor(null);
          },
          onError: (err) => setError(errorMessage(err)),
        },
      );
    }
  };

  return (
    <div className="space-y-5">
      <Link
        to={`/votes/${vote.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke voting
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Rekap pesanan</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {vote.storeName} ·{" "}
            <span className="nums">{ordersQuery.data?.orders.length ?? 0} pesanan masuk</span>
            {" · "}
            {vote.status === "closed" ? "voting selesai" : "masih berjalan"}
          </p>
        </div>
        {isAdmin ? (
          <Link to={`/votes/${vote.id}`}>
            <Button variant="outline" size="sm">
              Semua pesanan
            </Button>
          </Link>
        ) : null}
      </div>

      {!canEdit ? <FormError>Hanya admin dan mod yang bisa membuat rekap.</FormError> : null}

      {vote.status === "open" ? (
        <FormError>Voting masih berjalan. Rekap bisa dibuat setelah batas voting lewat.</FormError>
      ) : null}

      {canEdit && vote.status !== "open" ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Buat rekap</CardTitle>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Gabungkan pesanan yang sama, lalu simpan sebagai dasar tagihan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={startManual} disabled={Boolean(editor)}>
                <ListChecks className="h-3.5 w-3.5" /> Sortir manual
              </Button>
              <Button
                size="sm"
                onClick={startAi}
                loading={ai.isPending}
                disabled={Boolean(editor) || !isAdmin}
                title={!isAdmin ? "Hanya admin" : undefined}
              >
                <Bot className="h-3.5 w-3.5" /> Sortir dengan AI
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {isAdmin && !me?.hasGeminiKey ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-[13px] text-muted-foreground">
                  Gemini API key belum diisi. Isi dulu di Pengaturan untuk memakai sortir AI.
                </p>
                <Link to="/profile">
                  <Button size="sm" variant="secondary">
                    <Sparkles className="h-3.5 w-3.5" /> Pengaturan
                  </Button>
                </Link>
              </div>
            ) : null}

            <FormError>{error}</FormError>

            {editor ? (
              <SummaryEditor
                key={editor.mode}
                initialItems={editor.items}
                saving={manual.isPending || saveAi.isPending}
                saveLabel={editor.mode === "ai" ? "Simpan hasil AI" : "Simpan rekap"}
                onCancel={() => setEditor(null)}
                onSave={handleSave}
              />
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Pilih cara sortir. Hasil manual dan hasil AI bisa diedit sebelum disimpan.
              </p>
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Rekap tersimpan</CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Rekap adalah snapshot. Perubahan pesanan setelah rekap tidak mengubah tagihan lama.
          </p>
        </CardHeader>
        <CardBody>
          {summariesQuery.isLoading ? (
            <LoadingBlock label="Memuat rekap" />
          ) : !summariesQuery.data?.summaries.length ? (
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="Belum ada rekap"
              description="Buat rekap manual atau dengan AI setelah voting selesai."
            />
          ) : (
            <div className="space-y-2.5">
              {summariesQuery.data.summaries.map((summary) => (
                <SummaryCard key={summary.id} summary={summary} canBuildBill={isAdmin} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tagihan dibuat</CardTitle>
        </CardHeader>
        <CardBody>
          {billsQuery.data?.bills.length ? (
            <div className="divide-y divide-border rounded-md border border-border">
              {billsQuery.data.bills.map((bill) => (
                <Link
                  key={bill.id}
                  to={`/bills/${bill.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/40"
                >
                  <div>
                    <p className="text-[13px] font-medium">{formatDate(bill.createdAt)}</p>
                    <p className="text-2xs text-muted-foreground">
                      <span className="nums">{bill.totalUsers}</span> anggota
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="nums text-[13px] font-semibold">
                      Rp{bill.totalPayable.toLocaleString("id-ID")}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Belum ada tagihan.</p>
          )}
        </CardBody>
      </Card>

      <OrdersPanel voteId={vote.id} canRecap={false} />
    </div>
  );
}

function SummaryCard({
  summary,
  canBuildBill,
}: {
  summary: OrderSummary;
  canBuildBill: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={summary.source === "gemini" ? "primary" : "neutral"}>
            {summary.source === "gemini" ? "AI" : "Manual"}
          </Badge>
          <span className="text-2xs text-muted-foreground">
            {formatDate(summary.createdAt)}
            {summary.createdByName ? ` · ${summary.createdByName}` : ""}
          </span>
        </div>
        {canBuildBill ? (
          <Link to={`/summaries/${summary.id}/bill`}>
            <Button size="sm" variant="outline">
              Buat tagihan <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {summary.items.map((item) => (
          <span
            key={item.id}
            className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-2xs"
            title={ITEM_TYPE_LABEL[item.itemType]}
          >
            <span className="nums font-semibold">{item.totalQty}×</span> {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}
