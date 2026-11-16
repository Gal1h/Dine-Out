import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { bulkMemberRowSchema } from "@dineout/shared";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { FormError, Input } from "../../../components/ui/form";
import { errorMessage } from "../../../lib/api";
import { toast } from "../../../lib/store";
import { useBulkMembers } from "../queries";

interface Row {
  username: string;
  password: string;
  displayName: string;
}

const emptyRow = (): Row => ({ username: "", password: "", displayName: "" });

export function BulkMembersDialog({
  open,
  onClose,
  groupId,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
}) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useBulkMembers(groupId);

  const update = (index: number, key: keyof Row, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => {
    if (rows.length >= 50) {
      setError("Maksimal 50 akun per batch");
      return;
    }
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const close = () => {
    setRows([emptyRow()]);
    setError(null);
    onClose();
  };

  const submit = () => {
    setError(null);
    const parsed: Row[] = [];
    for (const [index, row] of rows.entries()) {
      const result = bulkMemberRowSchema.safeParse(row);
      if (!result.success) {
        setError(`Baris ${index + 1}: ${result.error.issues[0]?.message ?? "tidak valid"}`);
        return;
      }
      parsed.push(result.data);
    }
    mutation.mutate(parsed, {
      onSuccess: (data) => {
        toast(`${data.created.length} akun dibuat`, { variant: "success" });
        close();
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Tambah akun anggota"
      description="Username unik di grup ini. Password minimal 8 karakter."
      className="max-w-2xl"
    >
      <div className="space-y-2.5">
        <div className="hidden grid-cols-[1.1fr_1fr_0.9fr_auto] gap-2 px-0.5 text-2xs uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Nama</span>
          <span>Username</span>
          <span>Password</span>
          <span />
        </div>
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1.1fr_1fr_0.9fr_auto] sm:border-0 sm:p-0"
          >
            <Input
              placeholder="Nama anggota"
              value={row.displayName}
              onChange={(e) => update(index, "displayName", e.target.value)}
            />
            <Input
              placeholder="username"
              value={row.username}
              onChange={(e) => update(index, "username", e.target.value)}
            />
            <Input
              placeholder="password"
              type="text"
              value={row.password}
              onChange={(e) => update(index, "password", e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              aria-label="Hapus baris"
              disabled={rows.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" /> Tambah baris
        </Button>

        <FormError>{error}</FormError>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={close}>
            Batal
          </Button>
          <Button type="button" loading={mutation.isPending} onClick={submit}>
            Simpan semua
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
