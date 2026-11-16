import type { GroupRole, Vote } from "@prisma/client";
import { voteStatusAt } from "@dineout/shared";
import { prisma } from "../db/prisma.js";
import { forbidden, notFound } from "../lib/errors.js";

export async function getGroupMembership(
  userId: string,
  groupId: string,
): Promise<GroupRole | null> {
  const row = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });
  return row?.role ?? null;
}

export async function assertGroupMember(userId: string, groupId: string): Promise<GroupRole> {
  const role = await getGroupMembership(userId, groupId);
  if (!role) throw forbidden("Anda bukan anggota grup ini");
  return role;
}

export async function assertGroupRole(
  userId: string,
  groupId: string,
  roles: GroupRole[],
): Promise<GroupRole> {
  const role = await assertGroupMember(userId, groupId);
  if (!roles.includes(role)) throw forbidden("Role Anda tidak diizinkan untuk aksi ini");
  return role;
}

export async function getVoteAccess(
  userId: string,
  voteId: string,
): Promise<{ vote: Vote; role: GroupRole }> {
  const vote = await prisma.vote.findUnique({ where: { id: voteId } });
  if (!vote) throw notFound("Voting tidak ditemukan");
  const role = await assertGroupMember(userId, vote.groupId);
  return { vote, role };
}

export function voteImageUrl(path: string | null): string | null {
  return path ? `/uploads/${path}` : null;
}

export function serializeVote(
  vote: Vote,
  extras: { orderCount?: number; hasMyOrder?: boolean } = {},
) {
  return {
    id: vote.id,
    groupId: vote.groupId,
    storeName: vote.storeName,
    mapsUrl: vote.mapsUrl,
    menuText: vote.menuText,
    menuImageUrl: voteImageUrl(vote.menuImagePath),
    voteDeadline: vote.voteDeadline.toISOString(),
    orderDeadline: vote.orderDeadline.toISOString(),
    status: voteStatusAt(new Date(), vote.voteDeadline, vote.orderDeadline),
    createdAt: vote.createdAt.toISOString(),
    updatedAt: vote.updatedAt.toISOString(),
    createdBy: vote.createdBy,
    ...extras,
  };
}
