import { Switch, Route, useLocation } from 'wouter';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/use-auth';
import { BottomNav } from '@/components/BottomNav';
import { DesktopSidebar } from '@/components/DesktopSidebar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute';
import NotFound from '@/pages/not-found';
import Home from '@/pages/Home';
import Cart from '@/pages/Cart';
import Orders from '@/pages/Orders';
import OrderDetail from '@/pages/OrderDetail';
import Profile from '@/pages/Profile';
import TermsAndConditions from '@/pages/TermsAndConditions';
import DataPrivacy from '@/pages/DataPrivacy';
import AuthPage from '@/pages/Auth';
import RegisterPage from '@/pages/Register';

function App() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const bottomNavPages = ['/', '/orders', '/profile'];
  const showBottomNav = user && bottomNavPages.includes(location);
  const showDesktopSidebar = user && sidebarOpen;

  return (
    <div className="min-h-screen">
      {showDesktopSidebar && <DesktopSidebar isOpen={sidebarOpen} />}

      <div className={`${showDesktopSidebar ? 'md:ml-56' : ''} transition-all duration-200`}>
        <Switch>
          <Route path="/">
            <ProtectedRoute>
              <Home sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
            </ProtectedRoute>
          </Route>
          <Route path="/cart">
            <ProtectedRoute>
              <Cart sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
            </ProtectedRoute>
          </Route>
          <Route path="/orders/:id">
            <ProtectedRoute>
              <OrderDetail sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
            </ProtectedRoute>
          </Route>
          <Route path="/orders">
            <ProtectedRoute>
              <Orders sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
            </ProtectedRoute>
          </Route>
          <Route path="/profile">
            <ProtectedRoute>
              <Profile sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
            </ProtectedRoute>
          </Route>
          <Route path="/terms">
            <ProtectedRoute>
              <TermsAndConditions sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
            </ProtectedRoute>
          </Route>
          <Route path="/privacy">
            <ProtectedRoute>
              <DataPrivacy sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />
            </ProtectedRoute>
          </Route>
          <Route path="/login">
            <PublicOnlyRoute>
              <AuthPage />
            </PublicOnlyRoute>
          </Route>
          <Route path="/register">
            <RegisterPage />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>

      {showBottomNav && <BottomNav visible={true} />}
      <Toaster />
    </div>
  );
}

export default App;
