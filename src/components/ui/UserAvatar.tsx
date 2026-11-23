import React, { useState, useEffect } from "react";
import { User } from "lucide-react";

export interface UserAvatarProps {
  name?: string | null;
  photoURL?: string | null;
  className?: string;
  sizeClassName?: string;
  showBorder?: boolean;
  alt?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = "Scholar",
  photoURL,
  className = "",
  sizeClassName = "w-full h-full",
  showBorder = false,
  alt,
}) => {
  const [imgError, setImgError] = useState(false);
  const displayName = (name && name.trim()) || "Scholar";

  // Reset error state if photoURL or name changes
  useEffect(() => {
    setImgError(false);
  }, [photoURL, name]);

  // Extract clean first character/initial
  const initial = displayName.trim().charAt(0).toUpperCase();

  // Safe image URL: use photoURL if present, else sanitized dicebear URL
  const imageSource = photoURL
    ? photoURL
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=b6e3f4,c0aede,ffd5dc,ffdfbf`;

  // Deterministic vibrant gradient based on name
  const getGradient = (str: string) => {
    const gradients = [
      "from-[#7045D8] to-[#A78BFA]",
      "from-[#6366F1] to-[#818CF8]",
      "from-[#0284C7] to-[#38BDF8]",
      "from-[#059669] to-[#34D399]",
      "from-[#D97706] to-[#FBBF24]",
      "from-[#DB2777] to-[#F472B6]",
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
  };

  const bgGradient = getGradient(displayName);

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full select-none shrink-0 ${sizeClassName} ${className} ${
        showBorder ? "ring-2 ring-[#7045D8]/40" : ""
      }`}
    >
      {!imgError ? (
        <img
          src={imageSource}
          alt={alt || displayName}
          className="w-full h-full object-cover"
          loading="lazy"
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
        />
      ) : (
        /* Bulletproof Local Fallback: Always renders offline with zero dependencies */
        <div
          className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${bgGradient} text-white font-black text-sm sm:text-base uppercase tracking-tight shadow-inner`}
        >
          {initial ? (
            <span>{initial}</span>
          ) : (
            <User className="w-1/2 h-1/2 text-white/90" />
          )}
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
