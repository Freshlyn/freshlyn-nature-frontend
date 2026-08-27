/**
 * The downloadable receipt for a single order.
 *
 * Rendered as an ordinary page and saved via the browser's own print-to-PDF
 * rather than generated with a PDF library. That choice is deliberate:
 * jspdf/pdfmake would add several hundred KB to a bundle that ships inside a
 * Capacitor APK, and would need an embedded font before the rupee sign
 * rendered at all. The print stylesheet in index.css strips the chrome, so
 * what reaches the page is the document and nothing else.
 *
 * All framing and arithmetic come from buildReceipt -- this file only lays
 * out what it returns.
 */
import { useOrder } from "@/hooks/use-orders";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useParams } from "wouter";
import { Download, FileText, Share2 } from "lucide-react";
import { isNative } from "@/lib/platform";
import { buildReceipt, formatMoney, isReceiptAvailable } from "@/lib/receipt";
import type { ReceiptOrder } from "@/lib/receipt";

interface ReceiptPageProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

/**
 * Hand the document to the platform.
 *
 * On the web this is simply the print dialog, whose "Save as PDF"
 * destination is the download.
 *
 * On Android, window.print() is unreliable inside a WebView, so the Web Share
 * API opens the system sheet instead and the user picks Print or a PDF
 * target from there. navigator.share is used rather than @capacitor/share
 * deliberately: the WebView supports it, so the fallback costs no extra
 * dependency in the APK. If it is missing or the user dismisses the sheet we
 * still fall through to print rather than leaving a dead button.
 */
async function saveReceipt(title: string): Promise<void> {
  if (isNative() && typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text: title, url: window.location.href });
      return;
    } catch {
      // Dismissed or unsupported -- fall through to print.
    }
  }
  window.print();
}

function ReceiptSkeleton() {
  return (
    <main className="container mx-auto px-4 py-6 max-w-2xl pb-24" data-testid="receipt-skeleton">
      <Card className="p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-px w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>
    </main>
  );
}

function NotAvailable({ orderId, reason }: { orderId?: string; reason: string }) {
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center py-20">
        <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-bold">Receipt not available</h2>
        <p className="text-muted-foreground mt-2 mb-6">{reason}</p>
        <Link href={orderId ? `/orders/${orderId}` : "/orders"}>
          <Button data-testid="button-back-to-order">Back to Order</Button>
        </Link>
      </div>
    </main>
  );
}

export default function ReceiptPage({ sidebarOpen, onSidebarToggle }: ReceiptPageProps) {
  const params = useParams<{ id: string }>();
  const orderId = params.id || "";
  const { data: order, isLoading } = useOrder(orderId);
  const settings = useAppSettings();

  const chrome = (children: React.ReactNode) => (
    <div className="min-h-screen bg-muted/10">
      <div className="print:hidden">
        <Header
          sidebarOpen={sidebarOpen}
          onSidebarToggle={onSidebarToggle}
          backTo={`/orders/${orderId}`}
          backLabel="Back to Order"
        />
      </div>
      {children}
    </div>
  );

  if (isLoading) return chrome(<ReceiptSkeleton />);

  if (!order) {
    return chrome(
      <NotAvailable reason="This order doesn't exist or belongs to another account." />,
    );
  }

  // The gate that keeps the app from attesting to money it has not received.
  if (!isReceiptAvailable(order)) {
    return chrome(
      <NotAvailable
        orderId={orderId}
        reason="A receipt is issued once payment has been completed. This order is still awaiting payment."
      />,
    );
  }

  const receipt = buildReceipt(order as unknown as ReceiptOrder, settings.seller);

  return chrome(
    <main className="container mx-auto px-4 py-6 max-w-2xl pb-24 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
        <h1 className="text-xl font-display font-bold" data-testid="text-receipt-title">
          {receipt.title}
        </h1>
        <Button
          onClick={() => saveReceipt(`${receipt.title} ${receipt.number}`)}
          data-testid="button-download-receipt"
        >
          {isNative() ? (
            <Share2 size={16} className="mr-2" />
          ) : (
            <Download size={16} className="mr-2" />
          )}
          {isNative() ? "Share / Save" : "Download PDF"}
        </Button>
      </div>

      <Card
        className="p-6 print:border-0 print:shadow-none print:rounded-none"
        data-testid="receipt-document"
      >
        {/* Seller block */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="font-display font-bold text-lg leading-tight">
              {receipt.seller.tradeName}
            </p>
            {receipt.seller.legalName !== receipt.seller.tradeName && (
              <p className="text-xs text-muted-foreground">{receipt.seller.legalName}</p>
            )}
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {receipt.seller.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>{receipt.seller.email}</p>
              <p>{receipt.seller.phoneDisplay}</p>
              {receipt.gstin && <p className="mt-1">GSTIN: {receipt.gstin}</p>}
              {receipt.seller.fssai && <p>FSSAI: {receipt.seller.fssai}</p>}
            </div>
          </div>

          <div className="text-right">
            <p
              className="font-display font-bold text-base uppercase tracking-wide"
              data-testid="text-receipt-heading"
            >
              {receipt.subtitle}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Receipt No.{" "}
              <span className="font-medium text-foreground" data-testid="text-receipt-number">
                {receipt.number}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{receipt.issuedOn}</p>
          </div>
        </div>

        <div className="border-t border-border my-4" />

        {/* Buyer block */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-sm mb-1">Delivered To</p>
            <p className="text-muted-foreground" data-testid="text-receipt-address">
              {receipt.deliveryAddress}
            </p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">Payment</p>
            <p className="text-muted-foreground" data-testid="text-receipt-payment">
              {receipt.paymentLabel}
            </p>
            <p className="text-muted-foreground mt-1 break-all">Order ID: {receipt.orderId}</p>
          </div>
        </div>

        <div className="border-t border-border my-4" />

        {/* Lines */}
        <table className="w-full text-sm" data-testid="receipt-lines">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left font-medium pb-2">Description</th>
              <th className="text-right font-medium pb-2 whitespace-nowrap">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.id} className="border-b border-border/60 align-top">
                <td className="py-2 pr-4">
                  <p className="font-medium">{line.description}</p>
                  <p className="text-xs text-muted-foreground">{line.detail}</p>
                </td>
                <td className="py-2 text-right whitespace-nowrap">{formatMoney(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 ml-auto w-full max-w-[16rem] space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span data-testid="text-receipt-subtotal">{formatMoney(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery Fee</span>
            <span data-testid="text-receipt-delivery-fee">
              {receipt.deliveryFee > 0 ? formatMoney(receipt.deliveryFee) : "Free"}
            </span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
            <span>Total Paid</span>
            <span data-testid="text-receipt-total">{formatMoney(receipt.total)}</span>
          </div>
        </div>

        {/* Legal footer. The tax note is the line that keeps a bill of supply
            from being mistaken for a tax invoice. */}
        <div className="border-t border-border mt-6 pt-3 text-[10px] text-muted-foreground leading-relaxed">
          {receipt.taxNote && (
            <p className="font-medium" data-testid="text-receipt-tax-note">
              {receipt.taxNote}
            </p>
          )}
          <p className="mt-1">
            This is a computer-generated {receipt.subtitle.toLowerCase()} and does not require a
            signature.
          </p>
        </div>
      </Card>
    </main>,
  );
}
