import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsProfileCompletion } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else if (needsProfileCompletion) {
      navigate('/register', { replace: true });
    }
  }, [isLoading, isAuthenticated, needsProfileCompletion, navigate]);

  if (isLoading || !isAuthenticated || needsProfileCompletion) return null;
  return <>{children}</>;
}
