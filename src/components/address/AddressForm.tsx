import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { UserAddress } from "@/types/user";
import { useAddAddress } from "@/hooks/use-addresses";
import { Plus, Navigation } from "lucide-react";
import { getCurrentPosition } from "@/lib/platform/geolocation";
import { isUsableFix, checkServiceability } from "@/lib/serviceability";
import { LABEL_OPTIONS, getLabelIcon, EMPTY_ADDRESS_FIELDS } from "./address-labels";

interface AddressFormProps {
  /**
   * Drives which save button is visually primary and whether the new address
   * becomes the default -- both hinge on "is this the user's first address?".
   */
  isFirstAddress: boolean;
  onSaved: (address: UserAddress) => void;
  onCancel: () => void;
  /** Reports capture/verdict text upward so the host can render it above the list. */
  onNotice: (notice: string | null) => void;
  onVerdict: (verdict: string | null) => void;
}

export function AddressForm({
  isFirstAddress,
  onSaved,
  onCancel,
  onNotice,
  onVerdict,
}: AddressFormProps) {
  const { mutateAsync: addAddress } = useAddAddress();
  const [newLabel, setNewLabel] = useState("Home");
  const [newAddress, setNewAddress] = useState({ ...EMPTY_ADDRESS_FIELDS });
  const [capturing, setCapturing] = useState(false);

  const incomplete =
    !newAddress.flat_house ||
    !newAddress.street ||
    !newAddress.city ||
    newAddress.pincode.length !== 6;

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
    if (incomplete) return;

    let latitude: number | null = null;
    let longitude: number | null = null;
    onNotice(null);

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
          onNotice(
            "We couldn't get an accurate location — we'll check delivery using your pincode.",
          );
        }
      } catch {
        // Denial, permanent Android denial, timeout, unavailable: all four are
        // the same outcome. Saving is never blocked by a location failure.
        onNotice("We couldn't get your location — we'll check delivery using your pincode.");
      } finally {
        setCapturing(false);
      }
    }

    let addr: UserAddress;
    try {
      addr = await addAddress({
        label: newLabel,
        is_default: isFirstAddress,
        ...newAddress,
        latitude,
        longitude,
      });
    } catch {
      // The user's typed input must survive so they can retry without
      // re-entering it -- do not touch the form or proceed to the verdict.
      onNotice("We couldn't save this address. Please check your connection and try again.");
      return;
    }

    // Advisory feedback, shown after the save rather than gating it: the user
    // may be adding an address ahead of an expansion, so it is always kept.
    const verdict = await checkServiceability({ latitude, longitude, pincode: newAddress.pincode });
    onVerdict(verdict.serviceable ? "We deliver here." : "We don't deliver to this address yet.");

    onSaved(addr);
    setNewAddress({ ...EMPTY_ADDRESS_FIELDS });
    setNewLabel("Home");
  };

  return (
    <Card className="rounded-2xl p-4">
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
              className="rounded-xl"
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
              className="rounded-xl"
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
            className="min-h-[50px] resize-none rounded-xl"
            data-testid="input-new-street"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-landmark" className="text-xs">
            Landmark
          </Label>
          <Input
            className="rounded-xl"
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
              className="rounded-xl"
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
              className="rounded-xl"
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
              className="rounded-xl"
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
            We'll save this spot so we can confirm we deliver here — including for your scheduled
            orders.
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
            variant={isFirstAddress ? "default" : "outline"}
            className="rounded-xl"
            disabled={capturing || incomplete}
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
            className="rounded-xl"
            disabled={capturing || incomplete}
            onClick={() => handleAddAddress(false)}
            data-testid="button-save-address-elsewhere"
          >
            No, I'm adding this for elsewhere
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setNewAddress({ ...EMPTY_ADDRESS_FIELDS });
              onCancel();
            }}
            data-testid="button-cancel-add-address"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
