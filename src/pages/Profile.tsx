import { useState } from "react";
import { useStaticAuth } from "@/hooks/use-static-auth";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UserAddress } from "@/data/users";
import { MobileBackButton } from "@/components/MobileBackButton";
import {
  Phone,
  Mail,
  MapPin,
  LogOut,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  FileText,
  Info,
  Star,
  Bell,
  Plus,
  Check,
  Trash2,
  Home,
  Briefcase,
  Tag,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

interface ProfileProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

const LABEL_OPTIONS = ["Home", "Work", "Other"];

function getLabelIcon(label: string) {
  switch (label.toLowerCase()) {
    case "home":
      return <Home size={14} />;
    case "work":
      return <Briefcase size={14} />;
    default:
      return <Tag size={14} />;
  }
}

export default function Profile({
  sidebarOpen,
  onSidebarToggle,
}: ProfileProps) {
  const { user, logout, addAddress, deleteAddress, setDefaultAddress } =
    useStaticAuth();
  const [, setLocation] = useLocation();
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [newLabel, setNewLabel] = useState("Home");
  const [newAddress, setNewAddress] = useState({
    flat_house: "",
    building: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
  });

  if (!user) return null;

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const handleAddAddress = async () => {
    if (
      !newAddress.flat_house ||
      !newAddress.street ||
      !newAddress.city ||
      !newAddress.pincode
    )
      return;
    await addAddress({
      label: newLabel,
      is_default: user.addresses.length === 0,
      ...newAddress,
    });
    setShowAddForm(false);
    setNewAddress({
      flat_house: "",
      building: "",
      street: "",
      landmark: "",
      city: "",
      state: "",
      pincode: "",
    });
    setNewLabel("Home");
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
          subtitle: `${user.addresses.length} saved address${user.addresses.length !== 1 ? "es" : ""}`,
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
          action: () =>
            setInfoDialog({
              title: "Contact Us",
              content:
                "Need help? Reach out to us!\n\nEmail: support@freshlynature.com\nPhone: 1800-123-4567 (Toll Free)\nWorking Hours: 6:00 AM - 10:00 PM\n\nYou can also chat with us through the app for faster support.",
            }),
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
          action: () =>
            setInfoDialog({
              title: "About FreshlynNature",
              content:
                "FreshlynNature - Fresh Groceries Delivered\nVersion 1.0.0\n\nFreshlynNature brings fresh groceries and daily essentials to your doorstep. With our subscription model, never run out of milk, bread, or other everyday items.\n\nFeatures:\n- Wide range of fresh products\n- Flexible subscription plans\n- Multiple delivery addresses\n- Fast and reliable delivery\n\nMade with care for your daily needs.",
            }),
          testId: "menu-about",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />

      <main className="container mx-auto px-4 py-6 max-w-lg pb-28 md:pb-6">
        <MobileBackButton to="/" label="Back to Shop" />

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
                <span data-testid="text-user-phone">+91 {user.phone}</span>
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
                        <p className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground flex-shrink-0"
                      />
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
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut size={18} />
            Log Out
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          FreshlynNature v1.0.0
        </p>
      </main>

      <Dialog
        open={addressDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddressDialogOpen(false);
            setShowAddForm(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={20} className="text-primary" />
              Saved Addresses
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {user.addresses.length === 0 && !showAddForm && (
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                  <MapPin size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No saved addresses
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add your first delivery address
                </p>
              </div>
            )}

            {user.addresses.map((addr) => (
              <Card
                key={addr.id}
                className={`p-3 transition-all ${addr.is_default ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
                data-testid={`address-card-${addr.id}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${addr.is_default ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    {getLabelIcon(addr.label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {addr.label}
                      </span>
                      {addr.is_default && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {[
                        addr.flat_house,
                        addr.building,
                        addr.street,
                        addr.landmark,
                        addr.city,
                        `${addr.state} ${addr.pincode}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!addr.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        onClick={() => setDefaultAddress(addr.id)}
                        data-testid={`button-set-default-${addr.id}`}
                      >
                        <Check size={14} />
                      </Button>
                    )}
                    {user.addresses.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        onClick={() => deleteAddress(addr.id)}
                        data-testid={`button-delete-address-${addr.id}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {!showAddForm ? (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowAddForm(true)}
                data-testid="button-add-new-address"
              >
                <Plus size={16} />
                Add New Address
              </Button>
            ) : (
              <Card className="p-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Plus size={16} className="text-primary" />
                  New Address
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">
                      Address Label
                    </Label>
                    <div className="flex gap-2">
                      {LABEL_OPTIONS.map((label) => (
                        <Button
                          key={label}
                          type="button"
                          variant={newLabel === label ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewLabel(label)}
                          className="gap-1.5"
                          data-testid={`button-label-${label.toLowerCase()}`}
                        >
                          {getLabelIcon(label)}
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-new-flat" className="text-xs">
                        Flat / House No. *
                      </Label>
                      <Input
                        id="profile-new-flat"
                        placeholder="e.g., Flat 4B"
                        value={newAddress.flat_house}
                        onChange={(e) =>
                          setNewAddress((p) => ({
                            ...p,
                            flat_house: e.target.value,
                          }))
                        }
                        data-testid="input-profile-new-flat"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-new-building" className="text-xs">
                        Building Name
                      </Label>
                      <Input
                        id="profile-new-building"
                        placeholder="e.g., Sunrise Apts"
                        value={newAddress.building}
                        onChange={(e) =>
                          setNewAddress((p) => ({
                            ...p,
                            building: e.target.value,
                          }))
                        }
                        data-testid="input-profile-new-building"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-new-street" className="text-xs">
                      Street / Area *
                    </Label>
                    <Textarea
                      id="profile-new-street"
                      placeholder="e.g., 123 Main Street"
                      value={newAddress.street}
                      onChange={(e) =>
                        setNewAddress((p) => ({ ...p, street: e.target.value }))
                      }
                      className="min-h-[50px] resize-none"
                      data-testid="input-profile-new-street"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-new-landmark" className="text-xs">
                      Landmark
                    </Label>
                    <Input
                      id="profile-new-landmark"
                      placeholder="e.g., Near Central Park"
                      value={newAddress.landmark}
                      onChange={(e) =>
                        setNewAddress((p) => ({
                          ...p,
                          landmark: e.target.value,
                        }))
                      }
                      data-testid="input-profile-new-landmark"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-new-city" className="text-xs">
                        City *
                      </Label>
                      <Input
                        id="profile-new-city"
                        placeholder="Mumbai"
                        value={newAddress.city}
                        onChange={(e) =>
                          setNewAddress((p) => ({ ...p, city: e.target.value }))
                        }
                        data-testid="input-profile-new-city"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-new-state" className="text-xs">
                        State *
                      </Label>
                      <Input
                        id="profile-new-state"
                        placeholder="Maharashtra"
                        value={newAddress.state}
                        onChange={(e) =>
                          setNewAddress((p) => ({
                            ...p,
                            state: e.target.value,
                          }))
                        }
                        data-testid="input-profile-new-state"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-new-pincode" className="text-xs">
                        Pincode *
                      </Label>
                      <Input
                        id="profile-new-pincode"
                        placeholder="400001"
                        value={newAddress.pincode}
                        onChange={(e) =>
                          setNewAddress((p) => ({
                            ...p,
                            pincode: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 6),
                          }))
                        }
                        maxLength={6}
                        data-testid="input-profile-new-pincode"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewAddress({
                          flat_house: "",
                          building: "",
                          street: "",
                          landmark: "",
                          city: "",
                          state: "",
                          pincode: "",
                        });
                      }}
                      data-testid="button-cancel-add-address"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      disabled={
                        !newAddress.flat_house ||
                        !newAddress.street ||
                        !newAddress.city ||
                        !newAddress.pincode
                      }
                      onClick={handleAddAddress}
                      data-testid="button-save-address"
                    >
                      Save Address
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!infoDialog}
        onOpenChange={(o) => {
          if (!o) setInfoDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
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
    </div>
  );
}
