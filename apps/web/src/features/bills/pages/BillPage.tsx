import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Download, Receipt, Sparkles, UsersRound } from "lucide-react";
import { toPng } from "html-to-image";
import {
  ITEM_TYPE_LABEL,
  normalizeItemName,
  type BillResponse,
  type ItemType,
} from "@dineout/shared";
import { useSummary } from "../../summaries/queries";
import { useVoteOrders } from "../../votes/queries";
import { useBill, useCreateBill } from "../queries";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/card";
import { Field, FormError, Input } from "../../../components/ui/form";
import { EmptyState, LoadingBlock } from "../../../components/ui/feedback";
import { errorMessage } from "../../../lib/api";
import { toast } from "../../../lib/store";
import { cn, copyText, formatDate, formatRupiah } from "../../../lib/utils";

export function BillPage() {
  const { summaryId, billId } = useParams<{ summaryId?: string; billId?: string }>();
  if (billId) return <BillDetail billId={billId} />;
  if (summaryId) return <BillBuilder summaryId={summaryId} />;
  return null;
}

/* ------------------------------------------------------------------ builder */

interface PriceRow {
  key: string;
  itemType: ItemType;
  name: string;
  price: number;
  extra?: boolean;
}

function BillBuilder({ summaryId }: { summaryId: string }) {
  const navigate = useNavigate();
  const summaryQuery = useSummary(summaryId);
  const voteId = summaryQuery.data?.voteId;
  const ordersQuery = useVoteOrders(voteId);
  const createBill = useCreateBill(summaryId);

  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [subsidies, setSubsidies] = useState<Record<string, { food: string; drink: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const summary = summaryQuery.data?.summary;

  useEffect(() => {
    if (!summary || initialized) return;
    const base: PriceRow[] = summary.items.map((item) => ({
      key: item.id,
      itemType: item.itemType,
      name: item.name,
      price: 0,
    }));

    const covered = (itemType: ItemType, name: string) => {
      const target = normalizeItemName(name);
      return base.some((row) => {
        if (row.itemType !== itemType) return false;
        const current = normalizeItemName(row.name);
        return current === target || current.includes(target) || target.includes(current);
      });
    };

    const extras = new Map<string, PriceRow>();
    for (const order of ordersQuery.data?.orders ?? []) {
      for (const item of order.items) {
        if (covered(item.itemType, item.name)) continue;
        const key = `${item.itemType}|${normalizeItemName(item.name)}`;
        if (!extras.has(key)) {
          extras.set(key, {
            key,
            itemType: item.itemType,
            name: item.name,
            price: 0,
            extra: true,
          });
        }
      }
    }
    setPrices([...base, ...extras.values()]);
    setInitialized(true);
  }, [summary, ordersQuery.data, initialized]);

  useEffect(() => {
    if (!ordersQuery.data) return;
    setSubsidies((prev) => {
      const next = { ...prev };
      for (const order of ordersQuery.data.orders) {
        if (!next[order.userId]) next[order.userId] = { food: "", drink: "" };
      }
      return next;
    });
  }, [ordersQuery.data]);

  const updatePrice = (key: string, price: number) => {
    setPrices((prev) => prev.map((row) => (row.key === key ? { ...row, price } : row)));
  };

  const updateSubsidy = (userId: string, type: "food" | "drink", value: string) => {
    setSubsidies((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? { food: "", drink: "" }), [type]: value },
    }));
  };

  const submit = () => {
    setError(null);
    if (prices.some((row) => row.price < 0 || !Number.isFinite(row.price))) {
      setError("Harga tidak valid");
      return;
    }
    const payload = {
      prices: prices.map((row) => ({
        itemType: row.itemType,
        name: row.name,
        price: Math.trunc(row.price),
      })),
      subsidies: (ordersQuery.data?.orders ?? []).map((order) => ({
        userId: order.userId,
        foodSubsidy: Math.max(0, Math.trunc(Number(subsidies[order.userId]?.food ?? 0) || 0)),
        drinkSubsidy: Math.max(0, Math.trunc(Number(subsidies[order.userId]?.drink ?? 0) || 0)),
      })),
    };

    createBill.mutate(payload, {
      onSuccess: (data) => {
        toast("Tagihan dibuat", { variant: "success" });
        navigate(`/bills/${data.bill.id}`);
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };

  if (summaryQuery.isLoading) return <LoadingBlock label="Memuat rekap" />;
  if (summaryQuery.isError || !summary) return <FormError>Rekap tidak ditemukan.</FormError>;

  return (
    <div className="space-y-5">
      <Link
        to={`/votes/${summary.voteId}/summary`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke rekap
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Receipt className="h-5 w-5 text-primary" /> Buat tagihan
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Isi harga per item, lalu subsidi per anggota. Subsidi makanan hanya mengurangi total
          makanan; sisa subsidi hangus.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Harga item</CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            <span className="nums">{prices.length}</span> item dari rekap {summary.source === "gemini" ? "AI" : "manual"}.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          {(["food", "drink"] as ItemType[]).map((type) => {
            const rows = prices.filter((row) => row.itemType === type);
            if (rows.length === 0) return null;
            return (
              <div key={type} className="rounded-md border border-border">
                <div className="border-b border-border px-3 py-2 text-[13px] font-semibold">
                  {ITEM_TYPE_LABEL[type]}
                </div>
                <div className="divide-y divide-border">
                  {rows.map((row) => (
                    <div key={row.key} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">{row.name}</p>
                        {row.extra ? (
                          <p className="text-2xs text-amber-700">Ditambahkan dari pesanan mentah</p>
                        ) : null}
                      </div>
                      <div className="relative w-36 shrink-0">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground">
                          Rp
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={500}
                          inputMode="numeric"
                          className="nums h-9 pl-7 text-right"
                          value={row.price || ""}
                          placeholder="0"
                          onChange={(event) =>
                            updatePrice(row.key, Math.max(0, Math.trunc(Number(event.target.value) || 0)))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {prices.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Rekap tidak punya item.</p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subsidi per anggota</CardTitle>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Kosongkan bila tidak ada subsidi. Maksimal sebesar total kategorinya.
          </p>
        </CardHeader>
        <CardBody>
          {ordersQuery.isLoading ? (
            <LoadingBlock label="Memuat anggota" />
          ) : !ordersQuery.data?.orders.length ? (
            <EmptyState title="Belum ada pesanan" description="Tagihan butuh pesanan anggota." />
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {ordersQuery.data.orders.map((order) => (
                <div key={order.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_130px_130px] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{order.displayName}</p>
                    <p className="text-2xs text-muted-foreground">
                      {order.items.length} item pesanan
                    </p>
                  </div>
                  <Field label="Subsidi makanan">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      inputMode="numeric"
                      className="nums h-9 text-right"
                      placeholder="0"
                      value={subsidies[order.userId]?.food ?? ""}
                      onChange={(event) => updateSubsidy(order.userId, "food", event.target.value)}
                    />
                  </Field>
                  <Field label="Subsidi minuman">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      inputMode="numeric"
                      className="nums h-9 text-right"
                      placeholder="0"
                      value={subsidies[order.userId]?.drink ?? ""}
                      onChange={(event) => updateSubsidy(order.userId, "drink", event.target.value)}
                    />
                  </Field>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <FormError>{error}</FormError>

      <div className="flex justify-end gap-2">
        <Link to={`/votes/${summary.voteId}/summary`}>
          <Button variant="outline">Batal</Button>
        </Link>
        <Button onClick={submit} loading={createBill.isPending} disabled={prices.length === 0}>
          <Sparkles className="h-4 w-4" /> Hitung tagihan
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- detail */

function BillDetail({ billId }: { billId: string }) {
  const query = useBill(billId);
  const captureRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const bill = query.data?.bill;

  const text = useMemo(() => (bill ? billToText(bill) : ""), [bill]);

  if (query.isLoading) return <LoadingBlock label="Memuat tagihan" />;
  if (query.isError || !bill) return <FormError>Tagihan tidak ditemukan.</FormError>;

  const handleCopy = async () => {
    await copyText(text);
    setCopied(true);
    toast("Tagihan disalin", { variant: "success" });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!captureRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `tagihan-${bill.storeName.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast("Gagal membuat gambar", { variant: "error" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link
        to={`/votes/${bill.voteId}/summary`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke rekap
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Receipt className="h-5 w-5 text-primary" /> Tagihan
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {bill.storeName} · {formatDate(bill.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Tersalin" : "Salin teks"}
          </Button>
          <Button size="sm" onClick={handleDownload} loading={downloading}>
            <Download className="h-3.5 w-3.5" /> Unduh gambar
          </Button>
        </div>
      </div>

      {bill.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[13px] text-amber-800">
          <p className="font-medium">Catatan perhitungan</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {bill.warnings.map((warning, index) => (
              <li key={index}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div ref={captureRef} className="space-y-4 bg-white p-1">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-2xs uppercase tracking-[0.14em] text-primary">DineOut</p>
              <p className="text-base font-semibold tracking-tight">{bill.storeName}</p>
            </div>
            <div className="text-right">
              <p className="text-2xs text-muted-foreground">Total tagihan</p>
              <p className="nums text-lg font-semibold">{formatRupiah(bill.totals.payable)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-2xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Anggota</th>
                  <th className="px-2 py-2 text-right font-medium">Makanan</th>
                  <th className="px-2 py-2 text-right font-medium">Subsidi</th>
                  <th className="px-2 py-2 text-right font-medium">Bayar</th>
                  <th className="px-2 py-2 text-right font-medium">Minuman</th>
                  <th className="px-2 py-2 text-right font-medium">Subsidi</th>
                  <th className="px-2 py-2 text-right font-medium">Bayar</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.users.map((user) => (
                  <tr key={user.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{user.displayName}</p>
                      {user.username ? (
                        <p className="text-2xs text-muted-foreground">@{user.username}</p>
                      ) : null}
                    </td>
                    <td className="nums px-2 py-2.5 text-right">{formatRupiah(user.foodTotal)}</td>
                    <td
                      className={cn(
                        "nums px-2 py-2.5 text-right",
                        user.foodSubsidy > 0 ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {user.foodSubsidy > 0 ? `−${formatRupiah(user.foodSubsidy)}` : "—"}
                    </td>
                    <td className="nums px-2 py-2.5 text-right">{formatRupiah(user.foodPayable)}</td>
                    <td className="nums px-2 py-2.5 text-right">{formatRupiah(user.drinkTotal)}</td>
                    <td
                      className={cn(
                        "nums px-2 py-2.5 text-right",
                        user.drinkSubsidy > 0 ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {user.drinkSubsidy > 0 ? `−${formatRupiah(user.drinkSubsidy)}` : "—"}
                    </td>
                    <td className="nums px-2 py-2.5 text-right">{formatRupiah(user.drinkPayable)}</td>
                    <td className="nums px-4 py-2.5 text-right font-semibold">
                      {formatRupiah(user.payable)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40 text-[13px]">
                  <td className="px-4 py-2.5 font-semibold">Total</td>
                  <td className="nums px-2 py-2.5 text-right">{formatRupiah(bill.totals.food)}</td>
                  <td className="nums px-2 py-2.5 text-right text-success">
                    −{formatRupiah(bill.users.reduce((s, u) => s + u.foodSubsidy, 0))}
                  </td>
                  <td colSpan={2} />
                  <td className="nums px-2 py-2.5 text-right text-success">
                    −{formatRupiah(bill.users.reduce((s, u) => s + u.drinkSubsidy, 0))}
                  </td>
                  <td />
                  <td className="nums px-4 py-2.5 text-right font-semibold">
                    {formatRupiah(bill.totals.payable)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-2xs text-muted-foreground">
            <UsersRound className="h-3 w-3" /> <span className="nums">{bill.users.length}</span> anggota ·
            <span> subsidi tidak berpindah kategori</span>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Harga item</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-1.5">
          {bill.prices.map((price) => (
            <Badge key={price.id} variant="outline" className="normal-case tracking-normal">
              {price.name} · {formatRupiah(price.price)}
            </Badge>
          ))}
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleCopy}>
          <Copy className="h-4 w-4" /> Salin tagihan sebagai teks
        </Button>
      </div>
    </div>
  );
}

function billToText(bill: BillResponse): string {
  const lines: string[] = [];
  lines.push(`Tagihan — ${bill.storeName}`);
  lines.push(new Date(bill.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }));
  lines.push("");
  for (const user of bill.users) {
    lines.push(user.displayName + (user.username ? ` (@${user.username})` : ""));
    lines.push(`  Makanan : ${formatRupiah(user.foodTotal)}`);
    if (user.foodSubsidy > 0) lines.push(`  Subsidi : -${formatRupiah(user.foodSubsidy)}`);
    lines.push(`  Bayar   : ${formatRupiah(user.foodPayable)}`);
    lines.push(`  Minuman : ${formatRupiah(user.drinkTotal)}`);
    if (user.drinkSubsidy > 0) lines.push(`  Subsidi : -${formatRupiah(user.drinkSubsidy)}`);
    lines.push(`  Bayar   : ${formatRupiah(user.drinkPayable)}`);
    lines.push(`  TOTAL   : ${formatRupiah(user.payable)}`);
    lines.push("");
  }
  lines.push(`Total keseluruhan: ${formatRupiah(bill.totals.payable)}`);
  return lines.join("\n");
}
