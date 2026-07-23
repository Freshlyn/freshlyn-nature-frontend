import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { FunctionsHttpError, type Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeIndianPhone } from '@/lib/phone';
import type { Profile } from '@/types/auth';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  user: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsProfileCompletion: boolean;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; isNewUser: boolean; message: string }>;
  updateProfile: (params: { name: string; email?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    // Return null (not throw) when the row is missing so a session whose
    // profile was never created / was deleted resolves to a settled "no
    // profile" state instead of an error-retry loop. maybeSingle() yields null
    // for zero rows; a genuine query error still rejects.
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone, email, created_at')
        .eq('id', session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.id,
  });

  const profile = profileQuery.data ?? null;
  const isLoading = sessionLoading || (!!session && profileQuery.isLoading);
  // "Needs onboarding" covers both a session with no profile row yet (verified
  // OTP but never completed /register, or a profile deleted under a live
  // session) and a stub profile where name still equals phone. Only assert this
  // once the profile query has settled, so we don't redirect mid-load. Without
  // it, such a session renders authenticated pages with no profile — Home shows
  // but the header falls back to "Login" and the bottom nav is hidden.
  const profileSettled = !!session && profileQuery.isSuccess;
  const needsProfileCompletion =
    profileSettled && (!profile || profile.name === profile.phone);

  const sendOtp = useCallback(async (phone: string) => {
    type SendResponse = { success: boolean; message: string };
    // The backend requires E.164 ("+91…"); the form supplies only local digits.
    // Normalize (and validate) here so send and verify address the same value
    // and an invalid number fails cleanly instead of as an opaque 500.
    const e164 = normalizeIndianPhone(phone);
    if (!e164) {
      return { success: false, message: 'Please enter a valid 10-digit mobile number.' };
    }
    const { data, error } = await supabase.functions.invoke<SendResponse>(
      'auth-send-otp',
      { body: { phone: e164 } },
    );
    // A 400 (e.g. invalid phone) carries a structured failure body; unwrap it
    // rather than throwing an opaque "non-2xx status code" error.
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body = (await error.context.json().catch(() => null)) as SendResponse | null;
        if (body && body.success === false) return body;
      }
      throw error;
    }
    return data!;
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string) => {
      type VerifyResponse =
        | { success: true; isNewUser: boolean; session: { access_token: string; refresh_token: string; expires_in: number }; message: string }
        | { success: false; isNewUser: false; message: string };

      // Normalize to the same E.164 value sendOtp used, so the otp_codes row
      // (keyed by phone) and the auth user are matched consistently.
      const e164 = normalizeIndianPhone(phone);
      if (!e164) {
        return { success: false, isNewUser: false, message: 'Please enter a valid 10-digit mobile number.' };
      }
      const { data, error } = await supabase.functions.invoke<VerifyResponse>(
        'auth-verify-otp',
        { body: { phone: e164, otp } },
      );

      // The edge function reports an invalid/expired OTP as a 400 with a
      // structured `{ success: false, message }` body. The Supabase client
      // surfaces any non-2xx as a FunctionsHttpError, so unwrap that body and
      // return it as a normal failure instead of throwing — otherwise the
      // caller sees an opaque "non-2xx status code" error and shows no toast.
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const body = (await error.context.json().catch(() => null)) as VerifyResponse | null;
          if (body && body.success === false) {
            return { success: false, isNewUser: false, message: body.message };
          }
        }
        throw error;
      }
      const result = data!;
      if (result.success) {
        const { data: setSessionData } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        // setSession resolving does not guarantee AuthProvider's own
        // `session` state (updated via the onAuthStateChange listener) has
        // re-rendered yet. Push it into state directly so callers that
        // navigate immediately after verifyOtp() see isAuthenticated=true
        // on the very next render, instead of racing the listener.
        setSession(setSessionData.session);
      }
      return { success: result.success, isNewUser: result.isNewUser, message: result.message };
    },
    [],
  );

  const updateProfile = useCallback(
    async ({ name, email }: { name: string; email?: string }) => {
      if (!session) throw new Error('Not authenticated');
      // Upsert, not update: a profile-less session (row deleted, or the
      // on_auth_user_created trigger never ran) has no row to UPDATE, so a bare
      // update matches zero rows and .single() 406s. Upserting on the primary
      // key creates the row when missing and updates it when present. `phone`
      // comes from the auth session so a freshly-created row satisfies the
      // schema and downstream code that reads profile.phone.
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            name,
            phone: session.user.phone ?? null,
            ...(email ? { email } : {}),
          },
          { onConflict: 'id' },
        )
        .select('id, name, phone, email, created_at')
        .single();
      if (error) throw error;
      // Write the updated row straight into the cache instead of invalidating.
      // Invalidation triggers a refetch, during which the profile query briefly
      // has no settled data and `needsProfileCompletion` flips back to true —
      // so a caller that navigates to Home right after (Register) gets bounced
      // back to /register mid-refetch. Setting the data makes the completed
      // profile visible synchronously, with no refetch window to race.
      queryClient.setQueryData(['profile', session.user.id], data);
    },
    [session, queryClient],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('freshlyn_cart');
    localStorage.removeItem('freshlyn_cart_id');
  }, []);

  const value: AuthContextValue = {
    session,
    profile,
    user: profile,
    isAuthenticated: !!session,
    isLoading,
    needsProfileCompletion,
    sendOtp,
    verifyOtp,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
