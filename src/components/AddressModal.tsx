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
  /**
   * Fired when the last saved address is deleted. "select" callers use it to
   * drop a selected id that no longer refers to an existing row.
   */
  onAllAddressesDeleted?: () => void;
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
  onAllAddressesDeleted,
}: AddressModalProps) {
  const { data: addresses = [], isLoading: addressesLoading } = useAddresses();
  const [showAddForm, setShowAddForm] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [saveVerdict, setSaveVerdict] = useState<string | null>(null);

  /**
   * True once the user has dismissed the auto-opened form, so it is not
   * immediately re-derived on the next render.
   */
  const [dismissedAutoForm, setDismissedAutoForm] = useState(false);

  /**
   * With nothing saved there is no list to choose from and exactly one useful
   * action, so the dialog opens straight into the form -- turning a
   * two-screen, three-tap flow into one tap.
   *
   * Derived during render rather than set from an effect: an effect would
   * cascade an extra render and briefly paint the empty state first, which is
   * the exact screen this removes.
   *
   * Gated on `addressesLoading` because `addresses` defaults to [] while the
   * query is in flight; acting on that would flash the form open for users who
   * do have addresses.
   */
  const shouldAutoOpenForm =
    open && !addressesLoading && addresses.length === 0 && !dismissedAutoForm;
  const formVisible = showAddForm || shouldAutoOpenForm;
  // Cancelling a form the user never asked for should close the dialog; one
  // they opened themselves falls back to the list.
  const autoOpenedForm = shouldAutoOpenForm && !showAddForm;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          // Reset the transient view state so reopening starts clean rather
          // than showing a stale verdict from the previous visit.
          setShowAddForm(false);
          setDismissedAutoForm(false);
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
            onAllAddressesDeleted={onAllAddressesDeleted}
            onNotice={setCaptureNotice}
            showEmptyState={!formVisible}
          />

          {!formVisible ? (
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
              onCancel={() => {
                setShowAddForm(false);
                // Cancelling a form we opened for them would otherwise land on
                // the empty state the auto-open exists to skip, so the whole
                // dialog closes instead.
                if (autoOpenedForm) {
                  setDismissedAutoForm(true);
                  onClose();
                }
              }}
              onNotice={setCaptureNotice}
              onVerdict={setSaveVerdict}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
