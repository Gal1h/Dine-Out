import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillResponse, CreateBillInput } from "@dineout/shared";
import { api } from "../../lib/api";

export interface BillListItem {
  id: string;
  voteId: string;
  summaryId: string;
  createdAt: string;
  createdBy: string;
  totalUsers: number;
  totalPayable: number;
}

export function useBill(billId: string | undefined) {
  return useQuery({
    queryKey: ["bill", billId],
    queryFn: () => api.get<{ bill: BillResponse }>(`/bills/${billId}`),
    enabled: Boolean(billId),
  });
}

export function useVoteBills(voteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["vote", voteId, "bills"],
    queryFn: () => api.get<{ bills: BillListItem[] }>(`/votes/${voteId}/bills`),
    enabled: Boolean(voteId) && enabled,
  });
}

export function useCreateBill(summaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBillInput) =>
      api.post<{ bill: BillResponse }>(`/summaries/${summaryId}/bills`, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vote", data.bill.voteId, "bills"] });
    },
  });
}
