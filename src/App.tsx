import { Switch, Route, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAndroidBackButton } from "@/lib/platform/back-button";
import { initSystemUi } from "@/lib/platform/system-ui";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/components/PublicOnlyRoute";
import { PublicRoute } from "@/components/PublicRoute";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Cart from "@/pages/Cart";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Profile from "@/pages/Profile";
import TermsAndConditions from "@/pages/TermsAndConditions";
import DataPrivacy from "@/pages/DataPrivacy";
import AuthPage from "@/pages/Auth";
import RegisterPage from "@/pages/Register";

function App() {
  useAndroidBackButton();
  useEffect(() => {
    void initSystemUi();
  }, []);
  const { user } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const bottomNavPages = ["/", "/orders", "/profile"];
  const showBottomNav = user && bottomNavPages.includes(location);
  const showDesktopSidebar = user && sidebarOpen;

  return (
    <div className="h-screen overflow-hidden">
      <OfflineBanner />
      {showDesktopSidebar && <DesktopSidebar isOpen={sidebarOpen} />}

      <div
        key={location}
        className={`h-screen overflow-y-auto ${
          showDesktopSidebar ? "md:ml-56" : ""
        } transition-all duration-200`}
      >
        <Switch>
          {/* The one public route. Browsing the catalogue needs no account;
              the gate moves to the actions -- see useRequireAuth. Every other
              route below stays protected, because each one is inherently
              per-user (cart, orders, profile) or sits behind login by choice. */}
          <Route path="/">
            <PublicRoute>
              <Home
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            </PublicRoute>
          </Route>
          <Route path="/cart">
            <ProtectedRoute>
              <Cart
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            </ProtectedRoute>
          </Route>
          <Route path="/orders/:id">
            <ProtectedRoute>
              <OrderDetail
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            </ProtectedRoute>
          </Route>
          <Route path="/orders">
            <ProtectedRoute>
              <Orders
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            </ProtectedRoute>
          </Route>
          <Route path="/profile">
            <ProtectedRoute>
              <Profile
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            </ProtectedRoute>
          </Route>
          <Route path="/terms">
            <ProtectedRoute>
              <TermsAndConditions
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            </ProtectedRoute>
          </Route>
          <Route path="/privacy">
            <ProtectedRoute>
              <DataPrivacy
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
              />
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
