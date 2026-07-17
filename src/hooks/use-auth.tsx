import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone, email, created_at')
        .eq('id', session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.id,
  });

  const profile = profileQuery.data ?? null;
  const isLoading = sessionLoading || (!!session && profileQuery.isLoading);
  const needsProfileCompletion = !!profile && profile.name === profile.phone;

  const sendOtp = useCallback(async (phone: string) => {
    const { data, error } = await supabase.functions.invoke<{ success: boolean; message: string }>(
      'auth-send-otp',
      { body: { phone } },
    );
    if (error) throw error;
    return data!;
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string) => {
      const { data, error } = await supabase.functions.invoke<
        | { success: true; isNewUser: boolean; session: { access_token: string; refresh_token: string; expires_in: number }; message: string }
        | { success: false; isNewUser: false; message: string }
      >('auth-verify-otp', { body: { phone, otp } });
      if (error) throw error;
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
      const { error } = await supabase
        .from('profiles')
        .update({ name, ...(email ? { email } : {}) })
        .eq('id', session.user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
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
