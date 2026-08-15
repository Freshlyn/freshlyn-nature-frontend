import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const PENDING_DELETION_KEY = ["account-deletion", "pending"];

export function useHasPendingDeletion() {
  return useQuery({
    queryKey: PENDING_DELETION_KEY,
    queryFn: async (): Promise<{ scheduledFor: string } | null> => {
      const { data, error } = await supabase
        .from("account_deletion_requests")
        .select("scheduled_for")
        .in("status", ["pending", "flagged"])
        .maybeSingle();
      if (error) throw error;
      return data ? { scheduledFor: data.scheduled_for } : null;
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ scheduledFor: string }> => {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        scheduledFor: string;
        error?: string;
      }>("delete-profile", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Failed to request account deletion.");
      return { scheduledFor: data.scheduledFor };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_DELETION_KEY });
    },
  });
}

export function useCancelAccountDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc("cancel_account_deletion");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_DELETION_KEY });
    },
  });
}
