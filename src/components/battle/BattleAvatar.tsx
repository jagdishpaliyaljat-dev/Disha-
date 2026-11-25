import React, { useState } from "react";
import { User, Sparkles } from "lucide-react";

export interface AnimeCharacter {
  id: string;
  name: string;
  series: string;
  seed: string;
  avatarUrl: string;
  accentColor: string;
  badge: string;
}

export const ANIME_CHARACTERS: AnimeCharacter[] = [
  {
    id: "gojo",
    name: "Gojo Satoru",
    series: "Jujutsu Kaisen",
    seed: "GojoSatoru",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=GojoSatoru&backgroundColor=b6e3f4",
    accentColor: "#38bdf8",
    badge: "Special Grade",
  },
  {
    id: "tanjiro",
    name: "Tanjiro",
    series: "Demon Slayer",
    seed: "TanjiroKamado",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=TanjiroKamado&backgroundColor=ffd5dc",
    accentColor: "#ef4444",
    badge: "Sun Breather",
  },
  {
    id: "zenitsu",
    name: "Zenitsu",
    series: "Demon Slayer",
    seed: "ZenitsuAgatsuma",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=ZenitsuAgatsuma&backgroundColor=ffdfbf",
    accentColor: "#f59e0b",
    badge: "Thunder Striker",
  },
  {
    id: "nezuko",
    name: "Nezuko",
    series: "Demon Slayer",
    seed: "NezukoChan",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=NezukoChan&backgroundColor=ffd5dc",
    accentColor: "#ec4899",
    badge: "Demon Princess",
  },
  {
    id: "zoro",
    name: "Zoro",
    series: "One Piece",
    seed: "RoronoaZoro",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=RoronoaZoro&backgroundColor=c0aede",
    accentColor: "#10b981",
    badge: "3-Sword Master",
  },
  {
    id: "luffy",
    name: "Luffy",
    series: "One Piece",
    seed: "MonkeyDLuffy",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=MonkeyDLuffy&backgroundColor=ffdfbf",
    accentColor: "#f97316",
    badge: "Gear 5 King",
  },
  {
    id: "naruto",
    name: "Naruto",
    series: "Naruto Shippuden",
    seed: "NarutoUzumaki",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=NarutoUzumaki&backgroundColor=ffd5dc",
    accentColor: "#f59e0b",
    badge: "Sage Hokage",
  },
  {
    id: "sasuke",
    name: "Sasuke",
    series: "Naruto Shippuden",
    seed: "SasukeUchiha",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=SasukeUchiha&backgroundColor=b6e3f4",
    accentColor: "#6366f1",
    badge: "Shadow Shinobi",
  },
  {
    id: "levi",
    name: "Levi",
    series: "Attack on Titan",
    seed: "CaptainLevi",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=CaptainLevi&backgroundColor=c0aede",
    accentColor: "#64748b",
    badge: "Captain",
  },
  {
    id: "mikasa",
    name: "Mikasa",
    series: "Attack on Titan",
    seed: "MikasaAckerman",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=MikasaAckerman&backgroundColor=ffd5dc",
    accentColor: "#e11d48",
    badge: "Titan Slayer",
  },
  {
    id: "goku",
    name: "Goku",
    series: "Dragon Ball",
    seed: "SonGoku",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=SonGoku&backgroundColor=ffdfbf",
    accentColor: "#eab308",
    badge: "Ultra Instinct",
  },
  {
    id: "sukuna",
    name: "Sukuna",
    series: "Jujutsu Kaisen",
    seed: "RyomenSukuna",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=RyomenSukuna&backgroundColor=ffd5dc",
    accentColor: "#b91c1c",
    badge: "King of Curses",
  },
  {
    id: "kakashi",
    name: "Kakashi",
    series: "Naruto Shippuden",
    seed: "KakashiHatake",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=KakashiHatake&backgroundColor=b6e3f4",
    accentColor: "#0284c7",
    badge: "Copy Ninja",
  },
  {
    id: "itachi",
    name: "Itachi",
    series: "Naruto Shippuden",
    seed: "ItachiUchiha",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=ItachiUchiha&backgroundColor=c0aede",
    accentColor: "#be123c",
    badge: "Tsukuyomi",
  },
  {
    id: "eren",
    name: "Eren",
    series: "Attack on Titan",
    seed: "ErenYeager",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=ErenYeager&backgroundColor=ffd5dc",
    accentColor: "#047857",
    badge: "Attack Titan",
  },
  {
    id: "saitama",
    name: "Saitama",
    series: "One Punch Man",
    seed: "OnePunchHero",
    avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=OnePunchHero&backgroundColor=ffdfbf",
    accentColor: "#e11d48",
    badge: "One Punch",
  },
];

interface BattleAvatarProps {
  avatar: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
}

export const BattleAvatar: React.FC<BattleAvatarProps> = ({
  avatar,
  name = "Player",
  size = "md",
  className = "",
  showBadge = false,
}) => {
  const [hasError, setHasError] = useState(false);

  const isUrl = Boolean(avatar && (avatar.startsWith("http") || avatar.startsWith("data:") || avatar.startsWith("/")));

  const sizeStyles = {
    sm: "w-6 h-6 text-xs",
    md: "w-9 h-9 text-base",
    lg: "w-12 h-12 text-xl",
    xl: "w-16 h-16 text-2xl",
  }[size];

  // Matched anime character for extra flair
  const matchedChar = ANIME_CHARACTERS.find(
    (c) => c.avatarUrl === avatar || c.name.toLowerCase() === avatar.toLowerCase()
  );

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800 ${sizeStyles} ${className}`}
    >
      {isUrl && !hasError ? (
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover object-center"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-bold select-none flex items-center justify-center text-stone-800 dark:text-stone-200">
          {isUrl && hasError ? (
            <span className="text-[11px] uppercase font-bold text-stone-600 dark:text-stone-400">
              {name.charAt(0) || "P"}
            </span>
          ) : (
            avatar || "⚔️"
          )}
        </span>
      )}

      {showBadge && matchedChar && (
        <div
          className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full text-[11px] font-extrabold text-white shadow-xs"
          style={{ backgroundColor: matchedChar.accentColor }}
        >
          {matchedChar.badge}
        </div>
      )}
    </div>
  );
};
