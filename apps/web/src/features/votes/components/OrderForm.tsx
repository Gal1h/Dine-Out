import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import type { ItemType, MyOrderResponse } from "@dineout/shared";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/form";
import { Badge } from "../../../components/ui/badge";
import { useSubmitOrder } from "../queries";
import { errorMessage } from "../../../lib/api";
import { toast } from "../../../lib/store";
import { formatDate, cn } from "../../../lib/utils";

interface Row {
  key: string;
  itemType: ItemType;
  name: string;
  qty: number;
  note: string;
}

const newRow = (itemType: ItemType): Row => ({
  key: crypto.randomUUID(),
  itemType,
  name: "",
  qty: 1,
  note: "",
});

export function OrderForm({
  voteId,
  myOrder,
  disabled,
  onSaved,
}: {
  voteId: string;
  myOrder: MyOrderResponse | undefined;
  disabled: boolean;
  onSaved?: () => void;
}) {
  const [food, setFood] = useState<Row[]>([newRow("food")]);
  const [drink, setDrink] = useState<Row[]>([newRow("drink")]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useSubmitOrder(voteId);

  useEffect(() => {
    if (!myOrder) return;
    const items = myOrder.order?.items ?? [];
    const foods = items.filter((i) => i.itemType === "food");
    const drinks = items.filter((i) => i.itemType === "drink");
    setFood(
      foods.length
        ? foods.map((i) => ({
            key: i.id,
            itemType: "food" as const,
            name: i.name,
            qty: i.qty,
            note: i.note ?? "",
          }))
        : [newRow("food")],
    );
    setDrink(
      drinks.length
        ? drinks.map((i) => ({
            key: i.id,
            itemType: "drink" as const,
            name: i.name,
            qty: i.qty,
            note: i.note ?? "",
          }))
        : [newRow("drink")],
    );
  }, [myOrder]);

  const filled = useMemo(
    () => [...food, ...drink].filter((row) => row.name.trim().length > 0),
    [food, drink],
  );

  const updateRow = (
    type: ItemType,
    key: string,
    patch: Partial<Pick<Row, "name" | "qty" | "note">>,
  ) => {
    const setter = type === "food" ? setFood : setDrink;
    setter((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addRow = (type: ItemType) => {
    const setter = type === "food" ? setFood : setDrink;
    setter((prev) => [...prev, newRow(type)]);
  };

  const removeRow = (type: ItemType, key: string) => {
    const setter = type === "food" ? setFood : setDrink;
    setter((prev) => {
      const next = prev.filter((row) => row.key !== key);
      return next.length ? next : [newRow(type)];
    });
  };

  const submit = () => {
    setError(null);
    if (filled.length === 0) {
      setError("Isi minimal satu item");
      return;
    }
    mutation.mutate(
      filled.map((row) => ({
        itemType: row.itemType,
        name: row.name.trim(),
        qty: row.qty,
        note: row.note.trim() || undefined,
      })),
      {
        onSuccess: () => {
          toast("Pesanan tersimpan", {
            description: "Masih bisa diubah sampai batas isi form.",
            variant: "success",
          });
          onSaved?.();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <ItemSection
          title="Makanan"
          rows={food}
          disabled={disabled}
          onChange={(key, patch) => updateRow("food", key, patch)}
          onAdd={() => addRow("food")}
          onRemove={(key) => removeRow("food", key)}
        />
        <ItemSection
          title="Minuman"
          rows={drink}
          disabled={disabled}
          onChange={(key, patch) => updateRow("drink", key, patch)}
          onAdd={() => addRow("drink")}
          onRemove={(key) => removeRow("drink", key)}
        />
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="text-2xs text-muted-foreground">
          {myOrder?.order ? (
            <>
              Terakhir diubah {formatDate(myOrder.order.updatedAt)} ·{" "}
              <span className="nums">{filled.length} item</span>
            </>
          ) : (
            <span className="nums">{filled.length} item siap disimpan</span>
          )}
        </div>
        <Button onClick={submit} loading={mutation.isPending} disabled={disabled}>
          <Save className="h-4 w-4" /> {myOrder?.order ? "Perbarui pesanan" : "Simpan pesanan"}
        </Button>
      </div>
    </div>
  );
}

function ItemSection({
  title,
  rows,
  disabled,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  rows: Row[];
  disabled: boolean;
  onChange: (key: string, patch: Partial<Pick<Row, "name" | "qty" | "note">>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[13px] font-semibold">{title}</span>
        <Badge variant="outline">{rows.filter((r) => r.name.trim()).length} item</Badge>
      </div>
      <div className="space-y-2.5 p-3">
        {rows.map((row) => (
          <div key={row.key} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                placeholder={`Nama ${title.toLowerCase()}`}
                value={row.name}
                disabled={disabled}
                onChange={(event) => onChange(row.key, { name: event.target.value })}
              />
              <div className="flex h-10 shrink-0 items-center rounded-md border border-input bg-card">
                <button
                  type="button"
                  className="px-2 text-muted-foreground disabled:opacity-40"
                  onClick={() => onChange(row.key, { qty: Math.max(1, row.qty - 1) })}
                  disabled={disabled || row.qty <= 1}
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="nums w-6 text-center text-[13px] font-medium">{row.qty}</span>
                <button
                  type="button"
                  className="px-2 text-muted-foreground disabled:opacity-40"
                  onClick={() => onChange(row.key, { qty: Math.min(99, row.qty + 1) })}
                  disabled={disabled || row.qty >= 99}
                  aria-label="Tambah jumlah"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <button
                type="button"
                className={cn(
                  "shrink-0 rounded p-2 text-muted-foreground hover:text-destructive",
                  disabled && "pointer-events-none opacity-40",
                )}
                onClick={() => onRemove(row.key)}
                aria-label="Hapus item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Input
              className="h-8 text-[13px]"
              placeholder="Catatan (opsional) — mis. tanpa sambal"
              value={row.note}
              disabled={disabled}
              onChange={(event) => onChange(row.key, { note: event.target.value })}
            />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={onAdd} disabled={disabled} className="w-full">
          <Plus className="h-3.5 w-3.5" /> Tambah {title.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
