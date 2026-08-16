import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UserAddress } from "@/types/user";
import {
  useSetDefaultAddress,
  useDeleteAddress,
  useUpdateAddressCoordinates,
} from "@/hooks/use-addresses";
import { Check, Trash2, Navigation, LocateFixed, MapPin } from "lucide-react";
import { getCurrentPosition } from "@/lib/platform/geolocation";
import { isUsableFix, checkServiceability } from "@/lib/serviceability";
import { getLabelIcon } from "./address-labels";

interface AddressListProps {
  addresses: UserAddress[];
  /**
   * "select": tapping a card picks it for the current order (Cart).
   * "manage": cards are inert; a button promotes one to default (Profile).
   */
  mode: "select" | "manage";
  selectedAddressId?: string;
  onSelectAddress?: (address: UserAddress) => void;
  onNotice: (notice: string | null) => void;
  /** Rendered when there are no saved addresses and the form is closed. */
  showEmptyState?: boolean;
}

export function AddressList({
  addresses,
  mode,
  selectedAddressId,
  onSelectAddress,
  onNotice,
  showEmptyState,
}: AddressListProps) {
  const { mutateAsync: setDefaultAddress } = useSetDefaultAddress();
  const { mutateAsync: deleteAddress } = useDeleteAddress();
  const { mutateAsync: updateCoordinates } = useUpdateAddressCoordinates();
  const [capturing, setCapturing] = useState(false);

  const handleSelect = async (addr: UserAddress) => {
    await setDefaultAddress(addr.id);
    onSelectAddress?.(addr);
  };

  const handleDelete = async (addressId: string) => {
    const isSelected = selectedAddressId === addressId;
    await deleteAddress(addressId);
    if (isSelected) {
      const remaining = addresses.filter((a) => a.id !== addressId);
      const newDefault = remaining.find((a) => a.is_default) || remaining[0];
      if (newDefault) onSelectAddress?.(newDefault);
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
    onNotice(null);
    try {
      const coords = await getCurrentPosition();
      if (!isUsableFix(coords)) {
        onNotice("We couldn't get an accurate location. Try again outdoors.");
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
        onNotice(
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
        onNotice("We couldn't save your location. Please try again.");
      }
    } catch {
      onNotice("We couldn't get your location.");
    } finally {
      setCapturing(false);
    }
  };

  if (addresses.length === 0 && showEmptyState) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
          <MapPin size={24} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No saved addresses</p>
        <p className="text-xs text-muted-foreground mt-1">Add your first delivery address</p>
      </div>
    );
  }

  return (
    <>
      {addresses.map((addr) => {
        // In "select" mode the highlighted card is the one chosen for this
        // order; in "manage" mode there is no selection, so the default is
        // what gets highlighted instead.
        const highlighted = mode === "select" ? selectedAddressId === addr.id : addr.is_default;

        return (
          <Card
            key={addr.id}
            className={`rounded-2xl p-3 transition-all ${
              mode === "select"
                ? `cursor-pointer ${highlighted ? "border-primary ring-1 ring-primary/30" : "hover:shadow-md"}`
                : highlighted
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : ""
            }`}
            onClick={mode === "select" ? () => handleSelect(addr) : undefined}
            data-testid={`address-card-${addr.id}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${highlighted ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {mode === "select" && highlighted ? <Check size={16} /> : getLabelIcon(addr.label)}
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
              <div className="flex items-center gap-1 flex-shrink-0">
                {mode === "manage" && !addr.is_default && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => {
                      void setDefaultAddress(addr.id);
                    }}
                    data-testid={`button-set-default-${addr.id}`}
                  >
                    <Check size={14} />
                  </Button>
                )}
                {addresses.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
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
            </div>
          </Card>
        );
      })}
    </>
  );
}
