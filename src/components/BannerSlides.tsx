import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppBanner } from "../types";

interface BannerSlidesProps {
  banners?: AppBanner[];
  onNavigateTab?: (tab: any) => void;
}

const DEFAULT_BANNER_SLIDES: AppBanner[] = [
  {
    id: "default_banner_1",
    title: "DISHA 20-20 Live Test Series",
    subtitle: "Right Direction, Accurate Preparation · Real-time All-India ranking",
    badge: "Live Arena",
    color: "from-[#800020] via-[#6B001B] to-[#3B0613]",
    iconName: "Image",
    actionLabel: "Attempt Live Test",
    actionTab: "live_tests",
    isActive: true,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "default_banner_2",
    title: "Official PYQ Vault (2013–2025)",
    subtitle: "RAS, 1st Grade, Patwar, REET & CET solved papers",
    badge: "PYQ Archive",
    color: "from-[#171923] via-[#2A1B1E] to-[#800020]",
    iconName: "Image",
    actionLabel: "Explore PYQ Papers",
    actionTab: "pyq_vault",
    isActive: true,
    order: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export const BannerSlides: React.FC<BannerSlidesProps> = ({ banners, onNavigateTab }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const displayBanners: AppBanner[] = banners && banners.length > 0 ? banners : DEFAULT_BANNER_SLIDES;
  const safeCurrentIndex = currentIndex < displayBanners.length ? currentIndex : 0;

  useEffect(() => {
    if (displayBanners.length <= 1 || isHovered) return;

    const timer = setTimeout(() => {
      setCurrentIndex((curr) => (curr + 1) % displayBanners.length);
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentIndex, isHovered, displayBanners.length]);

  const paginate = (newDirection: number) => {
    if (displayBanners.length <= 1) return;
    if (newDirection > 0) {
      setCurrentIndex((prev) => (prev + 1) % displayBanners.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + displayBanners.length) % displayBanners.length);
    }
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

  return (
    <section
      className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl min-h-[164px] sm:min-h-[184px] h-[168px] sm:h-[188px] touch-pan-y border border-[#E8D9C0] dark:border-[#31374A] shadow-xs select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence mode="wait" initial={false}>
        {displayBanners.map((banner, index) => {
          return (
            index === safeCurrentIndex && (
              <motion.div
                key={banner.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_e, { offset, velocity }) => {
                  const swipe = swipePower(offset.x, velocity.x);
                  if (swipe < -swipeConfidenceThreshold) {
                    paginate(1);
                  } else if (swipe > swipeConfidenceThreshold) {
                    paginate(-1);
                  }
                }}
                onClick={() => banner.actionTab && onNavigateTab?.(banner.actionTab)}
                initial={{ opacity: 0, scale: 1.01 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{
                  duration: 0.3,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className={`absolute inset-0 bg-gradient-to-br ${banner.color || "from-[#800020] to-[#3B0613]"} cursor-pointer overflow-hidden`}
              >
                {banner.imageUrl ? (
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || "DISHA 20-20 Banner"}
                    className="w-full h-full object-cover"
                    loading="eager"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col justify-center px-4 sm:px-8 py-3.5 sm:py-5 text-[#FFF9EF] select-none relative z-10">
                    {/* Subtle geometric compass arch motif in corner */}
                    <svg
                      viewBox="0 0 120 120"
                      className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-20 h-20 sm:w-28 sm:h-28 opacity-10 pointer-events-none"
                      aria-hidden="true"
                    >
                      <path
                        d="M25 100 V46 C25 32 40 20 60 12 C80 20 95 32 95 46 V100"
                        fill="none"
                        stroke="#C99A45"
                        strokeWidth="4"
                      />
                      <circle cx="60" cy="56" r="24" fill="none" stroke="#FFF9EF" strokeWidth="2.5" />
                    </svg>

                    {banner.badge && (
                      <span className="inline-flex items-center self-start text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg bg-[#F47B20] text-white mb-1 sm:mb-1.5 shadow-xs shrink-0">
                        {banner.badge}
                      </span>
                    )}
                    <h3 className="text-base sm:text-xl font-extrabold tracking-tight leading-snug line-clamp-2 max-w-[92%]">
                      {banner.title}
                    </h3>
                    {banner.subtitle && (
                      <p className="text-[11px] sm:text-sm font-medium text-[#FFF9EF]/90 line-clamp-2 mt-0.5 sm:mt-1 font-hindi max-w-[92%] leading-tight">
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.actionLabel && (
                      <div className="mt-2 sm:mt-2.5 inline-flex items-center gap-1 sm:gap-1.5 self-start text-[11px] sm:text-xs font-black bg-[#FFF9EF] text-[#800020] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl shadow-xs shrink-0 active:scale-95 transition-transform">
                        {banner.actionLabel}
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
              </motion.div>
            )
          );
        })}
      </AnimatePresence>

      {/* Progress Indicators */}
      <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
        {displayBanners.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Banner slide ${i + 1}`}
            onClick={() => setCurrentIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer overflow-hidden relative ${
              i === safeCurrentIndex ? "w-9 bg-white/35" : "w-2 bg-white/50"
            }`}
          >
            {i === safeCurrentIndex && (
              <motion.div
                key={`${safeCurrentIndex}-${isHovered ? "paused" : "playing"}`}
                className="absolute inset-y-0 left-0 bg-[#F47B20]"
                initial={{ width: "0%" }}
                animate={{ width: isHovered ? "0%" : "100%" }}
                transition={{ duration: isHovered ? 0.2 : 5, ease: "linear" }}
              />
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
