/**
 * The hero carousel's content, separated from the component that renders it.
 *
 * This shape is deliberately the whole contract: HomeBanner renders
 * BannerContent values and nothing else, so the day these come from the
 * backend instead of the constant below, only the source changes -- the
 * component, its responsive classes and its markup stay put.
 *
 * Icons and colours are carried as KEYS rather than as imported components or
 * raw Tailwind class strings, so the whole shape stays serialisable: a backend
 * row can send exactly this JSON. The keys are mapped back to real classes in
 * HomeBanner, which also means a row can never inject arbitrary CSS, and a
 * theme change restyles every banner without a content edit.
 */
export interface BannerPill {
  icon: "truck" | "clock" | "milk" | "gift";
  label: string;
}

/** Named gradients rather than free-form classes -- see the note above. */
export type BannerTheme = "green" | "amber";

export interface BannerContent {
  /** Stable identity, used as the React key and the scroll-snap target. */
  id: string;
  /** Headline's first line, rendered above the accent. */
  title: string;
  /** Second headline line, picked out in the accent colour. */
  accentText: string;
  subtitle: string;
  pills: BannerPill[];
  imageUrl: string;
  imageAlt: string;
  theme: BannerTheme;
  /**
   * Whether the card is shown. Optional, defaulting to true, so an operator
   * adding a banner row does not have to know about the flag -- but a card can
   * be parked in the table without reaching customers, which is how content
   * for an unbuilt feature is staged.
   */
  enabled?: boolean;
}

export const DEFAULT_BANNERS: BannerContent[] = [
  {
    id: "fast-delivery",
    title: "Fresh Groceries,",
    accentText: "Delivered Fast",
    subtitle: "Get your daily essentials delivered to your doorstep in minutes",
    pills: [
      { icon: "truck", label: "Free over ₹{free_delivery_threshold}" },
      { icon: "clock", label: "30 min" },
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop",
    imageAlt: "Fresh Fruits",
    theme: "green",
  },
  {
    // PLACEHOLDER COPY -- this offer is NOT honoured at checkout yet.
    //
    // subscription_durations only carries discount_percent (5/10/15/20% for
    // the 15/30/60/90 ladder); there is no bonus-days concept, and create_order
    // schedules exactly duration_days deliveries. Granting 30 deliveries for
    // the price of 25 needs a schema + RPC change first.
    //
    // Until that lands this row stays enabled: false -- present and editable in
    // public.app_settings, but never rendered. Flip it on in the dashboard the
    // day the schema honours the offer.
    id: "milk-subscription",
    title: "Buy 25 Days,",
    accentText: "Get 30 Days Milk",
    subtitle: "Subscribe to your daily milk and get 5 extra days free",
    pills: [
      { icon: "milk", label: "Daily delivery" },
      { icon: "gift", label: "5 days free" },
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop",
    imageAlt: "Fresh Milk",
    theme: "amber",
    enabled: false,
  },
];
