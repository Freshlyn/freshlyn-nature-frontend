import { Header } from "@/components/Header";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { useAppSettings } from "@/hooks/use-app-settings";

interface TermsAndConditionsProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export default function TermsAndConditions({
  sidebarOpen,
  onSidebarToggle,
}: TermsAndConditionsProps) {
  // Live from public.app_settings, with the shipped text as the fallback: a
  // failed fetch still renders the real policy rather than an empty page.
  const settings = useAppSettings();

  return (
    <div className="min-h-screen bg-muted/10">
      <Header
        sidebarOpen={sidebarOpen}
        onSidebarToggle={onSidebarToggle}
        backTo="/profile"
        backLabel="Back to Profile"
      />
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <h1 className="text-xl font-display font-bold" data-testid="text-terms-title">
          Terms & Conditions
        </h1>
        <p className="text-xs text-muted-foreground mt-1 mb-4" data-testid="text-terms-updated">
          Last Updated: {settings.terms.lastUpdated}
        </p>

        <LegalDocumentView
          document={settings.terms}
          contact={settings.contact}
          testIdPrefix="terms"
          contactHeading="Contact Information"
          contactIntro="For any questions regarding these Terms and Conditions, please contact us:"
        />
      </main>
    </div>
  );
}
