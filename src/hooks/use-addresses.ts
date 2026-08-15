import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { UserAddress } from "@/types/user";

const ADDRESSES_KEY = ["addresses"];

interface AddressRow {
  id: string;
  label: string;
  flat_house: string;
  building: string | null;
  street: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

function toUserAddress(row: AddressRow): UserAddress {
  return {
    id: row.id,
    label: row.label,
    flat_house: row.flat_house,
    building: row.building ?? "",
    street: row.street ?? "",
    landmark: row.landmark ?? "",
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    latitude: row.latitude,
    longitude: row.longitude,
    is_default: row.is_default,
  };
}

export function useAddresses() {
  return useQuery({
    queryKey: ADDRESSES_KEY,
    queryFn: async (): Promise<UserAddress[]> => {
      const { data, error } = await supabase
        .from("addresses")
        .select(
          "id, label, flat_house, building, street, landmark, city, state, pincode, latitude, longitude, is_default",
        )
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data as AddressRow[]).map(toUserAddress);
    },
  });
}

export function useAddAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<UserAddress, "id" | "is_default" | "latitude" | "longitude"> & {
        is_default?: boolean;
        latitude?: number | null;
        longitude?: number | null;
      },
    ): Promise<UserAddress> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: userData.user.id,
          label: input.label,
          flat_house: input.flat_house,
          building: input.building || null,
          street: input.street || null,
          landmark: input.landmark || null,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          // Null unless the user confirmed they were standing here. The
          // nullability IS the tier: null means the pincode fallback decides.
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          is_default: input.is_default ?? false,
        })
        .select(
          "id, label, flat_house, building, street, landmark, city, state, pincode, latitude, longitude, is_default",
        )
        .single();
      if (error) throw error;
      return toUserAddress(data as AddressRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (addressId: string): Promise<void> => {
      const { error } = await supabase.rpc("set_default_address", { p_address_id: addressId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (addressId: string): Promise<void> => {
      const { error } = await supabase.from("addresses").delete().eq("id", addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}

/**
 * Upgrades a pincode-tier address to GPS-tier.
 *
 * Backs the "confirm location" action in the address list: a user standing at
 * an address they typed elsewhere can pin it accurately, and every future
 * order to it -- including scheduled subscription deliveries -- uses the
 * polygon rather than the coarse pincode allowlist.
 */
export function useUpdateAddressCoordinates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      addressId,
      latitude,
      longitude,
    }: {
      addressId: string;
      latitude: number;
      longitude: number;
    }): Promise<void> => {
      const { error } = await supabase
        .from("addresses")
        .update({ latitude, longitude })
        .eq("id", addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}
