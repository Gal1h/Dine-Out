import { useState } from "react";
import { KeyRound, Shield, ShieldOff } from "lucide-react";
import type { MemberRow } from "@dineout/shared";
import { Button } from "../../../components/ui/button";
import { Badge, RoleBadge } from "../../../components/ui/badge";
import { Dialog } from "../../../components/ui/dialog";
import { Field, FormError, Input } from "../../../components/ui/form";
import { useMembers, useResetMemberPassword, useSetMemberRole } from "../queries";
import { errorMessage } from "../../../lib/api";
import { toast } from "../../../lib/store";
import { initials } from "../../../lib/utils";
import { LoadingBlock, EmptyState } from "../../../components/ui/feedback";

export function MembersTab({ groupId, canManage }: { groupId: string; canManage: boolean }) {
  const members = useMembers(groupId);
  const roleMutation = useSetMemberRole(groupId);
  const passwordMutation = useResetMemberPassword(groupId);
  const [resetTarget, setResetTarget] = useState<MemberRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (members.isLoading) return <LoadingBlock label="Memuat anggota" />;

  if (!members.data || members.data.members.length === 0) {
    return <EmptyState title="Belum ada anggota" description="Tambahkan akun anggota lewat tombol di atas." />;
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {members.data.members.map((member) => (
        <div key={member.userId} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
            {initials(member.displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-medium">{member.displayName}</p>
              <RoleBadge role={member.role} />
            </div>
            <p className="mt-0.5 truncate text-2xs text-muted-foreground">
              {member.username ? `@${member.username}` : member.email ?? "akun admin"}
            </p>
          </div>

          {canManage && member.role !== "admin" ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={member.role === "mod" ? "Cabut mod" : "Jadikan mod"}
                title={member.role === "mod" ? "Cabut mod" : "Jadikan mod"}
                disabled={roleMutation.isPending}
                onClick={() =>
                  roleMutation.mutate(
                    { userId: member.userId, role: member.role === "mod" ? "member" : "mod" },
                    {
                      onSuccess: () =>
                        toast(member.role === "mod" ? "Tag mod dicabut" : "Tag mod diberikan", {
                          variant: "success",
                        }),
                      onError: (err) => toast(errorMessage(err), { variant: "error" }),
                    },
                  )
                }
              >
                {member.role === "mod" ? (
                  <ShieldOff className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reset password"
                title="Reset password"
                onClick={() => {
                  setResetTarget(member);
                  setNewPassword("");
                  setError(null);
                }}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ))}

      <Dialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset password"
        description={resetTarget ? `Buat password baru untuk ${resetTarget.displayName}.` : undefined}
      >
        <form
          className="space-y-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!resetTarget) return;
            setError(null);
            passwordMutation.mutate(
              { userId: resetTarget.userId, newPassword },
              {
                onSuccess: () => {
                  toast("Password diperbarui", { variant: "success" });
                  setResetTarget(null);
                },
                onError: (err) => setError(errorMessage(err)),
              },
            );
          }}
        >
          <Field label="Password baru" hint="Minimal 8 karakter">
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password baru"
            />
          </Field>
          {newPassword.length > 0 && newPassword.length < 8 ? (
            <FormError>Password minimal 8 karakter</FormError>
          ) : (
            <FormError>{error}</FormError>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
              Batal
            </Button>
            <Button type="submit" loading={passwordMutation.isPending} disabled={newPassword.length < 8}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>

      <div className="flex items-center gap-2 bg-muted/40 px-4 py-2.5">
        <Badge variant="outline">Info</Badge>
        <p className="text-2xs text-muted-foreground">
          Mod dapat membuat dan mengedit voting. Hanya admin yang bisa membuat tagihan.
        </p>
      </div>
    </div>
  );
}
