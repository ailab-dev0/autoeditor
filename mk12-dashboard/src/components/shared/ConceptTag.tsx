"use client";

import { cn } from "@/lib/utils";

interface ConceptTagProps {
  label: string;
  communityColor?: string;
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

export function ConceptTag({
  label,
  communityColor,
  size = "sm",
  className,
  onClick,
}: ConceptTagProps) {
  const colorStyle = communityColor
    ? {
        backgroundColor: `${communityColor}20`,
        borderColor: `${communityColor}40`,
        color: communityColor,
      }
    : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        !communityColor && "border-border bg-muted text-muted-foreground",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className,
      )}
      style={colorStyle}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {communityColor && (
        <span
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: communityColor }}
        />
      )}
      {label}
    </span>
  );
}
