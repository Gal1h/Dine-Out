import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ItemType, SummaryItemInput } from "@dineout/shared";
import { ITEM_TYPE_LABEL, normalizeItemName } from "@dineout/shared";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/form";

interface Row extends SummaryItemInput {
  key: string;
}

const newRow = (itemType: ItemType): Row => ({
  key: crypto.randomUUID(),
  itemType,
  name: "",
  totalQty: 1,
});

export interface AggregatedItem {
  itemType: ItemType;
  name: string;
  totalQty: number;
}

/** Gabungkan pesanan mentah berdasarkan nama item (normalisasi sederhana). */
export function aggregateOrders(
  orders: Array<{ items: Array<{ itemType: ItemType; name: string; qty: number }> }>,
): AggregatedItem[] {
  const map = new Map<string, AggregatedItem>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.itemType}|${normalizeItemName(item.name)}`;
      const found = map.get(key);
      if (found) found.totalQty += item.qty;
      else map.set(key, { itemType: item.itemType, name: item.name.trim(), totalQty: item.qty });
    }
  }
  return [...map.values()].sort(
    (a, b) => a.itemType.localeCompare(b.itemType) || a.name.localeCompare(b.name),
  );
}

export function SummaryEditor({
  initialItems,
  onSave,
  onCancel,
  saving,
  saveLabel,
}: {
  initialItems: AggregatedItem[];
  onSave: (items: SummaryItemInput[]) => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialItems.length
      ? initialItems.map((item) => ({ ...item, key: crypto.randomUUID() }))
      : [newRow("food")],
  );
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Pick<Row, "name" | "totalQty">>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const submit = () => {
    setError(null);
    const cleaned = rows
      .filter((row) => row.name.trim().length > 0 && row.totalQty > 0)
      .map(({ itemType, name, totalQty }) => ({
        itemType,
        name: name.trim(),
        totalQty,
      }));
    if (cleaned.length === 0) {
      setError("Isi minimal satu item");
      return;
    }

    const seen = new Set<string>();
    for (const item of cleaned) {
      const key = `${item.itemType}|${normalizeItemName(item.name)}`;
      if (seen.has(key)) {
        setError(`Item "${item.name}" muncul lebih dari sekali`);
        return;
      }
      seen.add(key);
    }
    onSave(cleaned);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["food", "drink"] as ItemType[]).map((type) => {
          const typeRows = rows.filter((row) => row.itemType === type);
          return (
            <div key={type} className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-[13px] font-semibold">{ITEM_TYPE_LABEL[type]}</span>
                <span className="nums text-2xs text-muted-foreground">
                  {typeRows.reduce((sum, row) => sum + (Number(row.totalQty) || 0), 0)} porsi
                </span>
              </div>
              <div className="space-y-2 p-3">
                {typeRows.map((row) => (
                  <div key={row.key} className="flex items-center gap-1.5">
                    <Input
                      value={row.name}
                      placeholder={`Nama ${ITEM_TYPE_LABEL[type].toLowerCase()}`}
                      onChange={(event) => update(row.key, { name: event.target.value })}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={9999}
                      value={row.totalQty}
                      className="nums w-20"
                      onChange={(event) =>
                        update(row.key, { totalQty: Math.max(0, Number(event.target.value) || 0) })
                      }
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded p-2 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setRows((prev) => {
                          const next = prev.filter((r) => r.key !== row.key);
                          return next.length ? next : [newRow("food")];
                        })
                      }
                      aria-label="Hapus item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setRows((prev) => [...prev, newRow(type)])}
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah {ITEM_TYPE_LABEL[type].toLowerCase()}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button type="button" onClick={submit} loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
