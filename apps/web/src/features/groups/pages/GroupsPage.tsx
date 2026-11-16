import { useState } from "react";
import { ArrowUpRight, Plus, UsersRound, Vote } from "lucide-react";
import { Link } from "react-router-dom";
import { useGroups } from "../queries";
import { useAuth } from "../../auth/use-auth";
import { Button } from "../../../components/ui/button";
import { RoleBadge } from "../../../components/ui/badge";
import { EmptyState, LoadingBlock } from "../../../components/ui/feedback";
import { FormError } from "../../../components/ui/form";
import { CreateGroupDialog } from "../components/CreateGroupDialog";

export function GroupsPage() {
  const { me } = useAuth();
  const groups = useGroups();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Grup Anda</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {me?.user.displayName}
            {me?.user.accountType === "admin" ? " · akun admin" : ""}
          </p>
        </div>
        {me?.user.accountType === "admin" ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Buat grup
          </Button>
        ) : null}
      </div>

      {groups.isLoading ? <LoadingBlock label="Memuat grup" /> : null}

      {groups.isError ? (
        <FormError>Gagal memuat grup. Muat ulang halaman.</FormError>
      ) : null}

      {groups.data && groups.data.groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title="Belum ada grup"
          description={
            me?.user.accountType === "admin"
              ? "Buat grup pertama, lalu tambahkan akun anggota."
              : "Akun Anda belum tergabung di grup mana pun. Hubungi admin grup."
          }
          action={
            me?.user.accountType === "admin" ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Buat grup
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.data?.groups.map((group) => (
          <Link
            key={group.id}
            to={`/groups/${group.id}`}
            className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/25"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold tracking-tight">{group.name}</h2>
                <p className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <UsersRound className="h-3.5 w-3.5" /> {group.memberCount} anggota
                  </span>
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <RoleBadge role={group.role} />
              {group.activeVoteCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-2xs font-medium text-primary">
                  <Vote className="h-3 w-3" /> {group.activeVoteCount} voting aktif
                </span>
              ) : (
                <span className="text-2xs text-muted-foreground">Tidak ada voting aktif</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <CreateGroupDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
