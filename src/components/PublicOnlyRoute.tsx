import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || isAuthenticated) return null;
  return <>{children}</>;
}
