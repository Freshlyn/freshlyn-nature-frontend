import { useState } from "react";
import { useAuth, StaleSessionError } from "@/hooks/use-auth";
import { formatPhoneForDisplay } from "@/lib/phone";
import { useAddresses } from "@/hooks/use-addresses";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { ContactUsModal } from "@/components/ContactUsModal";
import { AddressModal } from "@/components/AddressModal";
import { openExternalUrl } from "@/lib/platform/external-link";
import { isNative } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  User,
  Plus,
  Loader2,
} from "lucide-react";

const WEBSITE_URL = "https://freshlynnature.com/";

interface ProfileProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function Profile({ sidebarOpen, onSidebarToggle }: ProfileProps) {
  const { user, logout, updateProfile } = useAuth();
  const { data: addresses = [] } = useAddresses();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPending, setEditPending] = useState(false);
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

  // Seed the fields from the current profile on open rather than keeping them
  // in sync with `user` -- a half-typed edit should survive a background
  // profile refetch, and re-seeding on every open discards an abandoned draft.
  const openEditDialog = () => {
    setEditName(user.name);
    setEditEmail(user.email ?? "");
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = editName.trim();
    const email = editEmail.trim();
    if (!name) {
      toast({
        variant: "destructive",
        title: "Name Required",
        description: "Please enter your name",
      });
      return;
    }
    // Deliberately loose: this only catches obvious typos like a missing "@".
    // Anything stricter rejects valid-but-unusual addresses, and the address
    // is unverified either way.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
      });
      return;
    }
    setEditPending(true);
    try {
      await updateProfile({ name, email: email || undefined });
      setEditOpen(false);
      toast({
        title: "Profile Updated",
        description: "Your details have been saved.",
      });
    } catch (error) {
      // The account behind this session is gone -- updateProfile has already
      // dropped the stored token, so retrying the form would fail identically.
      if (error instanceof StaleSessionError) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Please sign in again to continue.",
        });
        setLocation("/login", { replace: true });
        return;
      }
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save your details. Please try again.",
      });
    } finally {
      setEditPending(false);
    }
  };

  const userInitials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberSinceDate = new Date(user.created_at);
  const memberSince = `${memberSinceDate.toLocaleDateString("en-US", { month: "short" })} '${String(memberSinceDate.getFullYear()).slice(-2)}`;

  // Notifications and Rate Us are device features with nothing behind them in a
  // browser -- no push permission to manage, no store listing to open -- so the
  // rows are left out of the array entirely rather than hidden with a class,
  // which would strip the row but leave its `divide-y` border behind.
  const nativeOnly = isNative();

  const menuSections = [
    {
      label: "Account",
      items: [
        {
          icon: User,
          label: "Edit Profile",
          subtitle: user.email ? "Update your name & email" : "Add your email address",
          action: openEditDialog,
          testId: "menu-edit-profile",
        },
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
        ...(nativeOnly
          ? [
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
            ]
          : []),
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
        ...(nativeOnly
          ? [
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
            ]
          : []),
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
              {user.email ? (
                <div className="flex items-center gap-1.5 text-sm text-[hsl(88_35%_30%)] mt-0.5">
                  <Mail size={13} />
                  <span className="truncate" data-testid="text-user-email">
                    {user.email}
                  </span>
                </div>
              ) : (
                // Email is optional at signup, so an account that skipped it has
                // no other cue that one can be added later. This prompt sits
                // where the address would be and opens the same edit dialog.
                <button
                  type="button"
                  onClick={openEditDialog}
                  className="flex items-center gap-1.5 text-sm font-medium text-[hsl(88_50%_26%)] mt-0.5 underline underline-offset-2"
                  data-testid="button-add-email"
                >
                  <Plus size={13} />
                  <span>Add email</span>
                </button>
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
        open={editOpen}
        onOpenChange={(o) => {
          // Block dismissal mid-save so the dialog can't unmount while the
          // upsert is still in flight and leave the result unreported.
          if (!editPending) setEditOpen(o);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="mt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="pl-9"
                  placeholder="Your name"
                  disabled={editPending}
                  data-testid="input-edit-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">
                Email <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="pl-9"
                  placeholder="your@email.com"
                  disabled={editPending}
                  data-testid="input-edit-email"
                />
              </div>
              {user.email && (
                // Saving blank leaves the stored address untouched rather than
                // clearing it, which would otherwise look like a failed save.
                <p className="text-xs text-muted-foreground">
                  Clearing this field won't remove your saved email. Contact us to have it removed.
                </p>
              )}
            </div>

            <div className="pt-1">
              <p className="text-xs text-muted-foreground">
                Phone number: {formatPhoneForDisplay(user.phone)} (cannot be changed)
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setEditOpen(false)}
                disabled={editPending}
                data-testid="button-edit-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={editPending}
                data-testid="button-edit-save"
              >
                {editPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
