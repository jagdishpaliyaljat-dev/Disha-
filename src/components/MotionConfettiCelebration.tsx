import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Award, CheckCircle2, Sparkles, X, RotateCcw, ArrowRight, Zap, Target, Star } from "lucide-react";
import confetti from "canvas-confetti";
import { playVictoryFanfare, triggerHaptic } from "../utils/audioFeedback";

export interface MotionConfettiCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  totalQuestions: number;
  sessionTitle?: string;
  accuracy?: number; // defaults to 100
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
}

interface ParticleConfig {
  id: number;
  shape: "ribbon" | "square" | "circle" | "diamond" | "star" | "streamer";
  color: string;
  leftPercent: number;
  driftX: number;
  duration: number;
  delay: number;
  rotations: number;
  scale: number;
  flipX: boolean;
  flipY: boolean;
}

const CELEBRATION_COLORS = [
  "#F59E0B", // Gold
  "#FBBF24", // Amber
  "#10B981", // Emerald
  "#059669", // Dark Emerald
  "#3B82F6", // Sapphire Blue
  "#2563EB", // Royal Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#06B6D4", // Cyan
  "#F97316", // Bright Orange
];

export const MotionConfettiCelebration: React.FC<MotionConfettiCelebrationProps> = ({
  isOpen,
  onClose,
  totalQuestions,
  sessionTitle = "MCQ Session",
  accuracy = 100,
  soundEnabled = true,
  hapticEnabled = true,
}) => {
  const [windowHeight, setWindowHeight] = useState(800);
  const [windowWidth, setWindowWidth] = useState(1000);
  const [burstCount, setBurstCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowHeight(window.innerHeight || 800);
      setWindowWidth(window.innerWidth || 1000);
      const handleResize = () => {
        setWindowHeight(window.innerHeight || 800);
        setWindowWidth(window.innerWidth || 1000);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Trigger audio fanfare and canvas-confetti bursts alongside framer motion
  useEffect(() => {
    if (isOpen) {
      playVictoryFanfare(soundEnabled);
      triggerHaptic("success", hapticEnabled);

      // Canvas confetti cannons as complementary visual punch
      try {
        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
          zIndex: 100,
        };

        const fire = (particleRatio: number, opts: confetti.Options) => {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
          });
        };

        fire(0.25, {
          spread: 26,
          startVelocity: 55,
          origin: { x: 0.2, y: 0.8 },
        });
        fire(0.2, {
          spread: 60,
          origin: { x: 0.5, y: 0.75 },
        });
        fire(0.35, {
          spread: 100,
          decay: 0.91,
          scalar: 0.8,
          origin: { x: 0.8, y: 0.8 },
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2,
          origin: { x: 0.5, y: 0.65 },
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 45,
          origin: { x: 0.5, y: 0.7 },
        });
      } catch (_) {}
    }
  }, [isOpen, burstCount, soundEnabled, hapticEnabled]);

  // Generate 75 varied confetti particles for framer-motion physics
  const particles = useMemo<ParticleConfig[]>(() => {
    const shapes: ParticleConfig["shape"][] = [
      "ribbon",
      "square",
      "circle",
      "diamond",
      "star",
      "streamer",
    ];
    return Array.from({ length: 75 }).map((_, i) => {
      const color = CELEBRATION_COLORS[i % CELEBRATION_COLORS.length];
      const shape = shapes[i % shapes.length];
      return {
        id: i,
        shape,
        color,
        leftPercent: (i * 1.33 + Math.random() * 2) % 96 + 2, // 2% to 98%
        driftX: (Math.random() - 0.5) * 160,
        duration: 3.2 + Math.random() * 2.8,
        delay: Math.random() * 1.8,
        rotations: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
        scale: 0.7 + Math.random() * 0.6,
        flipX: Math.random() > 0.5,
        flipY: Math.random() > 0.5,
      };
    });
  }, [burstCount]);

  // Corner cannon particles (bursting outward from bottom-left & bottom-right)
  const cannonParticles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const isLeft = i % 2 === 0;
      const angle = isLeft
        ? (Math.PI / 4) + (Math.random() - 0.5) * 0.4
        : (3 * Math.PI / 4) + (Math.random() - 0.5) * 0.4;
      const speed = 400 + Math.random() * 350;
      return {
        id: `cannon-${i}`,
        startX: isLeft ? 40 : windowWidth - 40,
        startY: windowHeight - 40,
        targetX: (isLeft ? 40 : windowWidth - 40) + Math.cos(angle) * speed,
        targetY: windowHeight - 40 - Math.sin(angle) * speed,
        color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length],
        duration: 1.8 + Math.random() * 1.4,
        delay: (i % 6) * 0.08,
        scale: 0.8 + Math.random() * 0.5,
      };
    });
  }, [windowWidth, windowHeight, burstCount]);

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBurstCount((prev) => prev + 1);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="perfect-celebration-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden pointer-events-auto select-none"
        style={{
          backgroundColor: "rgba(11, 18, 32, 0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      >
        {/* ────────────────── FRAMER-MOTION FALLING CONFETTI RAIN ────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {particles.map((p) => {
            const endY = windowHeight + 80;
            return (
              <motion.div
                key={`p-${burstCount}-${p.id}`}
                initial={{
                  x: 0,
                  y: -60,
                  rotateZ: 0,
                  rotateX: 0,
                  rotateY: 0,
                  opacity: 0,
                  scale: p.scale,
                }}
                animate={{
                  x: [0, p.driftX * 0.5, -p.driftX * 0.3, p.driftX],
                  y: [-60, endY * 0.35, endY * 0.7, endY],
                  rotateZ: [0, p.rotations * 0.4, p.rotations * 0.7, p.rotations],
                  rotateX: p.flipX ? [0, 180, 360, 540] : [0, 0, 0, 0],
                  rotateY: p.flipY ? [0, 180, 360, 540] : [0, 0, 0, 0],
                  opacity: [0, 1, 1, 0.9, 0],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: [0.25, 0.1, 0.25, 1],
                  repeat: 1,
                  repeatDelay: 0.5,
                }}
                style={{
                  position: "absolute",
                  left: `${p.leftPercent}%`,
                  top: 0,
                  transformOrigin: "center center",
                }}
              >
                {p.shape === "ribbon" && (
                  <div
                    style={{
                      width: "12px",
                      height: "22px",
                      backgroundColor: p.color,
                      borderRadius: "3px",
                      boxShadow: `0 0 8px ${p.color}55`,
                    }}
                  />
                )}
                {p.shape === "square" && (
                  <div
                    style={{
                      width: "11px",
                      height: "11px",
                      backgroundColor: p.color,
                      borderRadius: "2px",
                      boxShadow: `0 0 6px ${p.color}55`,
                    }}
                  />
                )}
                {p.shape === "circle" && (
                  <div
                    style={{
                      width: "13px",
                      height: "13px",
                      backgroundColor: p.color,
                      borderRadius: "50%",
                      boxShadow: `0 0 6px ${p.color}55`,
                    }}
                  />
                )}
                {p.shape === "diamond" && (
                  <div
                    style={{
                      width: "11px",
                      height: "11px",
                      backgroundColor: p.color,
                      transform: "rotate(45deg)",
                      borderRadius: "2px",
                      boxShadow: `0 0 6px ${p.color}55`,
                    }}
                  />
                )}
                {p.shape === "streamer" && (
                  <div
                    style={{
                      width: "6px",
                      height: "30px",
                      backgroundColor: p.color,
                      borderRadius: "999px",
                      boxShadow: `0 0 8px ${p.color}55`,
                    }}
                  />
                )}
                {p.shape === "star" && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={p.color}
                    style={{ filter: `drop-shadow(0 0 4px ${p.color})` }}
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ────────────────── FRAMER-MOTION CORNER CANNON PARTICLES ────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {cannonParticles.map((cp) => (
            <motion.div
              key={`cannon-${burstCount}-${cp.id}`}
              initial={{
                x: cp.startX,
                y: cp.startY,
                scale: 0.2,
                opacity: 0,
                rotate: 0,
              }}
              animate={{
                x: [cp.startX, cp.targetX, cp.targetX + (Math.random() - 0.5) * 80],
                y: [cp.startY, cp.targetY, windowHeight + 60],
                scale: [0.2, cp.scale, cp.scale * 0.8],
                opacity: [0, 1, 1, 0],
                rotate: [0, 360, 720],
              }}
              transition={{
                duration: cp.duration,
                delay: cp.delay,
                ease: "easeOut",
              }}
              style={{
                position: "absolute",
                width: "12px",
                height: "18px",
                backgroundColor: cp.color,
                borderRadius: "3px",
                boxShadow: `0 0 10px ${cp.color}88`,
              }}
            />
          ))}
        </div>

        {/* ────────────────── CENTRAL CELEBRATION HERO CARD ────────────────── */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 22,
            delay: 0.1,
          }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-20 w-full max-w-md bg-white dark:bg-[#1B1536] rounded-[32px] p-6 sm:p-8 border border-amber-400/40 shadow-2xl shadow-amber-500/20 text-center overflow-hidden"
        >
          {/* Subtle Rotating Sunburst Behind Trophy */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute top-8 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 pointer-events-none opacity-20 dark:opacity-30"
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-600 blur-2xl" />
          </motion.div>

          {/* Top Close Button */}
          <button
            onClick={onClose}
            aria-label="Close celebration"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer z-30"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Golden Trophy Hero Icon with Framer Motion Spring */}
          <div className="relative inline-block mb-3 pt-2">
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: [0, 1.25, 1], rotate: [0, 10, -5, 0] }}
              transition={{
                duration: 0.7,
                delay: 0.25,
                ease: [0.175, 0.885, 0.32, 1.275],
              }}
              className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 p-1 shadow-xl shadow-amber-500/30 flex items-center justify-center"
            >
              <div className="w-full h-full rounded-[22px] bg-gradient-to-b from-amber-400 to-amber-600 flex items-center justify-center text-white relative overflow-hidden">
                <motion.div
                  animate={{ y: ["-100%", "200%"] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.2,
                    ease: "easeInOut",
                    repeatDelay: 1.5,
                  }}
                  className="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent via-white/40 to-transparent skew-y-12"
                />
                <Award className="w-12 h-12 sm:w-14 sm:h-14 drop-shadow-md" />
              </div>
            </motion.div>

            {/* Orbiting Sparkles */}
            {[
              { top: "-6px", left: "10px", delay: 0.4 },
              { top: "10px", right: "-8px", delay: 0.6 },
              { bottom: "4px", left: "-6px", delay: 0.8 },
              { bottom: "-8px", right: "12px", delay: 1.0 },
            ].map((pos, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1.2, 0.9, 1.1],
                  opacity: [0, 1, 0.8, 1],
                  y: [0, -4, 0],
                }}
                transition={{
                  duration: 1.8,
                  delay: pos.delay,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className="absolute z-20 text-amber-400"
                style={{ ...pos }}
              >
                <Sparkles className="w-5 h-5 fill-amber-400 text-amber-500 drop-shadow" />
              </motion.div>
            ))}
          </div>

          {/* Badge & Headlines */}
          <div className="space-y-2 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>100% ACCURACY • FLAWLESS SCORE</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight"
            >
              Outstanding Achievement!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium"
            >
              Outstanding performance! You answered all <span className="font-bold text-amber-600 dark:text-amber-400">{totalQuestions}</span> questions correctly with 100% accuracy.
            </motion.p>
          </div>

          {/* Stats Highlight Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.65 }}
            className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border border-amber-200 dark:border-amber-900/50 flex items-center justify-around gap-2"
          >
            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Accuracy
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {accuracy}%
              </span>
            </div>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />

            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Correct
              </span>
              <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {totalQuestions} / {totalQuestions}
              </span>
            </div>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />

            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Wrong
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-400 font-mono">
                0
              </span>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="mt-6 flex flex-col sm:flex-row items-center gap-3 relative z-10"
          >
            <button
              onClick={handleReplay}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Burst Again</span>
            </button>

            <button
              onClick={onClose}
              className="w-full flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>View Detailed Solutions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
