import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { formatPhoneForDisplay } from "@/lib/phone";
import { useAddresses } from "@/hooks/use-addresses";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { ContactUsModal } from "@/components/ContactUsModal";
import { AddressModal } from "@/components/AddressModal";
import { openExternalUrl } from "@/lib/platform/external-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  FileText,
  Info,
  Star,
  Bell,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

const WEBSITE_URL = "https://freshlynnature.com/";

interface ProfileProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function Profile({ sidebarOpen, onSidebarToggle }: ProfileProps) {
  const { user, logout } = useAuth();
  const { data: addresses = [] } = useAddresses();
  const [, setLocation] = useLocation();
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const userInitials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberSinceDate = new Date(user.created_at);
  const memberSince = `${memberSinceDate.toLocaleDateString("en-US", { month: "short" })} '${String(memberSinceDate.getFullYear()).slice(-2)}`;

  const menuSections = [
    {
      label: "Account",
      items: [
        {
          icon: ClipboardList,
          label: "My Orders",
          subtitle: "View order history & track orders",
          action: () => setLocation("/orders"),
          testId: "menu-my-orders",
        },
        {
          icon: MapPin,
          label: "Saved Addresses",
          subtitle: `${addresses.length} saved address${addresses.length !== 1 ? "es" : ""}`,
          action: () => setAddressDialogOpen(true),
          testId: "menu-saved-addresses",
        },
        {
          icon: Bell,
          label: "Notifications",
          subtitle: "Manage notification preferences",
          action: () =>
            setInfoDialog({
              title: "Notifications",
              content:
                "Notification preferences will be available soon. You'll be able to control order updates, delivery alerts, and promotional notifications from here.",
            }),
          testId: "menu-notifications",
        },
      ],
    },
    {
      label: "Support",
      items: [
        {
          icon: MessageCircle,
          label: "Contact Us",
          subtitle: "Get help with your orders",
          action: () => setContactOpen(true),
          testId: "menu-contact-us",
        },
        {
          icon: Star,
          label: "Rate Us",
          subtitle: "Tell us how we're doing",
          action: () =>
            setInfoDialog({
              title: "Rate Us",
              content:
                "We'd love to hear your feedback! Your ratings help us improve our service and deliver a better experience.\n\nRating functionality will be available in the next update.",
            }),
          testId: "menu-rate-us",
        },
      ],
    },
    {
      label: "Trust & Transparency",
      items: [
        {
          icon: FileText,
          label: "Terms & Conditions",
          subtitle: "Read our terms of service",
          action: () => setLocation("/terms"),
          testId: "menu-terms",
        },
        {
          icon: ShieldCheck,
          label: "Safe & Secure",
          subtitle: "Our commitment to protecting your data",
          action: () => setLocation("/privacy"),
          testId: "menu-privacy",
        },
        {
          icon: Info,
          label: "About Us",
          subtitle: "Learn more about our story",
          action: () => openExternalUrl(WEBSITE_URL),
          external: true,
          testId: "menu-about",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
        backTo="/"
        backLabel="Back to Shop"
      />

      <main className="container mx-auto px-4 py-6 max-w-lg pb-28 md:pb-6">
        <div
          className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[hsl(88_58%_93%)] to-[hsl(88_54%_86%)] px-5 pt-6 pb-6 mb-5"
          data-testid="card-user-info"
        >
          <div className="flex items-center gap-4">
            <div className="w-[68px] h-[68px] rounded-full bg-[hsl(88_52%_80%)] flex items-center justify-center flex-shrink-0">
              <span
                className="text-xl font-extrabold text-[hsl(88_55%_26%)]"
                data-testid="text-user-initials"
              >
                {userInitials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className="text-lg font-bold text-[hsl(88_48%_20%)] truncate"
                data-testid="text-user-name"
              >
                {user.name}
              </h2>
              <div className="flex items-center gap-1.5 text-sm text-[hsl(88_35%_30%)] mt-1">
                <Phone size={13} />
                <span data-testid="text-user-phone">{formatPhoneForDisplay(user.phone)}</span>
              </div>
              {user.email && (
                <div className="flex items-center gap-1.5 text-sm text-[hsl(88_35%_30%)] mt-0.5">
                  <Mail size={13} />
                  <span data-testid="text-user-email">{user.email}</span>
                </div>
              )}
            </div>
          </div>
          <span
            className="inline-block mt-3.5 text-[11px] font-medium text-[hsl(88_50%_26%)] bg-white/65 rounded-full px-2.5 py-1"
            data-testid="text-stat-member-since"
          >
            Member since {memberSince}
          </span>
        </div>

        <div className="space-y-4">
          {menuSections.map((section, sIdx) => (
            <div key={sIdx}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 ml-1 mb-1.5">
                {section.label}
              </p>
              <Card className="overflow-visible divide-y divide-border">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.testId}
                      onClick={item.action}
                      className="flex items-center gap-3.5 w-full px-4 py-3.5 text-left hover-elevate transition-colors first:rounded-t-[inherit] last:rounded-b-[inherit]"
                      data-testid={item.testId}
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                      {item.external ? (
                        <ExternalLink size={16} className="text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/30 gap-2"
            onClick={() => setLogoutConfirmOpen(true)}
            data-testid="button-logout"
          >
            Log Out
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">FreshlynNature v1.0.0</p>
      </main>

      <AddressModal
        open={addressDialogOpen}
        onClose={() => setAddressDialogOpen(false)}
        mode="manage"
        title="Saved Addresses"
      />

      <Dialog
        open={!!infoDialog}
        onOpenChange={(o) => {
          if (!o) setInfoDialog(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{infoDialog?.title}</DialogTitle>
          </DialogHeader>
          <div
            className="mt-2 text-sm text-muted-foreground whitespace-pre-line leading-relaxed"
            data-testid="text-info-content"
          >
            {infoDialog?.content}
          </div>
        </DialogContent>
      </Dialog>

      <ContactUsModal open={contactOpen} onOpenChange={setContactOpen} />

      <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-sm text-muted-foreground">
            Are you sure you want to log out of your account?
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLogoutConfirmOpen(false)}
              data-testid="button-logout-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                setLogoutConfirmOpen(false);
                handleLogout();
              }}
              data-testid="button-logout-confirm"
            >
              Log Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
