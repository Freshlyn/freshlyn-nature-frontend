import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { checkServiceability, type ServiceabilityResult } from '@/lib/serviceability';
import type { UserAddress } from '@/types/user';

/**
 * The advisory verdict for a saved address.
 *
 * Reads the address ROW's stored values, exactly as create_order does, so the
 * checkout screen and the server can only disagree if a zone changed
 * mid-session -- in which case the server wins and the client message tells
 * the user to re-check.
 */
export function useAddressServiceability(address: UserAddress | undefined) {
  return useQuery({
    queryKey: ['serviceability', address?.id, address?.latitude, address?.longitude, address?.pincode],
    enabled: Boolean(address),
    queryFn: async (): Promise<ServiceabilityResult> =>
      checkServiceability({
        latitude: address!.latitude,
        longitude: address!.longitude,
        pincode: address!.pincode,
      }),
  });
}

/**
 * Records demand from outside every coverage area.
 *
 * The table has an insert policy for anon but deliberately no select policy,
 * so this write succeeds without a session and nothing can read it back.
 */
export function useWaitlistSignup() {
  return useMutation({
    mutationFn: async (input: {
      phone: string;
      pincode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }): Promise<void> => {
      const { error } = await supabase.from('waitlist_signups').insert({
        phone: input.phone,
        pincode: input.pincode ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      });
      if (error) throw error;
    },
  });
}
