import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, RotateCw, Maximize2, Minimize2, Volume2, VolumeX, Shield, Sparkles, Check } from "lucide-react";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

export function extractYoutubeId(url?: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
}

export function isDirectVideoUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".mkv") ||
    clean.endsWith(".m3u8") ||
    clean.includes(".mp4?") ||
    clean.includes("/video/upload/") ||
    clean.includes("blob:")
  );
}

interface CoachingVideoPlayerProps {
  videoUrl?: string;
  title: string;
  duration?: string;
  subjectName?: string;
  chapterName?: string;
  onEnded?: () => void;
}

export const CoachingVideoPlayer: React.FC<CoachingVideoPlayerProps> = ({
  videoUrl,
  title,
  duration,
  subjectName,
  chapterName,
  onEnded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);

  const youtubeId = extractYoutubeId(videoUrl);
  const isDirect = isDirectVideoUrl(videoUrl);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Format time (mm:ss)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartPlay = () => {
    triggerHaptic("medium");
    playClickSound();
    setHasStarted(true);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const togglePlay = () => {
    triggerHaptic("light");
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    triggerHaptic("light");
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(totalDuration, videoRef.current.currentTime + seconds));
    }
  };

  const handleSetSpeed = (rate: number) => {
    triggerHaptic("light");
    setPlaybackRate(rate);
    setIsSpeedMenuOpen(false);

    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    } else if (iframeRef.current && iframeRef.current.contentWindow) {
      // Send postMessage to YouTube Iframe API for playback rate
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setPlaybackRate", args: [rate] }),
        "*"
      );
    }
  };

  const toggleFullscreen = () => {
    triggerHaptic("medium");
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const availableSpeeds = [0.75, 1, 1.25, 1.5, 2];

  // -------------------------------------------------------------
  // YOUTUBE EMBED WITH PROPRIETARY LMS SERVER SHELL
  // -------------------------------------------------------------
  if (youtubeId) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // Parameters crafted to strip YouTube chrome: modestbranding, rel=0, showinfo=0, iv_load_policy=3, color=white, playsinline=1, enablejsapi=1
    const embedSrc = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=${hasStarted ? 1 : 0}&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&playsinline=1&controls=1&color=white&enablejsapi=1&origin=${encodeURIComponent(origin)}`;

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-[#0A0C14] border border-[#262B3D] shadow-2xl group select-none"
      >
        {/* Top Server Branding & Lecture Bar (Blocks YouTube header title/share chrome) */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-linear-to-b from-[#0A0C14]/95 via-[#0A0C14]/80 to-transparent px-3.5 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>HD Server Stream</span>
            </span>
            <p className="text-xs sm:text-sm font-bold text-white truncate font-hindi drop-shadow-sm">
              {title}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Speed Selector Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/15 backdrop-blur-md cursor-pointer transition-all"
              >
                {playbackRate}x
              </button>
              {isSpeedMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-[#171923] border border-[#31374A] rounded-xl shadow-2xl p-1 z-30 min-w-[70px] backdrop-blur-xl">
                  {availableSpeeds.map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handleSetSpeed(spd)}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-lg font-bold flex items-center justify-between cursor-pointer transition-all ${
                        playbackRate === spd
                          ? "bg-[#800020] text-white"
                          : "text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span>{spd}x</span>
                      {playbackRate === spd && <Check className="w-3 h-3 text-[#F47B20]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md cursor-pointer transition-all"
              title="Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Custom Server Video Poster (Shown prior to user interaction) */}
        {!hasStarted ? (
          <div className="absolute inset-0 z-10 bg-linear-to-br from-[#1A0B10] via-[#0A0C14] to-[#140F08] flex flex-col items-center justify-center p-6 text-center">
            {/* Ambient Background Glow */}
            <div className="absolute w-72 h-72 rounded-full bg-[#800020]/25 blur-3xl pointer-events-none" />

            {/* Course & LMS Tag */}
            <div className="relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-[10.5px] font-extrabold text-[#F47B20] uppercase tracking-wider mb-3 shadow-md">
              <Shield className="w-3.5 h-3.5 text-[#F47B20]" />
              <span>DISHA 20-20 Digital Classroom • Secure Player</span>
            </div>

            <h3 className="relative z-10 text-base sm:text-xl font-black text-white font-hindi max-w-lg mb-1 drop-shadow-md">
              {title}
            </h3>
            {(subjectName || chapterName) && (
              <p className="relative z-10 text-xs text-slate-400 font-hindi mb-4">
                {subjectName} {chapterName ? `• ${chapterName}` : ""}
              </p>
            )}

            {/* Prominent Custom Play Button */}
            <button
              type="button"
              onClick={handleStartPlay}
              className="relative z-10 group/btn mt-1 w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-linear-to-tr from-[#800020] via-[#A00028] to-[#F47B20] text-white flex items-center justify-center shadow-xl shadow-[#800020]/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
            >
              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1 group-hover/btn:scale-110 transition-transform" />
            </button>

            {duration && (
              <span className="relative z-10 mt-3.5 text-xs font-semibold text-slate-400 bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                Duration: {duration}
              </span>
            )}
          </div>
        ) : null}

        {/* The YouTube Iframe (Active once user taps Play) */}
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />

        {/* Bottom LMS Watermark */}
        <div className="absolute bottom-1.5 right-2 z-20 pointer-events-none opacity-40 hover:opacity-90 transition-opacity">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/70 bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
            DISHA LMS
          </span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DIRECT SERVER VIDEO PLAYER (HTML5 MP4/WEBM/M3U8)
  // -------------------------------------------------------------
  if (isDirect && videoUrl) {
    return (
      <div
        ref={containerRef}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-[#262B3D] shadow-2xl group select-none"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setTotalDuration(videoRef.current.duration);
          }}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
        />

        {/* Top Info Bar */}
        <div
          className={`absolute top-0 left-0 right-0 z-20 bg-linear-to-b from-black/90 to-transparent p-3.5 sm:p-4 flex items-center justify-between transition-opacity duration-200 ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Direct Server Stream</span>
            </span>
            <p className="text-xs sm:text-sm font-bold text-white truncate font-hindi">
              {title}
            </p>
          </div>
        </div>

        {/* Center Big Play Button if Paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
          >
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-linear-to-tr from-[#800020] to-[#F47B20] text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all">
              <Play className="w-8 h-8 fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Bottom Custom Controls Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 bg-linear-to-t from-black/95 via-black/80 to-transparent p-3 sm:p-4 space-y-2 transition-opacity duration-200 ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Progress Seekbar */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#F47B20]"
            />
          </div>

          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1 rounded-lg hover:bg-white/20 transition-all cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <button
                type="button"
                onClick={() => handleSkip(-10)}
                className="p-1 rounded-lg hover:bg-white/20 transition-all cursor-pointer"
                title="10s Backward"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSkip(10)}
                className="p-1 rounded-lg hover:bg-white/20 transition-all cursor-pointer"
                title="10s Forward"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <span className="text-[11px] font-mono text-slate-300 tabular-nums">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Playback Rate Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
                  className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/15 cursor-pointer"
                >
                  {playbackRate}x
                </button>
                {isSpeedMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-2 bg-[#171923] border border-[#31374A] rounded-xl shadow-2xl p-1 z-30 min-w-[70px]">
                    {availableSpeeds.map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => handleSetSpeed(spd)}
                        className={`w-full text-left px-2.5 py-1 text-xs rounded-lg font-bold flex items-center justify-between cursor-pointer ${
                          playbackRate === spd
                            ? "bg-[#800020] text-white"
                            : "text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        <span>{spd}x</span>
                        {playbackRate === spd && <Check className="w-3 h-3 text-[#F47B20]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="p-1 rounded-lg hover:bg-white/20 transition-all cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1 rounded-lg hover:bg-white/20 transition-all cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // GENERIC EMBED FALLBACK (If neither YouTube ID nor MP4)
  // -------------------------------------------------------------
  if (videoUrl) {
    return (
      <div className="w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-[#262B3D] shadow-2xl">
        <iframe
          src={videoUrl}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return null;
};

export default CoachingVideoPlayer;
