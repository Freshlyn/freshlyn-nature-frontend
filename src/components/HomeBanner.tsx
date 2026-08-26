import { useCallback, useEffect, useRef, useState } from "react";
import { Truck, Clock, Milk, Gift } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type BannerContent, type BannerTheme } from "@/lib/banner-content";
import { useAppSettings } from "@/hooks/use-app-settings";
import { visibleBanners } from "@/lib/app-settings";

const PILL_ICONS = {
  truck: Truck,
  clock: Clock,
  milk: Milk,
  gift: Gift,
} as const;

/**
 * Keys from the content layer resolve to classes here, never the other way
 * round -- content stays serialisable and cannot inject styles.
 */
const THEME_CLASSES: Record<BannerTheme, { gradient: string; accent: string; blob: string }> = {
  green: {
    gradient: "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500",
    accent: "text-yellow-300",
    blob: "bg-yellow-300",
  },
  amber: {
    gradient: "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
    accent: "text-yellow-200",
    blob: "bg-white",
  },
};

const AUTO_ADVANCE_MS = 5000;

export function HomeBannerSkeleton() {
  return (
    <div
      className="relative rounded-2xl md:rounded-3xl overflow-hidden mb-5 md:mb-8 p-5 md:p-8 bg-muted/30 border border-border/40"
      data-testid="hero-skeleton"
    >
      <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
        <div className="flex-1 w-full space-y-3 md:space-y-4">
          <Skeleton className="h-8 md:h-10 w-3/4 mx-auto md:mx-0" />
          <Skeleton className="h-8 md:h-10 w-1/2 mx-auto md:mx-0" />
          <Skeleton className="h-4 w-full max-w-md mx-auto md:mx-0" />
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className="hidden md:block">
          <Skeleton className="w-36 lg:w-48 h-36 lg:h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function BannerCard({ content }: { content: BannerContent }) {
  const theme = THEME_CLASSES[content.theme];
  return (
    <div
      className={`relative w-full shrink-0 snap-center rounded-2xl md:rounded-3xl overflow-hidden ${theme.gradient}`}
      data-testid={`banner-card-${content.id}`}
      role="group"
      aria-roledescription="slide"
      aria-label={`${content.title} ${content.accentText}`}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
        <div className={`absolute bottom-0 left-0 w-32 h-32 ${theme.blob} rounded-full blur-3xl`} />
      </div>
      <div className="relative p-5 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <div className="flex-1 text-center md:text-left space-y-3 md:space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold leading-tight text-white">
              {content.title}
              <br />
              <span className={theme.accent}>{content.accentText}</span>
            </h2>
            <p className="text-sm md:text-base text-white/90 max-w-md">{content.subtitle}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
              {content.pills.map((pill) => {
                const Icon = PILL_ICONS[pill.icon];
                return (
                  <div
                    key={pill.label}
                    className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium"
                  >
                    <Icon size={14} />
                    <span>{pill.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden md:block relative">
            <div className="w-36 lg:w-48 h-36 lg:h-48 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/30 rotate-3 hover:rotate-0 transition-transform">
              <img
                src={content.imageUrl}
                alt={content.imageAlt}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HomeBannerProps {
  /**
   * Overrides the banners from app_settings. Left for tests and for any caller
   * that needs to render a fixed carousel; production passes nothing and gets
   * the live rows.
   */
  banners?: BannerContent[];
}

export function HomeBanner({ banners }: HomeBannerProps) {
  // Live from public.app_settings: a dashboard edit reaches an open carousel
  // through the Realtime subscription, no refresh. visibleBanners drops the
  // disabled rows and resolves {free_delivery_threshold} in the copy, so the
  // component below still renders BannerContent and nothing else.
  const settings = useAppSettings();
  const resolved = banners ?? visibleBanners(settings);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Set while the user is touching or has just swiped: auto-advance stays off
  // until they have been idle again, so the carousel never yanks a card away
  // mid-read.
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The interval below reads the live index from this ref rather than from
  // state, so a smooth scroll's stream of intermediate positions cannot restart
  // the clock mid-flight and cut a card's time on screen short.
  const activeIndexRef = useRef(0);

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: scroller.clientWidth * index, behavior: "smooth" });
  }, []);

  // Derive the active dot from the scroll position rather than from a click
  // handler, so a manual swipe and an auto-advance stay in agreement.
  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const index = Math.round(scroller.scrollLeft / scroller.clientWidth);
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  const pauseAutoAdvance = useCallback(() => {
    setPaused(true);
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), AUTO_ADVANCE_MS * 2);
  }, []);

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  useEffect(() => {
    if (paused || resolved.length < 2) return;
    // Honour the OS "reduce motion" setting: auto-advancing carousels are
    // exactly the unrequested movement that setting exists to stop.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(
      () => scrollToIndex((activeIndexRef.current + 1) % resolved.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(timer);
  }, [resolved.length, paused, scrollToIndex]);

  if (resolved.length === 0) return null;

  return (
    <div className="mb-5 md:mb-8" data-testid="home-banner">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onPointerDown={pauseAutoAdvance}
        onTouchStart={pauseAutoAdvance}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
        aria-roledescription="carousel"
        aria-label="Promotions"
      >
        {resolved.map((banner) => (
          <BannerCard key={banner.id} content={banner} />
        ))}
      </div>

      {resolved.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-3">
          {resolved.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              data-testid={`banner-dot-${index}`}
              aria-label={`Go to promotion ${index + 1} of ${resolved.length}`}
              aria-current={index === activeIndex}
              onClick={() => {
                pauseAutoAdvance();
                scrollToIndex(index);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? "w-6 bg-primary"
                  : "w-2 bg-border hover:bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
