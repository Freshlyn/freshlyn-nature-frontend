import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UserAddress } from "@/types/user";
import {
  useAddresses,
  useAddAddress,
  useSetDefaultAddress,
  useDeleteAddress,
  useUpdateAddressCoordinates,
} from "@/hooks/use-addresses";
import {
  MapPin,
  Plus,
  Check,
  Trash2,
  Home,
  Briefcase,
  Tag,
  Navigation,
  LocateFixed,
} from "lucide-react";
import { getCurrentPosition } from "@/lib/platform/geolocation";
import { isUsableFix, checkServiceability } from "@/lib/serviceability";

interface AddressModalProps {
  open: boolean;
  onClose: () => void;
  selectedAddressId?: string;
  onSelectAddress: (address: UserAddress) => void;
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

export function AddressModal({
  open,
  onClose,
  selectedAddressId,
  onSelectAddress,
}: AddressModalProps) {
  const { data: addresses = [] } = useAddresses();
  const { mutateAsync: addAddress } = useAddAddress();
  const { mutateAsync: setDefaultAddress } = useSetDefaultAddress();
  const { mutateAsync: deleteAddress } = useDeleteAddress();
  const { mutateAsync: updateCoordinates } = useUpdateAddressCoordinates();
  const [showAddForm, setShowAddForm] = useState(false);
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
  const [capturing, setCapturing] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [saveVerdict, setSaveVerdict] = useState<string | null>(null);

  /**
   * Saves the address, with or without coordinates.
   *
   * `atThisAddress` is the answer to "are you standing here right now?" -- a
   * question only the user can answer, which is why it is asked explicitly
   * even when the OS permission is already granted. Silently attaching the
   * current position to a typed address would reintroduce exactly the failure
   * this whole feature exists to prevent: a user at their office ordering to
   * their home would pin the office.
   */
  const handleAddAddress = async (atThisAddress: boolean) => {
    if (
      !newAddress.flat_house ||
      !newAddress.street ||
      !newAddress.city ||
      newAddress.pincode.length !== 6
    )
      return;

    let latitude: number | null = null;
    let longitude: number | null = null;
    setCaptureNotice(null);

    if (atThisAddress) {
      setCapturing(true);
      try {
        const coords = await getCurrentPosition();
        if (isUsableFix(coords)) {
          latitude = coords.latitude;
          longitude = coords.longitude;
        } else {
          // A 5km-accurate fix written onto the row would make a wrong verdict
          // permanent, so it is discarded exactly like a denial.
          setCaptureNotice(
            "We couldn't get an accurate location — we'll check delivery using your pincode.",
          );
        }
      } catch {
        // Denial, permanent Android denial, timeout, unavailable: all four are
        // the same outcome. Saving is never blocked by a location failure.
        setCaptureNotice(
          "We couldn't get your location — we'll check delivery using your pincode.",
        );
      } finally {
        setCapturing(false);
      }
    }

    let addr: UserAddress;
    try {
      addr = await addAddress({
        label: newLabel,
        is_default: addresses.length === 0,
        ...newAddress,
        latitude,
        longitude,
      });
    } catch {
      // The user's typed input must survive so they can retry without
      // re-entering it -- do not touch the form or proceed to the verdict.
      setCaptureNotice(
        "We couldn't save this address. Please check your connection and try again.",
      );
      return;
    }

    // Advisory feedback, shown after the save rather than gating it: the user
    // may be adding an address ahead of an expansion, so it is always kept.
    const verdict = await checkServiceability({ latitude, longitude, pincode: newAddress.pincode });
    setSaveVerdict(
      verdict.serviceable ? "We deliver here." : "We don't deliver to this address yet.",
    );

    onSelectAddress(addr);
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

  const handleSelect = async (addr: UserAddress) => {
    await setDefaultAddress(addr.id);
    onSelectAddress(addr);
    onClose();
  };

  const handleDelete = async (addressId: string) => {
    const isSelected = selectedAddressId === addressId;
    await deleteAddress(addressId);
    if (isSelected) {
      const remaining = addresses.filter((a) => a.id !== addressId);
      const newDefault = remaining.find((a) => a.is_default) || remaining[0];
      if (newDefault) onSelectAddress(newDefault);
    }
  };

  /**
   * Upgrades a pincode-tier address to GPS-tier.
   *
   * This is the path back for an address typed from elsewhere: the next time
   * the user is standing at it, one tap pins it accurately and every future
   * order -- including scheduled subscription deliveries -- switches from the
   * coarse pincode allowlist to the polygon.
   */
  const handleConfirmLocation = async (addressId: string) => {
    setCapturing(true);
    setCaptureNotice(null);
    try {
      const coords = await getCurrentPosition();
      if (!isUsableFix(coords)) {
        setCaptureNotice("We couldn't get an accurate location. Try again outdoors.");
        return;
      }
      // Guard the upgrade: this is a ONE-WAY move from pincode-tier (which
      // ignores the polygon) to GPS-tier (which is bound by it). The seeded
      // polygons are placeholders that don't yet cover every serviceable
      // pincode's true extent, so writing a fix the polygon rejects would
      // silently lock out an address that orders fine today, with no
      // self-service way back. Check before writing, never after.
      const verdict = await checkServiceability({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (!verdict.serviceable) {
        setCaptureNotice(
          "We can't confirm delivery at this exact spot, so we've kept your address as it is. Your orders are unaffected.",
        );
        return;
      }
      try {
        await updateCoordinates({
          addressId,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      } catch {
        // The location WAS obtained here -- it is the database write that
        // failed, so this must not be reported as a capture failure.
        setCaptureNotice("We couldn't save your location. Please try again.");
      }
    } catch {
      setCaptureNotice("We couldn't get your location.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            Delivery Address
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {captureNotice && (
            <p className="text-xs text-muted-foreground" data-testid="text-capture-notice">
              {captureNotice}
            </p>
          )}
          {saveVerdict && (
            <p className="text-xs font-medium" data-testid="text-save-verdict">
              {saveVerdict}
            </p>
          )}
          {addresses.map((addr) => (
            <Card
              key={addr.id}
              className={`p-3 cursor-pointer transition-all ${selectedAddressId === addr.id ? "border-primary ring-1 ring-primary/30" : "hover:shadow-md"}`}
              onClick={() => handleSelect(addr)}
              data-testid={`address-card-${addr.id}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedAddressId === addr.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {selectedAddressId === addr.id ? <Check size={16} /> : getLabelIcon(addr.label)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{addr.label}</span>
                    {addr.is_default && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        Default
                      </Badge>
                    )}
                    {addr.latitude !== null && addr.longitude !== null && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-primary"
                        title="Location confirmed at this address"
                        data-testid={`tier-gps-${addr.id}`}
                      >
                        <LocateFixed size={11} />
                        Pinned
                      </span>
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
                  {(addr.latitude === null || addr.longitude === null) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-6 px-1 text-[11px] text-muted-foreground hover:text-primary"
                      disabled={capturing}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmLocation(addr.id);
                      }}
                      data-testid={`button-confirm-location-${addr.id}`}
                    >
                      <Navigation size={11} className="mr-1" />
                      Confirm location
                    </Button>
                  )}
                </div>
                {addresses.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(addr.id);
                    }}
                    data-testid={`button-delete-address-${addr.id}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
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
                  <Label className="text-xs mb-1.5 block">Address Label</Label>
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
                    <Label htmlFor="new-flat" className="text-xs">
                      Flat / House No. *
                    </Label>
                    <Input
                      id="new-flat"
                      placeholder="e.g., Flat 4B"
                      value={newAddress.flat_house}
                      onChange={(e) => setNewAddress((p) => ({ ...p, flat_house: e.target.value }))}
                      data-testid="input-new-flat"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-building" className="text-xs">
                      Building Name
                    </Label>
                    <Input
                      id="new-building"
                      placeholder="e.g., Sunrise Apts"
                      value={newAddress.building}
                      onChange={(e) => setNewAddress((p) => ({ ...p, building: e.target.value }))}
                      data-testid="input-new-building"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-street" className="text-xs">
                    Street / Area *
                  </Label>
                  <Textarea
                    id="new-street"
                    placeholder="e.g., 123 Main Street"
                    value={newAddress.street}
                    onChange={(e) => setNewAddress((p) => ({ ...p, street: e.target.value }))}
                    className="min-h-[50px] resize-none"
                    data-testid="input-new-street"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-landmark" className="text-xs">
                    Landmark
                  </Label>
                  <Input
                    id="new-landmark"
                    placeholder="e.g., Near Central Park"
                    value={newAddress.landmark}
                    onChange={(e) => setNewAddress((p) => ({ ...p, landmark: e.target.value }))}
                    data-testid="input-new-landmark"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-city" className="text-xs">
                      City *
                    </Label>
                    <Input
                      id="new-city"
                      placeholder="Mumbai"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))}
                      data-testid="input-new-city"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-state" className="text-xs">
                      State *
                    </Label>
                    <Input
                      id="new-state"
                      placeholder="Maharashtra"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress((p) => ({ ...p, state: e.target.value }))}
                      data-testid="input-new-state"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pincode" className="text-xs">
                      Pincode *
                    </Label>
                    <Input
                      id="new-pincode"
                      placeholder="400001"
                      value={newAddress.pincode}
                      onChange={(e) =>
                        setNewAddress((p) => ({
                          ...p,
                          pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      maxLength={6}
                      data-testid="input-new-pincode"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-sm font-semibold">Are you at this address right now?</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    We'll save this spot so we can confirm we deliver here — including for your
                    scheduled orders.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {/* Primary when this is the user's first address: during
                      onboarding most people are at home. With addresses
                      already saved, the odds of standing at a NEW one are low,
                      so both options get equal weight. */}
                  <Button
                    type="button"
                    size="sm"
                    variant={addresses.length === 0 ? "default" : "outline"}
                    disabled={
                      capturing ||
                      !newAddress.flat_house ||
                      !newAddress.street ||
                      !newAddress.city ||
                      newAddress.pincode.length !== 6
                    }
                    onClick={() => handleAddAddress(true)}
                    data-testid="button-save-address-here"
                  >
                    <Navigation size={14} className="mr-1.5" />
                    {capturing ? "Getting your location…" : "Yes, I'm here — use my location"}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      capturing ||
                      !newAddress.flat_house ||
                      !newAddress.street ||
                      !newAddress.city ||
                      newAddress.pincode.length !== 6
                    }
                    onClick={() => handleAddAddress(false)}
                    data-testid="button-save-address-elsewhere"
                  >
                    No, I'm adding this for elsewhere
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
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
                </div>
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
