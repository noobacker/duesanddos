import React, { useState } from "react";
import Image from "next/image";

interface AvatarProps {
  user: {
    id: number;
    display_name?: string;
    avatar_url?: string | null;
  };
  className?: string;
  size?: number | string; // Optional numeric size mapped to standard width/height
}

export function Avatar({ user, className = "", size = "h-8 w-8 text-xs text-white bg-brand-600" }: AvatarProps) {
  const nameInitial = user.display_name?.[0]?.toUpperCase() || "?";

  const [imgError, setImgError] = useState(false);

  // If we have an avatar URL and no error, we show an image.
  // Otherwise we show the standard initial.
  if (user.avatar_url && !imgError) {
    return (
      <div className={`relative flex items-center justify-center rounded-full overflow-hidden shrink-0 ${size} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatar_url}
          alt={`${user.display_name}'s avatar`}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center shrink-0 rounded-full font-semibold ${size} ${className}`}>
      {nameInitial}
    </div>
  );
}
