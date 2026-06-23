import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useStaticAuth } from '@/hooks/use-static-auth';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { isAuthenticated } = useStaticAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;
  return <>{children}</>;
}
