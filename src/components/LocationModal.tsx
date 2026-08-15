import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { getCurrentPosition } from "@/lib/platform/geolocation";
import { isUsableFix, checkServiceability } from "@/lib/serviceability";
import { useWaitlistSignup } from "@/hooks/use-serviceability";
import { normalizeIndianPhone } from "@/lib/phone";
import type { LocationPreference } from "@/lib/location-preference";

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called once the screen has an answer. A null argument means the user
   * skipped -- the caller stores nothing and may ask again next launch.
   */
  onResolved: (pref: LocationPreference | null) => void;
}

/**
 * The app-open screen.
 *
 * Advisory ONLY. It saves no address and has no influence on checkout; its
 * single purpose is to tell someone outside the coverage area early, rather
 * than after they have built a cart. Every outcome, including a rejection,
 * reaches the catalogue -- nothing here can lock a user out.
 */
export function LocationModal({ open, onOpenChange, onResolved }: LocationModalProps) {
  const [loading, setLoading] = useState(false);
  // Progressive disclosure: the pincode field does not exist until GPS has
  // actually failed. Showing both at once invites the user to type a pincode
  // and skip the accurate tier entirely.
  const [showPincode, setShowPincode] = useState(false);
  const [pincode, setPincode] = useState("");
  const [outOfArea, setOutOfArea] = useState(false);
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  // Whichever signal produced the rejection, kept so the waitlist row records
  // WHERE the demand is -- that is the entire point of collecting it.
  const [lastSignal, setLastSignal] = useState<{
    latitude: number | null;
    longitude: number | null;
    pincode: string | null;
  }>({ latitude: null, longitude: null, pincode: null });

  const { mutateAsync: joinWaitlist } = useWaitlistSignup();

  const resolve = (pref: LocationPreference) => {
    onResolved(pref);
    onOpenChange(false);
  };

  const handleUseLocation = async () => {
    setLoading(true);
    try {
      const coords = await getCurrentPosition();
      // A reading worse than the threshold is not a position. It is treated
      // identically to a denial, which on a desktop browser is the common case.
      if (!isUsableFix(coords)) {
        setShowPincode(true);
        return;
      }

      setLastSignal({ latitude: coords.latitude, longitude: coords.longitude, pincode: null });
      const verdict = await checkServiceability({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (verdict.serviceable) {
        resolve({
          serviceable: true,
          label: "Your location",
          matchedBy: "gps",
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        return;
      }
      setOutOfArea(true);
    } catch {
      // Denial, Android permanent denial, timeout, position unavailable: four
      // causes, one outcome. On Android a second refusal is sticky and the OS
      // shows no dialog at all, so there is effectively one clean attempt.
      setShowPincode(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePincode = async () => {
    if (pincode.length !== 6) return;
    setLoading(true);
    try {
      setLastSignal({ latitude: null, longitude: null, pincode });
      const verdict = await checkServiceability({ pincode });
      if (verdict.serviceable) {
        resolve({ serviceable: true, label: pincode, matchedBy: "pincode" });
        return;
      }
      setOutOfArea(true);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!waitlistPhone) return;
    setWaitlistError(null);
    // Every other table stores E.164; normalizing at this boundary keeps the
    // waitlist consistent with how the auth flow addresses a phone number.
    const normalized = normalizeIndianPhone(waitlistPhone);
    if (!normalized) {
      setWaitlistError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setWaitlistSubmitting(true);
    try {
      await joinWaitlist({ phone: normalized, ...lastSignal });
      setWaitlistDone(true);
    } catch {
      // This screen exists specifically to capture demand from out-of-area
      // users -- a silently dropped signup is a real product loss, so the
      // user must be told and left able to retry.
      setWaitlistError("We couldn't save your number. Please try again.");
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const handleContinueAnyway = () => {
    // The rejection is stored too, so the screen is shown ONCE. Re-prompting
    // an out-of-area user on every launch is the behaviour this replaces.
    resolve({
      serviceable: false,
      label: lastSignal.pincode ?? "Out of area",
      matchedBy: lastSignal.pincode ? "pincode" : "gps",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 pb-8 text-center">
          <div className="mx-auto bg-white p-3 rounded-full w-fit shadow-md mb-4 text-primary">
            <MapPin size={32} />
          </div>
          <DialogTitle className="text-2xl font-bold font-display">
            {outOfArea ? "We're not in your area yet" : "Where should we deliver?"}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {outOfArea
              ? "FreshLyn covers parts of Kolkata and is expanding."
              : "We'll check if we deliver to your area."}
          </DialogDescription>
        </div>

        <div className="p-6 pt-2 space-y-4">
          {outOfArea ? (
            <>
              {waitlistDone ? (
                <p
                  className="text-sm text-center text-muted-foreground"
                  data-testid="text-waitlist-done"
                >
                  Thanks — we'll text you when we reach you.
                </p>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Phone number"
                    inputMode="tel"
                    value={waitlistPhone}
                    onChange={(e) =>
                      setWaitlistPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    data-testid="input-waitlist-phone"
                  />
                  {waitlistError && (
                    <p
                      className="text-xs text-destructive text-center"
                      data-testid="text-waitlist-error"
                    >
                      {waitlistError}
                    </p>
                  )}
                  <Button
                    className="w-full rounded-xl"
                    disabled={waitlistPhone.length !== 10 || waitlistSubmitting}
                    onClick={handleJoinWaitlist}
                    data-testid="button-join-waitlist"
                  >
                    {waitlistSubmitting ? "Saving…" : "Tell me when you're here"}
                  </Button>
                </div>
              )}
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleContinueAnyway}
                data-testid="button-continue-browsing"
              >
                Continue browsing anyway
              </Button>
            </>
          ) : (
            <>
              {/* The explanatory line above sits BEFORE the OS permission
                  dialog on purpose. Deferring the prompt behind an explicit
                  tap raises grant rates markedly, and on Android a denial is
                  sticky -- there is effectively one clean attempt. */}
              <Button
                size="lg"
                className="w-full rounded-xl gap-2 font-bold shadow-lg shadow-primary/20"
                onClick={handleUseLocation}
                disabled={loading}
                data-testid="button-use-current-location"
              >
                <Navigation size={18} />
                {loading ? "Checking…" : "Use my current location"}
              </Button>

              {showPincode && (
                <div className="space-y-2" data-testid="section-pincode-fallback">
                  <p className="text-xs text-muted-foreground text-center">
                    No problem — enter your pincode instead.
                  </p>
                  <Input
                    placeholder="700019"
                    inputMode="numeric"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    data-testid="input-pincode"
                  />
                  <Button
                    className="w-full rounded-xl"
                    disabled={pincode.length !== 6 || loading}
                    onClick={handlePincode}
                    data-testid="button-check-pincode"
                  >
                    Check this pincode
                  </Button>
                </div>
              )}

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    onResolved(null);
                    onOpenChange(false);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-skip-location"
                >
                  Skip for now
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
