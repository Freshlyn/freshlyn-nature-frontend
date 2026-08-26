import { Card } from "@/components/ui/card";
import { numberSections, type LegalContact, type LegalDocument } from "@/lib/legal-content";

interface LegalDocumentViewProps {
  document: LegalDocument;
  contact: LegalContact;
  /** Prefix for data-testid attributes, e.g. "terms" or "privacy". */
  testIdPrefix: string;
  /** Lead-in above the address block, which differs between the two pages. */
  contactHeading: string;
  contactIntro: string;
}

/**
 * Renders a legal document -- shared by /terms and /privacy, which had
 * byte-identical markup before this existed.
 *
 * Section numbers are computed here rather than stored in the headings, so the
 * contact block can be the last numbered section without an operator having to
 * know what number it lands on. Reordering or inserting sections in the
 * dashboard renumbers everything automatically.
 */
export function LegalDocumentView({
  document,
  contact,
  testIdPrefix,
  contactHeading,
  contactIntro,
}: LegalDocumentViewProps) {
  const numbered = numberSections(document.sections);
  // The contact block is the section after the last numbered one.
  const contactNumber = numbered.reduce((max, n) => Math.max(max, n.number ?? 0), 0) + 1;

  return (
    <Card className="p-4 space-y-6">
      <p
        className="text-sm text-muted-foreground leading-relaxed"
        data-testid={`text-${testIdPrefix}-intro`}
      >
        {document.intro}
      </p>

      {numbered.map(({ section, number }, index) => (
        <div key={index} data-testid={`section-${testIdPrefix}-${index}`}>
          {section.heading && (
            <h2 className="text-sm font-semibold text-foreground mb-2">
              {number}. {section.heading}
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
                <li key={lIndex} className="text-sm text-muted-foreground leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div data-testid={`section-${testIdPrefix}-contact`}>
        <h2 className="text-sm font-semibold text-foreground mb-2">
          {contactNumber}. {contactHeading}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{contactIntro}</p>
        <ul className="text-sm text-muted-foreground leading-relaxed space-y-1">
          <li>
            <span className="font-medium text-foreground">Address:</span> {contact.address}
          </li>
          <li>
            <span className="font-medium text-foreground">Email:</span> {contact.email}
          </li>
          <li>
            {/* tel: as a real anchor, matching ContactUsModal -- inside the
                Capacitor WebView a plain navigation is what reaches the OS
                dialer. */}
            <span className="font-medium text-foreground">Phone:</span>{" "}
            <a href={`tel:${contact.supportPhone}`} rel="noopener" className="hover:underline">
              {contact.supportPhoneDisplay}
            </a>
          </li>
          <li>
            <span className="font-medium text-foreground">Website:</span> {contact.website}
          </li>
        </ul>
      </div>

      <p
        className="text-sm text-muted-foreground leading-relaxed"
        data-testid={`text-${testIdPrefix}-closing`}
      >
        {document.closing}
      </p>
    </Card>
  );
}
