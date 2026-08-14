import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
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

interface PrivacySection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

const LAST_UPDATED = "May 2, 2026";

const INTRO =
  'At Freshlyn Nature, we care about your privacy as much as we care about the quality of what we deliver. This Data Privacy and Protection Policy explains what information we collect through our mobile application ("the App"), how we use it, and the choices you have to keep it safe.';

const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: "1. Information We Collect",
    paragraphs: ["To provide you with our products and services, we may collect:"],
    list: [
      "Contact details such as your name, phone number, and email address.",
      "Delivery addresses and location information.",
      "Order history, preferences, and subscription details.",
      "Payment information, processed securely through our payment partners.",
      "Basic device and app usage information to help us improve your experience.",
    ],
  },
  {
    heading: "2. How We Use Your Information",
    paragraphs: ["We use your information to:"],
    list: [
      "Process and deliver your orders accurately and on time.",
      "Keep you updated on order status, offers, and subscription reminders.",
      "Improve the App's features, performance, and reliability.",
      "Respond to your questions and provide customer support.",
      "Meet legal and regulatory requirements, including food safety compliance.",
    ],
  },
  {
    heading: "3. How We Protect Your Data",
    paragraphs: [
      "We take reasonable technical and organizational measures to keep your information safe, including secure storage practices and restricted access to personal data within our team.",
      "Payments made through the App are handled by trusted, secure payment partners — we do not store your full card or banking details on our systems.",
    ],
  },
  {
    heading: "4. Sharing of Information",
    paragraphs: [
      "We do not sell your personal information. We may share limited data with:",
    ],
    list: [
      "Delivery partners, to fulfill and track your orders.",
      "Payment providers, to process transactions securely.",
      "Service providers who help us operate the App, under confidentiality obligations.",
      "Authorities, only when required by applicable law.",
    ],
  },
  {
    heading: "5. Your Choices and Rights",
    paragraphs: ["You are always in control of your information. You can:"],
    list: [
      "Review and update your profile details from within the App at any time.",
      "Manage or delete saved addresses and payment methods.",
      "Opt out of promotional notifications while still receiving order updates.",
      "Request deletion of your account and associated data by contacting us.",
    ],
  },
  {
    heading: "6. Data Retention",
    paragraphs: [
      "We retain your information only for as long as needed to provide our services, meet legal obligations, and resolve disputes. Once no longer required, your data is securely removed.",
    ],
  },
  {
    heading: "7. Children's Privacy",
    paragraphs: [
      "The App is not directed at children. If you are under 18, please use the App only under the supervision of a parent or legal guardian, as outlined in our Terms & Conditions.",
    ],
  },
  {
    heading: "8. Updates to This Policy",
    paragraphs: [
      "We may update this policy from time to time to reflect improvements to our practices or changes in the law. Continued use of the App after an update means you accept the revised policy.",
    ],
  },
];

const CONTACT = {
  address: "Freshlyn Nature, Kolkata, West Bengal, India",
  email: "info@freshlynnature.com",
  website: "https://freshlynnature.com/",
};

const CLOSING =
  "Your trust means everything to us. If you ever have questions about how your data is handled, we're just a message away.";

const DELETE_CONFIRMATION_WORD = "DELETE";

export default function DataPrivacy({
  sidebarOpen,
  onSidebarToggle,
}: DataPrivacyProps) {
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
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} backTo="/profile" backLabel="Back to Profile" />
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <h1
          className="text-xl font-display font-bold"
          data-testid="text-privacy-title"
        >
          Data Privacy & Protection
        </h1>
        <p className="text-xs text-muted-foreground mt-1 mb-4" data-testid="text-privacy-updated">
          Last Updated: {LAST_UPDATED}
        </p>

        <Card className="p-4 space-y-6">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-privacy-intro">
            {INTRO}
          </p>

          {PRIVACY_SECTIONS.map((section, index) => (
            <div key={index} data-testid={`section-privacy-${index}`}>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph, pIndex) => (
                <p
                  key={pIndex}
                  className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="list-disc pl-5 space-y-1">
                  {section.list.map((item, lIndex) => (
                    <li
                      key={lIndex}
                      className="text-sm text-muted-foreground leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div data-testid="section-privacy-contact">
            <h2 className="text-sm font-semibold text-foreground mb-2">
              9. Contact Us
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              For any questions about this policy or your data, please reach out:
            </p>
            <ul className="text-sm text-muted-foreground leading-relaxed space-y-1">
              <li>
                <span className="font-medium text-foreground">Address:</span>{" "}
                {CONTACT.address}
              </li>
              <li>
                <span className="font-medium text-foreground">Email:</span>{" "}
                {CONTACT.email}
              </li>
              <li>
                <span className="font-medium text-foreground">Website:</span>{" "}
                {CONTACT.website}
              </li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-privacy-closing">
            {CLOSING}
          </p>
        </Card>

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
              This permanently deletes your profile, saved addresses, and order history. This
              action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">{DELETE_CONFIRMATION_WORD}</span> below to confirm.
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
