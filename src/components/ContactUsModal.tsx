import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Mail, Clock, ChevronRight } from "lucide-react";

/**
 * Placeholder support contact details.
 *
 * The number is kept in two forms on purpose: `tel:` needs E.164 with no
 * separators to dial reliably, while the UI shows the spaced form. Swap both
 * when the real support line is provisioned.
 */
const SUPPORT_PHONE = "+919876543210";
const SUPPORT_PHONE_DISPLAY = "+91 98765 43210";
const SUPPORT_EMAIL = "info@freshlynature.com";
const SUPPORT_HOURS = "8:00 AM - 8:00 PM";

interface ContactUsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Support contact sheet.
 *
 * The call and email rows are plain anchors rather than buttons that assign
 * `window.location`. Capacitor's WebView client hands any non-http(s) scheme
 * to the OS as an ACTION_VIEW intent, so `tel:` reaches the Android dialer and
 * `mailto:` the mail app with no plugin and no manifest <queries> entry --
 * but only for a real navigation. A scripted location assignment is not
 * dependable inside the WebView, and `target="_blank"` would open an empty
 * tab in front of the intent.
 */
export function ContactUsModal({ open, onOpenChange }: ContactUsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] rounded-3xl sm:max-w-md"
        data-testid="modal-contact-us"
      >
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Phone size={26} className="text-[hsl(var(--primary-deep))]" />
          </div>
          <DialogTitle className="text-xl">Contact Us</DialogTitle>
          <p className="text-sm text-muted-foreground">We're here to help, {SUPPORT_HOURS}</p>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <a
            href={`tel:${SUPPORT_PHONE}`}
            rel="noopener"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent active:bg-accent"
            data-testid="link-contact-call"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Phone size={18} className="text-[hsl(var(--primary-deep))]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Call us</span>
              <span className="block truncate text-sm text-muted-foreground">
                {SUPPORT_PHONE_DISPLAY}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
          </a>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            rel="noopener"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent active:bg-accent"
            data-testid="link-contact-email"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Mail size={18} className="text-[hsl(var(--primary-deep))]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Email us</span>
              <span className="block truncate text-sm text-muted-foreground">{SUPPORT_EMAIL}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
          </a>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Clock size={18} className="text-[hsl(var(--primary-deep))]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Support hours</span>
              <span className="block text-sm text-muted-foreground">{SUPPORT_HOURS}, all days</span>
            </span>
          </div>
        </div>

        <a
          href={`tel:${SUPPORT_PHONE}`}
          rel="noopener"
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-90"
          data-testid="button-contact-call-now"
        >
          <Phone size={16} />
          Call Now
        </a>
      </DialogContent>
    </Dialog>
  );
}
