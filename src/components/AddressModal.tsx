import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UserAddress } from "@/types/user";
import { useAddresses } from "@/hooks/use-addresses";
import { AddressList } from "@/components/address/AddressList";
import { AddressForm } from "@/components/address/AddressForm";
import { MapPin, Plus } from "lucide-react";

interface AddressModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * "select": picking a card chooses it for the current order and closes the
   * dialog (checkout). "manage": the list is a management view with an
   * explicit set-default button and no selection (profile).
   */
  mode: "select" | "manage";
  /** Header text -- the only copy that differs between the two callers. */
  title: string;
  selectedAddressId?: string;
  /** Required in "select" mode; ignored in "manage". */
  onSelectAddress?: (address: UserAddress) => void;
}

/**
 * The saved-address dialog, shared by checkout and profile.
 *
 * Both callers render the same shell -- header, capture/verdict notices, the
 * address list, and the add-address form behind a toggle -- so the shell lives
 * here once and the two modes differ only in the title and in what selecting a
 * card means.
 */
export function AddressModal({
  open,
  onClose,
  mode,
  title,
  selectedAddressId,
  onSelectAddress,
}: AddressModalProps) {
  const { data: addresses = [] } = useAddresses();
  const [showAddForm, setShowAddForm] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [saveVerdict, setSaveVerdict] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          // Reset the transient view state so reopening starts clean rather
          // than showing a stale verdict from the previous visit.
          setShowAddForm(false);
          setCaptureNotice(null);
          setSaveVerdict(null);
          onClose();
        }
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            {title}
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

          <AddressList
            addresses={addresses}
            mode={mode}
            selectedAddressId={selectedAddressId}
            onSelectAddress={
              mode === "select"
                ? (addr) => {
                    onSelectAddress?.(addr);
                    onClose();
                  }
                : undefined
            }
            onNotice={setCaptureNotice}
            showEmptyState={!showAddForm}
          />

          {!showAddForm ? (
            <Button
              variant="outline"
              className="w-full gap-2 rounded-xl"
              onClick={() => setShowAddForm(true)}
              data-testid="button-add-new-address"
            >
              <Plus size={16} />
              Add New Address
            </Button>
          ) : (
            <AddressForm
              isFirstAddress={addresses.length === 0}
              onSaved={(addr) => {
                // Selecting on save is what makes a freshly added address the
                // one the order goes to; in manage mode there is nothing to
                // select, so the save just closes the form.
                if (mode === "select") onSelectAddress?.(addr);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
              onNotice={setCaptureNotice}
              onVerdict={setSaveVerdict}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
