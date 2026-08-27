import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useHasPendingDeletion } from "@/hooks/use-account-deletion";
import { AccountDeletionLocked } from "@/components/AccountDeletionLocked";
import { rememberAuthRedirect } from "@/lib/auth-redirect";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsProfileCompletion } = useAuth();
  const [location, navigate] = useLocation();

  // Only meaningful once the user is authenticated; the query is enabled
  // regardless but resolves to null for signed-out sessions.
  const { data: pendingDeletion, isLoading: deletionLoading } = useHasPendingDeletion();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      // Remembered so login returns them to the page they actually wanted --
      // a guest who taps the cart lands back on the cart, not on Home.
      rememberAuthRedirect(location);
      navigate("/login", { replace: true });
    } else if (needsProfileCompletion) {
      navigate("/register", { replace: true });
    }
  }, [isLoading, isAuthenticated, needsProfileCompletion, navigate, location]);

  if (isLoading || !isAuthenticated || needsProfileCompletion) return null;

  // Don't flash the app before we know whether this account is being deleted.
  if (deletionLoading) return null;
  if (pendingDeletion) {
    return <AccountDeletionLocked scheduledFor={pendingDeletion.scheduledFor} />;
  }

  return <>{children}</>;
}
