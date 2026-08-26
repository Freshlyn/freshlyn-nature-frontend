import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDeleteAccount } from "@/hooks/use-account-deletion";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";

interface DataPrivacyProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

const DELETE_CONFIRMATION_WORD = "DELETE";

export default function DataPrivacy({ sidebarOpen, onSidebarToggle }: DataPrivacyProps) {
  // Live from public.app_settings, with the shipped text as the fallback: a
  // failed fetch still renders the real policy rather than an empty page.
  const settings = useAppSettings();
  const { mutateAsync: deleteAccount } = useDeleteAccount();
  const { logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleConfirmDelete = async () => {
    try {
      await deleteAccount();
      // Server-side revoke already ran; clear the local session too so the
      // requesting device actually leaves instead of holding a stale token.
      await logout();
      setLocation("/login");
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: await getErrorMessage(err) });
    }
  };

  return (
    <div className="min-h-screen bg-muted/10">
      <Header
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
        backTo="/profile"
        backLabel="Back to Profile"
      />
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <h1 className="text-xl font-display font-bold" data-testid="text-privacy-title">
          Data Privacy & Protection
        </h1>
        <p className="text-xs text-muted-foreground mt-1 mb-4" data-testid="text-privacy-updated">
          Last Updated: {settings.privacy.lastUpdated}
        </p>

        <LegalDocumentView
          document={settings.privacy}
          contact={settings.contact}
          testIdPrefix="privacy"
          contactHeading="Contact Us"
          contactIntro="For any questions about this policy or your data, please reach out:"
        />

        <div className="mt-10 text-center">
          <button
            onClick={() => setConfirmOpen(true)}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2"
            data-testid="link-delete-account"
          >
            Delete my account and data
          </button>
        </div>
      </main>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setConfirmText("");
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete account and data</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This permanently deletes your profile, saved addresses, and order history. This action
              cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">{DELETE_CONFIRMATION_WORD}</span>{" "}
              below to confirm.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              data-testid="input-delete-confirm"
            />
          </div>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== DELETE_CONFIRMATION_WORD}
              onClick={handleConfirmDelete}
              data-testid="button-confirm-delete"
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
