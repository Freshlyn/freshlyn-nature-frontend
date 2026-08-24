interface OutOfStockStampProps {
  /** "sm" sits in a product card's price row; "block" fills the modal's CTA slot. */
  size?: "sm" | "block";
  className?: string;
  "data-testid"?: string;
}

/**
 * The label that stands in for an Add button when nothing is left to sell.
 *
 * Deliberately flat -- muted border, no fill, no shadow -- so it never reads as
 * a disabled version of the green Add button sitting on every other card. A
 * greyed-out button keeps a button's affordance and invites the tap it is meant
 * to refuse; a stamp does not. This mirrors Blinkit/Zepto, which swap the
 * control outright rather than dimming it.
 *
 * Not a <button>: there is no action to perform, and a disabled button would
 * still take up a tab stop for keyboard users.
 */
export function OutOfStockStamp({
  size = "sm",
  className = "",
  "data-testid": testId,
}: OutOfStockStampProps) {
  const sizeClasses =
    size === "block"
      ? "h-11 w-full text-xs tracking-[0.12em]"
      : "h-9 px-3 text-[10px] tracking-[0.08em]";

  return (
    <div
      // aria-hidden would strip the only cue a screen reader gets that the
      // item is unavailable, so the text is left readable.
      className={`inline-flex items-center justify-center rounded-xl border-[1.5px] border-dashed border-muted-foreground/40 bg-muted/40 font-bold uppercase text-muted-foreground select-none ${sizeClasses} ${className}`}
      data-testid={testId}
    >
      Out of Stock
    </div>
  );
}
