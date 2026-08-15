import { useLocation } from "wouter";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCancelAccountDeletion } from "@/hooks/use-account-deletion";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";

interface AccountDeletionLockedProps {
  scheduledFor: string;
}

export function AccountDeletionLocked({ scheduledFor }: AccountDeletionLockedProps) {
  const { mutateAsync: cancelDeletion, isPending } = useCancelAccountDeletion();
  const { logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const scheduledDate = (() => {
    const d = new Date(scheduledFor);
    return Number.isNaN(d.getTime()) ? null : format(d, "EEE, d MMM yyyy");
  })();

  const handleRestore = async () => {
    try {
      // On success the hook invalidates the pending-deletion query, so the
      // gate in ProtectedRoute re-evaluates and renders the app.
      await cancelDeletion();
      toast({ title: "Account restored" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't restore account",
        description: await getErrorMessage(err),
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/10 px-4">
      <Card className="w-full max-w-md p-6 space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="text-destructive" size={24} />
        </div>
        <h1 className="text-lg font-display font-bold" data-testid="text-deletion-locked-title">
          Account scheduled for deletion
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This account has started the deletion process
          {scheduledDate ? ` and is scheduled to be removed on ${scheduledDate}` : ""}. You can
          restore it now to keep your account, or log out.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleRestore} disabled={isPending} data-testid="button-restore-account">
            {isPending ? "Restoring…" : "Restore my account"}
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isPending}
            data-testid="button-logout-deletion"
          >
            Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}
