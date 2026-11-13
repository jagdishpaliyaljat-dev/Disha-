import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Quote,
  Flame,
  Target,
  BookOpen,
  Compass,
  Sunrise,
  Award,
} from "lucide-react";

export interface MotivationalQuotePoster {
  id: string;
  hindiText: string;
  englishText: string;
  author: string;
  role: string;
  tag: string;
  tagIcon: "flame" | "target" | "book" | "compass" | "sunrise" | "award";
  bgImage: string;
  badgeStyle: string;
}

export const MOTIVATIONAL_POSTERS: MotivationalQuotePoster[] = [
  {
    id: "quote-1",
    hindiText: "Arise, awake, and stop not until the goal is reached.",
    englishText: "Arise, awake, and stop not until the goal is reached.",
    author: "Swami Vivekananda",
    role: "Philosopher & Youth Icon",
    tag: "UNSTOPPABLE WILL",
    tagIcon: "flame",
    bgImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-400/40",
  },
  {
    id: "quote-2",
    hindiText: "Dreams are what keep you awake, not what you see in sleep.",
    englishText: "Dreams are what keep you awake, not what you see in sleep.",
    author: "Dr. A. P. J. Abdul Kalam",
    role: "Missile Man of India",
    tag: "VISION & PASSION",
    tagIcon: "sunrise",
    bgImage: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
    badgeStyle: "bg-sky-500/20 text-sky-300 border-sky-400/40",
  },
  {
    id: "quote-3",
    hindiText: "Devote yourself sincerely to disciplined effort without fear of outcome.",
    englishText: "Devote yourself sincerely to disciplined effort without fear of outcome.",
    author: "Bhagavad Gita",
    role: "Karma Yoga (Ch 2, V 47)",
    tag: "RELENTLESS EFFORT",
    tagIcon: "target",
    bgImage: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=80",
    badgeStyle: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  },
  {
    id: "quote-4",
    hindiText: "Education is the greatest catalyst of courage and self-transformation.",
    englishText: "Education is the greatest catalyst of courage and self-transformation.",
    author: "Dr. B. R. Ambedkar",
    role: "Architect of Constitution",
    tag: "POWER OF KNOWLEDGE",
    tagIcon: "book",
    bgImage: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80",
    badgeStyle: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
  },
  {
    id: "quote-5",
    hindiText: "He who honors time commands absolute mastery over destiny.",
    englishText: "He who honors time commands absolute mastery over destiny.",
    author: "Acharya Chanakya",
    role: "Chanakya Niti & Economics",
    tag: "TIME DISCIPLINE",
    tagIcon: "compass",
    bgImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80",
    badgeStyle: "bg-rose-500/20 text-rose-300 border-rose-400/40",
  },
  {
    id: "quote-6",
    hindiText: "It always seems impossible until it is done. Keep striving.",
    englishText: "It always seems impossible until it is done. Keep striving.",
    author: "Nelson Mandela",
    role: "Global Statesman",
    tag: "RESILIENCE & COURAGE",
    tagIcon: "award",
    bgImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    badgeStyle: "bg-amber-500/20 text-yellow-300 border-yellow-400/40",
  },
];

export const MotivationalPosterBanner: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Touch swipe handling
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentPoster = MOTIVATIONAL_POSTERS[currentIndex];
  const slideDuration = 6500;

  // Auto slide timer
  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MOTIVATIONAL_POSTERS.length);
    }, slideDuration);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % MOTIVATIONAL_POSTERS.length);
  };

  const handlePrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + MOTIVATIONAL_POSTERS.length) % MOTIVATIONAL_POSTERS.length
    );
  };

  // Touch swipe detection
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    if (distance > 45) {
      handleNext();
    } else if (distance < -45) {
      handlePrev();
    }
  };

  const renderTagIcon = (icon: MotivationalQuotePoster["tagIcon"]) => {
    switch (icon) {
      case "flame":
        return <Flame className="w-3 h-3 text-amber-400 fill-amber-400/40" />;
      case "target":
        return <Target className="w-3 h-3 text-emerald-400" />;
      case "book":
        return <BookOpen className="w-3 h-3 text-indigo-400" />;
      case "compass":
        return <Compass className="w-3 h-3 text-rose-400" />;
      case "sunrise":
        return <Sunrise className="w-3 h-3 text-sky-400" />;
      case "award":
        return <Award className="w-3 h-3 text-yellow-400" />;
      default:
        return <Sparkles className="w-3 h-3 text-amber-400" />;
    }
  };

  return (
    <div
      id="motivational-banner-poster-container"
      className="relative w-full rounded-2xl overflow-hidden shadow-sm border border-slate-700/40 dark:border-slate-800/80 bg-slate-950 select-none group touch-pan-y"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Compact Height Box: ~124px mobile, ~132px on sm/md */}
      <div className="relative h-[124px] sm:h-[132px] flex flex-col justify-between p-3 sm:p-3.5">
        {/* Background Image with Cinematic Scrim */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPoster.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            <img
              src={currentPoster.bgImage}
              alt={currentPoster.author}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center filter brightness-[0.70] contrast-[1.12]"
            />
            {/* Deep gradient overlays so text is always 100% legible */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/85 to-slate-950/45" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/30" />
            {/* Subtle inner border */}
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* Ambient watermark Quote icon */}
        <div className="absolute top-1 right-2 sm:right-4 opacity-5 pointer-events-none z-1">
          <Quote className="w-16 h-16 sm:w-20 sm:h-20 text-white transform rotate-180" />
        </div>

        {/* 1. Header Row: Tag Badge */}
        <div className="relative z-10 flex items-center justify-between gap-2 leading-none">
          {/* Tag Badge */}
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide backdrop-blur-md border shadow-2xs ${currentPoster.badgeStyle}`}
          >
            {renderTagIcon(currentPoster.tagIcon)}
            <span>{currentPoster.tag}</span>
          </div>
        </div>

        {/* 2. Body: English Quote + Author Signature in Compact View */}
        <div className="relative z-10 my-auto py-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPoster.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-1"
            >
              {/* English Motivational Quote */}
              <p className="text-[13px] sm:text-[14px] font-extrabold text-white leading-tight line-clamp-2 drop-shadow-sm tracking-wide">
                “{currentPoster.englishText}”
              </p>

              {/* Author & Subtitle Signature */}
              <div className="flex items-center gap-1.5 flex-wrap leading-none">
                <span className="text-[11px] sm:text-xs font-black text-amber-300 drop-shadow-xs">
                  — {currentPoster.author}
                </span>
                <span className="text-[10px] text-slate-400 font-medium border-l border-white/20 pl-1.5">
                  {currentPoster.role}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 3. Bottom Indicator: Slide Dots */}
        <div className="relative z-10 flex items-center justify-start pt-0.5">
          <div className="flex items-center gap-1">
            {MOTIVATIONAL_POSTERS.map((poster, index) => {
              const isActive = currentIndex === index;
              return (
                <button
                  key={poster.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    isActive
                      ? "w-4 h-1.5 bg-amber-400 shadow-2xs shadow-amber-400/50"
                      : "w-1.5 h-1.5 bg-white/25 hover:bg-white/50"
                  }`}
                  aria-label={`Slide ${index + 1}`}
                />
              );
            })}
          </div>
        </div>

        {/* 4. Bottom Animated Progress Bar Timer */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden z-20">
          <motion.div
            key={currentIndex + (!isHovered ? "-playing" : "-paused")}
            initial={{ width: "0%" }}
            animate={{ width: !isHovered ? "100%" : "0%" }}
            transition={{
              duration: !isHovered ? slideDuration / 1000 : 0,
              ease: "linear",
            }}
            className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300"
          />
        </div>
      </div>
    </div>
  );
};
