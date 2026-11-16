import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupSummary, MemberRow, Role } from "@dineout/shared";
import { api } from "../../lib/api";

export interface GroupDetail {
  id: string;
  name: string;
  adminId: string;
  createdAt: string;
  timezone: string;
  role: Role;
  memberCount: number;
  voteCount: number;
}

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<{ groups: GroupSummary[] }>("/groups"),
  });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api.get<{ group: GroupDetail }>(`/groups/${groupId}`),
    enabled: Boolean(groupId),
  });
}

export function useMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group", groupId, "members"],
    queryFn: () => api.get<{ members: MemberRow[] }>(`/groups/${groupId}/members`),
    enabled: Boolean(groupId),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.post<{ group: GroupSummary }>("/groups", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export interface BulkMemberInput {
  username: string;
  password: string;
  displayName: string;
}

export function useBulkMembers(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (members: BulkMemberInput[]) =>
      api.post<{ created: Array<{ userId: string; displayName: string; username: string }> }>(
        `/groups/${groupId}/members/bulk`,
        { members },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useSetMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "mod" | "member" }) =>
      api.patch(`/groups/${groupId}/members/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId, "members"] });
    },
  });
}

export function useResetMemberPassword(groupId: string) {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.post(`/groups/${groupId}/members/${userId}/password`, { newPassword }),
  });
}
