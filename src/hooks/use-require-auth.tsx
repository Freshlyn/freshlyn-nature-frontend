import { useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { rememberAuthRedirect } from "@/lib/auth-redirect";

/**
 * The gate between browsing and acting.
 *
 * Everything up to the moment of intent is public -- the catalogue, search,
 * the product detail modal, the plan picker. This wraps the actions that are
 * not: adding to the cart, and anything else that would need an account. A
 * signed-in user's action runs untouched; a guest's is dropped, their current
 * page is remembered, and they are sent to login to come back to it.
 *
 * Deliberately not a component or a route guard. The gate belongs on the
 * handler because that is the granularity the user experiences: the same
 * screen serves both audiences, and only the button changes behaviour.
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  return useCallback(
    (action: () => void, message?: string): boolean => {
      // A session that has not resolved yet is not a signed-out session.
      // Acting on it would bounce a returning user to login on their first
      // tap after a cold start, so the tap is swallowed instead -- the auth
      // check settles in milliseconds and the second tap succeeds.
      if (isLoading) return false;

      if (!isAuthenticated) {
        rememberAuthRedirect(location);
        toast({
          title: "Please login",
          description: message ?? "You need an account to continue",
        });
        setLocation("/login");
        return false;
      }

      action();
      return true;
    },
    [isAuthenticated, isLoading, location, setLocation, toast],
  );
}
