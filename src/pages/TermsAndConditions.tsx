import { Header } from "@/components/Header";
import { MobileBackButton } from "@/components/MobileBackButton";
import { Card } from "@/components/ui/card";

interface TermsAndConditionsProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

interface TermsSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

const LAST_UPDATED = "May 2, 2026";

const INTRO =
  'Welcome to Freshlyn Nature! These Terms and Conditions govern your use of our mobile application, products, and services offered by Freshlyn Nature ("the App"). By accessing or using our App, you agree to comply with and be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use the App.';

const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: "1. Definitions",
    paragraphs: ["In these Terms and Conditions:"],
    list: [
      '"Company," "We," "Us," "Our" refer to Freshlyn Nature.',
      '"User," "You," "Your" refer to any person accessing or using our App.',
      '"Products" refer to all goods offered for sale through our App.',
      '"Services" refer to all services provided by Freshlyn Nature.',
    ],
  },
  {
    heading: "2. Eligibility",
    paragraphs: ["By using this App, you confirm that:"],
    list: [
      "You are at least 18 years old, or",
      "You are using the App under the supervision of a parent or legal guardian.",
    ],
  },
  {
    heading: "3. Intellectual Property Rights",
    paragraphs: [
      "Unless otherwise stated, all content within this App, including but not limited to text, images, graphics, logos, product descriptions, videos, and software, is the exclusive property of Freshlyn Nature and is protected by applicable intellectual property laws.",
      "You may not:",
    ],
    list: [
      "Copy, reproduce, republish, or redistribute any material.",
      "Sell, rent, or sub-license any content.",
      "Use our trademarks, branding, or logos without prior written permission.",
      "Decompile, reverse-engineer, or attempt to extract the source code of the App, except as permitted by law.",
    ],
  },
  {
    heading: "4. Products and Services",
    paragraphs: [
      "Freshlyn Nature offers natural, fresh, and premium-quality products. We strive to ensure that all product descriptions, images, pricing, and availability shown in the App are accurate.",
      "However, we reserve the right to:",
    ],
    list: [
      "Modify or discontinue any product without prior notice.",
      "Correct any errors, inaccuracies, or omissions.",
      "Limit product quantities at our sole discretion.",
    ],
  },
  {
    heading: "5. Food Safety and Product Usage",
    paragraphs: [
      "All food, dairy, and consumable products sold by Freshlyn Nature are manufactured, processed, and packaged in accordance with applicable food safety standards, including FSSAI regulations.",
      "Customers are responsible for:",
    ],
    list: [
      "Checking product labels and expiry dates upon delivery.",
      "Storing products according to the instructions provided.",
      "Consuming products before the recommended date.",
    ],
  },
  {
    heading: "",
    paragraphs: [
      "Freshlyn Nature shall not be liable for any damage, spoilage, or health issues arising from improper storage, mishandling, or use after delivery.",
    ],
  },
  {
    heading: "6. Orders and Payments",
    list: [
      "All orders placed through the App are subject to acceptance and availability.",
      "We reserve the right to refuse or cancel any order at our discretion.",
      "Full payment must be received before order processing.",
      "Prices are subject to change without prior notice.",
      "In case of pricing errors, we reserve the right to cancel the affected order.",
    ],
  },
  {
    heading: "7. Shipping and Delivery",
    list: [
      "Delivery timelines shown in the App are estimates only.",
      "Delays may occur due to unforeseen circumstances, including weather, transportation issues, or force majeure events.",
      "Ownership and risk transfer to the customer upon successful delivery.",
    ],
  },
  {
    heading: "8. Returns, Refunds, and Cancellations",
    paragraphs: [
      "Please refer to our separate Return and Refund Policy, available within the App, for detailed information regarding returns, refunds, replacements, and cancellations.",
    ],
  },
  {
    heading: "9. User Reviews and Comments",
    paragraphs: [
      "Users may post reviews, comments, and feedback within the App.",
      "By submitting content, you represent that:",
    ],
    list: [
      "The content is accurate and lawful.",
      "You own or control all rights to the content.",
      "The content does not violate any third-party rights.",
      "The content is not defamatory, offensive, obscene, or misleading.",
    ],
  },
  {
    heading: "",
    paragraphs: [
      "We reserve the right to monitor, edit, or remove any content without prior notice. By posting content, you grant Freshlyn Nature a non-exclusive, royalty-free, perpetual, and worldwide license to use, reproduce, modify, and publish such content.",
    ],
  },
  {
    heading: "10. Prohibited Activities",
    paragraphs: ["You agree not to:"],
    list: [
      "Use the App for unlawful purposes.",
      "Upload malicious software or harmful code.",
      "Attempt unauthorized access to our systems or App backend.",
      "Interfere with the App's operation or functionality.",
      "Collect customer data without authorization.",
      "Engage in fraudulent activities.",
    ],
  },
  {
    heading: "11. Third-Party Services and Links",
    paragraphs: [
      "The App may contain links to, or integrations with, third-party services or websites. We are not responsible for the content, privacy policies, or practices of such external services.",
    ],
  },
  {
    heading: "12. Privacy Policy",
    paragraphs: [
      "Your use of this App is also governed by our Privacy Policy. Please review it carefully.",
    ],
  },
  {
    heading: "13. Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, Freshlyn Nature shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from:",
    ],
    list: [
      "Your use of our App.",
      "Purchase or use of our products.",
      "Service interruptions, App downtime, or technical issues.",
      "Errors or omissions in App content.",
    ],
  },
  {
    heading: "14. Indemnification",
    paragraphs: [
      "You agree to indemnify and hold harmless Freshlyn Nature, its directors, employees, affiliates, and partners from any claims, liabilities, damages, losses, or expenses arising out of your breach of these Terms.",
    ],
  },
  {
    heading: "15. Force Majeure",
    paragraphs: [
      "Freshlyn Nature shall not be held liable for any failure or delay in performance resulting from events beyond our reasonable control, including natural disasters, pandemics, strikes, transportation disruptions, or government actions.",
    ],
  },
  {
    heading: "16. Governing Law and Jurisdiction",
    paragraphs: [
      "These Terms and Conditions shall be governed by and construed in accordance with the laws of India.",
      "Any disputes arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the courts located in Kolkata, West Bengal.",
    ],
  },
  {
    heading: "17. Changes to Terms",
    paragraphs: [
      "We reserve the right to update, modify, or replace these Terms and Conditions at any time, with such changes taking effect through an App update or in-app notice.",
      "Your continued use of the App following any changes constitutes acceptance of those changes.",
    ],
  },
];

const CONTACT = {
  address: "Freshlyn Nature, Kolkata, West Bengal, India",
  email: "info@freshlynnature.com",
  website: "https://freshlynnature.com/",
};

const CLOSING =
  "By using our App, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.";

export default function TermsAndConditions({
  sidebarOpen,
  onSidebarToggle,
}: TermsAndConditionsProps) {
  return (
    <div className="min-h-screen bg-muted/10">
      <Header sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <MobileBackButton to="/profile" label="Back to Profile" />

        <h1
          className="text-xl font-display font-bold"
          data-testid="text-terms-title"
        >
          Terms & Conditions
        </h1>
        <p className="text-xs text-muted-foreground mt-1 mb-4" data-testid="text-terms-updated">
          Last Updated: {LAST_UPDATED}
        </p>

        <Card className="p-4 space-y-6">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-terms-intro">
            {INTRO}
          </p>

          {TERMS_SECTIONS.map((section, index) => (
            <div key={index} data-testid={`section-terms-${index}`}>
              {section.heading && (
                <h2 className="text-sm font-semibold text-foreground mb-2">
                  {section.heading}
                </h2>
              )}
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

          <div data-testid="section-terms-contact">
            <h2 className="text-sm font-semibold text-foreground mb-2">
              18. Contact Information
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              For any questions regarding these Terms and Conditions, please contact us:
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

          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-terms-closing">
            {CLOSING}
          </p>
        </Card>
      </main>
    </div>
  );
}
