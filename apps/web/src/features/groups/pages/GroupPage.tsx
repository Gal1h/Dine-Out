import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, UserPlus, UsersRound } from "lucide-react";
import { useGroup } from "../queries";
import { useGroupVotes } from "../../votes/queries";
import { Button } from "../../../components/ui/button";
import { Badge, RoleBadge } from "../../../components/ui/badge";
import { Tabs } from "../../../components/ui/tabs";
import { EmptyState, LoadingBlock } from "../../../components/ui/feedback";
import { VoteCard } from "../../votes/components/VoteCard";
import { MembersTab } from "../components/MembersTab";
import { BulkMembersDialog } from "../components/BulkMembersDialog";
import { FormError } from "../../../components/ui/form";

export function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const group = useGroup(groupId);
  const votes = useGroupVotes(groupId);
  const [bulkOpen, setBulkOpen] = useState(false);

  const tab = searchParams.get("tab") ?? "active";
  const role = group.data?.group.role;
  const canManageVotes = role === "admin" || role === "mod";
  const isGroupAdmin = role === "admin";

  const activeVotes = votes.data?.votes.filter((v) => v.status !== "closed") ?? [];
  const historyVotes = votes.data?.votes.filter((v) => v.status === "closed") ?? [];

  if (!groupId) return null;

  return (
    <div className="space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Semua grup
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {group.data?.group.name ?? "Memuat…"}
            </h1>
            {role ? <RoleBadge role={role} /> : null}
          </div>
          <p className="mt-1 flex items-center gap-3 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UsersRound className="h-3.5 w-3.5" /> {group.data?.group.memberCount ?? 0} anggota
            </span>
            <span className="nums">{group.data?.group.voteCount ?? 0} voting</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isGroupAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Tambah anggota
            </Button>
          ) : null}
          {canManageVotes ? (
            <Link to={`/groups/${groupId}/votes/new`}>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> Buat voting
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {group.isError ? (
        <FormError>Gagal memuat grup. Pastikan Anda anggota grup ini.</FormError>
      ) : null}

      <Tabs
        items={[
          { value: "active", label: "Voting aktif", count: activeVotes.length },
          { value: "history", label: "Riwayat", count: historyVotes.length },
          { value: "members", label: "Anggota", count: group.data?.group.memberCount },
        ]}
        value={tab}
        onChange={(value) => setSearchParams(value === "active" ? {} : { tab: value })}
      />

      {tab === "active" ? (
        votes.isLoading ? (
          <LoadingBlock label="Memuat voting" />
        ) : activeVotes.length === 0 ? (
          <EmptyState
            icon={<Badge variant="outline">Kosong</Badge>}
            title="Belum ada voting aktif"
            description={
              canManageVotes
                ? "Buat voting tempat makan dengan batas waktu voting dan batas isi pesanan."
                : "Tunggu admin atau mod membuat voting baru."
            }
            action={
              canManageVotes ? (
                <Link to={`/groups/${groupId}/votes/new`}>
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5" /> Buat voting
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3">
            {activeVotes.map((vote) => (
              <VoteCard key={vote.id} vote={vote} />
            ))}
          </div>
        )
      ) : null}

      {tab === "history" ? (
        votes.isLoading ? (
          <LoadingBlock label="Memuat riwayat" />
        ) : historyVotes.length === 0 ? (
          <EmptyState title="Belum ada riwayat" description="Voting yang selesai akan tampil di sini." />
        ) : (
          <div className="grid gap-3">
            {historyVotes.map((vote) => (
              <VoteCard key={vote.id} vote={vote} />
            ))}
          </div>
        )
      ) : null}

      {tab === "members" ? <MembersTab groupId={groupId} canManage={Boolean(isGroupAdmin)} /> : null}

      <BulkMembersDialog open={bulkOpen} onClose={() => setBulkOpen(false)} groupId={groupId} />
    </div>
  );
}
