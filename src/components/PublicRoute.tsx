import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * A route open to everyone EXCEPT a half-registered session.
 *
 * Browsing needs no account, so there is no authentication check here -- a
 * signed-out visitor renders the page. But a session that verified its OTP and
 * abandoned /register is not a guest: it holds a real token, so the header and
 * nav render their signed-in branches against a profile that does not exist.
 * That is the split-brain page e2e/route-guards.spec.ts was written for, and
 * it used to be prevented by ProtectedRoute, which Home no longer uses.
 *
 * The distinction that matters: `!isAuthenticated` is fine here and always was;
 * `needsProfileCompletion` never is.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isLoading, needsProfileCompletion } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && needsProfileCompletion) {
      navigate("/register", { replace: true });
    }
  }, [isLoading, isAuthenticated, needsProfileCompletion, navigate]);

  // Render nothing while the redirect above is pending, so the page never
  // flashes in its split-brain state. A guest falls through immediately.
  if (isAuthenticated && needsProfileCompletion) return null;

  return <>{children}</>;
}
