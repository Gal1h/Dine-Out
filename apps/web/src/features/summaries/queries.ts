import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiSummaryResult, OrderSummary, SummaryItemInput } from "@dineout/shared";
import { api } from "../../lib/api";

export interface SummaryDetailResponse {
  summary: OrderSummary;
  voteId: string;
}

export function useSummaries(voteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["vote", voteId, "summaries"],
    queryFn: () => api.get<{ summaries: OrderSummary[] }>(`/votes/${voteId}/summaries`),
    enabled: Boolean(voteId) && enabled,
  });
}

export function useSummary(summaryId: string | undefined) {
  return useQuery({
    queryKey: ["summary", summaryId],
    queryFn: () => api.get<SummaryDetailResponse>(`/summaries/${summaryId}`),
    enabled: Boolean(summaryId),
  });
}

export function useSaveManualSummary(voteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: SummaryItemInput[]) =>
      api.post<{ summary: OrderSummary }>(`/votes/${voteId}/summaries/manual`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vote", voteId, "summaries"] });
    },
  });
}

export function useAiSort(voteId: string) {
  return useMutation({
    mutationFn: () => api.post<AiSummaryResult>(`/votes/${voteId}/summaries/ai`),
  });
}

export function useSaveAiSummary(voteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { items: SummaryItemInput[]; aiRaw?: string }) =>
      api.post<{ summary: OrderSummary }>(`/votes/${voteId}/summaries/ai/save`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vote", voteId, "summaries"] });
    },
  });
}
