/**
 * The legal pages' content, separated from the components that render them.
 *
 * /terms and /privacy are the same document shape -- an intro, numbered
 * sections, a contact block and a closing line -- so they share one type and
 * one renderer. That shape is the whole contract: LegalDocument values are all
 * the pages read, which is what lets the text come from public.app_settings
 * without either component changing.
 *
 * Section numbers are NOT stored in the headings. They are derived at render
 * time from position, so inserting or reordering a section in the dashboard
 * renumbers the rest automatically. A section with an empty heading is a
 * continuation of the one above it and is deliberately skipped by the
 * numbering -- several sections here are exactly that.
 */
export interface LegalSection {
  /** Unnumbered when empty: the block continues the section above. */
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface LegalContact {
  address: string;
  /**
   * The general/legal enquiries address shown on /terms and /privacy.
   *
   * Deliberately distinct from supportEmail: the two are different mailboxes,
   * not a typo to be reconciled. Note they also differ by one letter
   * (freshlynnature vs freshlynature), so neither can be derived from the
   * other -- both are stored in full.
   */
  email: string;
  website: string;
  /**
   * Support line, in two forms on purpose. `tel:` needs E.164 with no
   * separators to dial reliably; the UI shows the spaced form.
   */
  supportPhone: string;
  supportPhoneDisplay: string;
  /** The support mailbox, distinct from `email` above. */
  supportEmail: string;
  supportHours: string;
}

export interface LegalDocument {
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
  closing: string;
}

/**
 * Assign display numbers to sections.
 *
 * Returns the number alongside each section rather than baking it into the
 * heading, so the caller stays free to render it however it likes. Continuation
 * blocks (empty heading) get null and do not consume a number.
 */
export function numberSections(
  sections: LegalSection[],
): Array<{ section: LegalSection; number: number | null }> {
  let next = 1;
  return sections.map((section) => ({
    section,
    number: section.heading ? next++ : null,
  }));
}

export const DEFAULT_CONTACT: LegalContact = {
  address: "Freshlyn Nature, Kolkata, West Bengal, India",
  email: "info@freshlynnature.com",
  website: "https://freshlynnature.com/",
  // PLACEHOLDER -- not a working line. Carried over from ContactUsModal, which
  // flagged it as such. It lives in app_settings so the real number can be
  // typed into the dashboard the day it is provisioned, with no code change
  // and no deploy. Until then "Call Now" dials nothing.
  supportPhone: "+919876543210",
  supportPhoneDisplay: "+91 98765 43210",
  supportEmail: "info@freshlynature.com",
  supportHours: "8:00 AM - 8:00 PM",
};

export const DEFAULT_TERMS: LegalDocument = {
  lastUpdated: "May 2, 2026",
  intro:
    'Welcome to Freshlyn Nature! These Terms and Conditions govern your use of our mobile application, products, and services offered by Freshlyn Nature ("the App"). By accessing or using our App, you agree to comply with and be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use the App.',
  closing:
    "By using our App, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.",
  sections: [
    {
      heading: "Definitions",
      paragraphs: ["In these Terms and Conditions:"],
      list: [
        '"Company," "We," "Us," "Our" refer to Freshlyn Nature.',
        '"User," "You," "Your" refer to any person accessing or using our App.',
        '"Products" refer to all goods offered for sale through our App.',
        '"Services" refer to all services provided by Freshlyn Nature.',
      ],
    },
    {
      heading: "Eligibility",
      paragraphs: ["By using this App, you confirm that:"],
      list: [
        "You are at least 18 years old, or",
        "You are using the App under the supervision of a parent or legal guardian.",
      ],
    },
    {
      heading: "Intellectual Property Rights",
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
      heading: "Products and Services",
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
      heading: "Food Safety and Product Usage",
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
      heading: "Orders and Payments",
      list: [
        "All orders placed through the App are subject to acceptance and availability.",
        "We reserve the right to refuse or cancel any order at our discretion.",
        "Full payment must be received before order processing.",
        "Prices are subject to change without prior notice.",
        "In case of pricing errors, we reserve the right to cancel the affected order.",
      ],
    },
    {
      heading: "Shipping and Delivery",
      list: [
        "Delivery timelines shown in the App are estimates only.",
        "Delays may occur due to unforeseen circumstances, including weather, transportation issues, or force majeure events.",
        "Ownership and risk transfer to the customer upon successful delivery.",
      ],
    },
    {
      heading: "Returns, Refunds, and Cancellations",
      paragraphs: [
        "Please refer to our separate Return and Refund Policy, available within the App, for detailed information regarding returns, refunds, replacements, and cancellations.",
      ],
    },
    {
      heading: "User Reviews and Comments",
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
      heading: "Prohibited Activities",
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
      heading: "Third-Party Services and Links",
      paragraphs: [
        "The App may contain links to, or integrations with, third-party services or websites. We are not responsible for the content, privacy policies, or practices of such external services.",
      ],
    },
    {
      heading: "Privacy Policy",
      paragraphs: [
        "Your use of this App is also governed by our Privacy Policy. Please review it carefully.",
      ],
    },
    {
      heading: "Limitation of Liability",
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
      heading: "Indemnification",
      paragraphs: [
        "You agree to indemnify and hold harmless Freshlyn Nature, its directors, employees, affiliates, and partners from any claims, liabilities, damages, losses, or expenses arising out of your breach of these Terms.",
      ],
    },
    {
      heading: "Force Majeure",
      paragraphs: [
        "Freshlyn Nature shall not be held liable for any failure or delay in performance resulting from events beyond our reasonable control, including natural disasters, pandemics, strikes, transportation disruptions, or government actions.",
      ],
    },
    {
      heading: "Governing Law and Jurisdiction",
      paragraphs: [
        "These Terms and Conditions shall be governed by and construed in accordance with the laws of India.",
        "Any disputes arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the courts located in Kolkata, West Bengal.",
      ],
    },
    {
      heading: "Changes to Terms",
      paragraphs: [
        "We reserve the right to update, modify, or replace these Terms and Conditions at any time, with such changes taking effect through an App update or in-app notice.",
        "Your continued use of the App following any changes constitutes acceptance of those changes.",
      ],
    },
  ],
};

export const DEFAULT_PRIVACY: LegalDocument = {
  lastUpdated: "May 2, 2026",
  intro:
    'At Freshlyn Nature, we care about your privacy as much as we care about the quality of what we deliver. This Data Privacy and Protection Policy explains what information we collect through our mobile application ("the App"), how we use it, and the choices you have to keep it safe.',
  closing:
    "Your trust means everything to us. If you ever have questions about how your data is handled, we're just a message away.",
  sections: [
    {
      heading: "Information We Collect",
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
      heading: "How We Use Your Information",
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
      heading: "How We Protect Your Data",
      paragraphs: [
        "We take reasonable technical and organizational measures to keep your information safe, including secure storage practices and restricted access to personal data within our team.",
        "Payments made through the App are handled by trusted, secure payment partners — we do not store your full card or banking details on our systems.",
      ],
    },
    {
      heading: "Sharing of Information",
      paragraphs: ["We do not sell your personal information. We may share limited data with:"],
      list: [
        "Delivery partners, to fulfill and track your orders.",
        "Payment providers, to process transactions securely.",
        "Service providers who help us operate the App, under confidentiality obligations.",
        "Authorities, only when required by applicable law.",
      ],
    },
    {
      heading: "Your Choices and Rights",
      paragraphs: ["You are always in control of your information. You can:"],
      list: [
        "Review and update your profile details from within the App at any time.",
        "Manage or delete saved addresses and payment methods.",
        "Opt out of promotional notifications while still receiving order updates.",
        "Request deletion of your account and associated data by contacting us.",
      ],
    },
    {
      heading: "Data Retention",
      paragraphs: [
        "We retain your information only for as long as needed to provide our services, meet legal obligations, and resolve disputes. Once no longer required, your data is securely removed.",
      ],
    },
    {
      heading: "Children's Privacy",
      paragraphs: [
        "The App is not directed at children. If you are under 18, please use the App only under the supervision of a parent or legal guardian, as outlined in our Terms & Conditions.",
      ],
    },
    {
      heading: "Updates to This Policy",
      paragraphs: [
        "We may update this policy from time to time to reflect improvements to our practices or changes in the law. Continued use of the App after an update means you accept the revised policy.",
      ],
    },
  ],
};
