import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MyOrderResponse, OrderRow, OrdersResponse, Role, VoteSummary } from "@dineout/shared";
import { api } from "../../lib/api";

export function useGroupVotes(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group", groupId, "votes"],
    queryFn: () => api.get<{ votes: VoteSummary[] }>(`/groups/${groupId}/votes`),
    enabled: Boolean(groupId),
    refetchInterval: 60_000,
  });
}

export function useVote(voteId: string | undefined) {
  return useQuery({
    queryKey: ["vote", voteId],
    queryFn: () => api.get<{ vote: VoteSummary; role: Role }>(`/votes/${voteId}`),
    enabled: Boolean(voteId),
    refetchInterval: 60_000,
  });
}

export interface VoteFormPayload {
  storeName: string;
  mapsUrl: string;
  menuText: string;
  voteDeadline: string;
  orderDeadline: string;
  menuImage?: File | null;
  removeMenuImage?: boolean;
}

function toFormData(payload: VoteFormPayload): FormData {
  const form = new FormData();
  form.append("storeName", payload.storeName);
  form.append("mapsUrl", payload.mapsUrl);
  form.append("menuText", payload.menuText);
  form.append("voteDeadline", payload.voteDeadline);
  form.append("orderDeadline", payload.orderDeadline);
  if (payload.menuImage) form.append("menuImage", payload.menuImage);
  if (payload.removeMenuImage) form.append("removeMenuImage", "true");
  return form;
}

export function useCreateVote(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VoteFormPayload) =>
      api.upload<{ vote: VoteSummary }>(`/groups/${groupId}/votes`, toFormData(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId, "votes"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateVote(voteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VoteFormPayload) =>
      api.upload<{ vote: VoteSummary }>(`/votes/${voteId}`, toFormData(payload), "PATCH"),
    onSuccess: (data) => {
      queryClient.setQueryData(["vote", voteId], (prev: { vote: VoteSummary; role: Role } | undefined) =>
        prev ? { ...prev, vote: data.vote } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["group", data.vote.groupId, "votes"] });
    },
  });
}

export function useMyOrder(voteId: string | undefined) {
  return useQuery({
    queryKey: ["vote", voteId, "my-order"],
    queryFn: () => api.get<MyOrderResponse>(`/votes/${voteId}/orders/me`),
    enabled: Boolean(voteId),
  });
}

export interface OrderItemPayload {
  itemType: "food" | "drink";
  name: string;
  qty: number;
  note?: string;
}

export function useSubmitOrder(voteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: OrderItemPayload[]) =>
      api.put<{ order: unknown }>(`/votes/${voteId}/orders/me`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vote", voteId, "my-order"] });
      queryClient.invalidateQueries({ queryKey: ["vote", voteId, "orders"] });
      queryClient.invalidateQueries({ queryKey: ["vote", voteId] });
    },
  });
}

export function useVoteOrders(voteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["vote", voteId, "orders"],
    queryFn: () => api.get<OrdersResponse>(`/votes/${voteId}/orders`),
    enabled: Boolean(voteId) && enabled,
    refetchInterval: 60_000,
  });
}

export type { OrderRow };
