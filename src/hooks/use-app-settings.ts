/**
 * Reads public.app_settings and keeps every open browser current.
 *
 * Two mechanisms, deliberately both: React Query fetches the rows once and
 * caches them for the session, and a Realtime subscription pushes dashboard
 * edits into that cache as they happen. Polling would trade staleness against
 * request volume; the subscription has neither cost.
 *
 * Requires public.app_settings in the supabase_realtime publication (migration
 * 20260826120000) -- without it this subscribes successfully, reports no error,
 * and silently receives nothing forever.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_SETTINGS,
  parseSettingsRows,
  type AppSettings,
} from "@/lib/app-settings";

const SETTINGS_QUERY_KEY = ["app-settings"] as const;

async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) throw error;
  return parseSettingsRows(data ?? []);
}

export function useAppSettings(): AppSettings {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    // These change a few times a year, and the subscription below makes the
    // cache authoritative the moment one does -- so there is no reason to ever
    // refetch on window focus or remount.
    staleTime: Infinity,
    // A settings fetch must never blank the cart. On failure the hook keeps
    // serving DEFAULT_SETTINGS through the placeholder below.
    retry: 2,
  });

  useEffect(() => {
    const channel = supabase
      .channel("app-settings-changes")
      // Every event type, not just UPDATE: a setting can be introduced (INSERT)
      // or reverted to its code default (DELETE) from the dashboard, and both
      // change what the UI should render.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => {
          // Refetch the whole table rather than patching the one row from the
          // payload. The payload's `value` is jsonb of unknown shape and a
          // DELETE carries only the old row, so reconstructing state from it
          // means duplicating parseSettingsRows' merge here. One extra request
          // per dashboard edit -- a handful a year -- is the cheaper answer.
          queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Never undefined: callers do arithmetic on these, and a hook that returns
  // undefined during the first paint would render "₹NaN" in the cart.
  return data ?? DEFAULT_SETTINGS;
}
