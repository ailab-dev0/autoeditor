"use client";

import { useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface VideoPlayerProps {
  src?: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  onRegisterVideo?: (el: HTMLVideoElement | null) => void;
  markers?: { time: number; color: string; label?: string }[];
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  currentTime: externalTime,
  onTimeUpdate,
  onRegisterVideo,
  markers = [],
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      onRegisterVideo?.(videoRef.current);
    }
    return () => onRegisterVideo?.(null);
  }, [onRegisterVideo]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);
    }
  }, [onTimeUpdate]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !videoRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = ratio * duration;
    },
    [duration],
  );

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, []);

  const skip = useCallback((delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.duration, videoRef.current.currentTime + delta),
    );
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("flex flex-col bg-black rounded-lg overflow-hidden", className)}>
      {/* Video element */}
      <div className="relative aspect-video bg-black">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="absolute inset-0 h-full w-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadedMetadata={() => {
              if (videoRef.current) setDuration(videoRef.current.duration);
            }}
            preload="metadata"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No video loaded
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="relative h-1.5 cursor-pointer bg-muted group hover:h-2.5 transition-all"
        onClick={handleSeek}
      >
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
        {/* Markers */}
        {duration > 0 &&
          markers.map((marker, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-0.5"
              style={{
                left: `${(marker.time / duration) * 100}%`,
                backgroundColor: marker.color,
              }}
              title={marker.label}
            />
          ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 bg-background-elevated">
        <Button size="icon-sm" variant="ghost" onClick={() => skip(-10)}>
          <SkipBack className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={togglePlay}>
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => skip(10)}>
          <SkipForward className="size-4" />
        </Button>

        <span className="ml-2 text-xs tabular-nums text-muted-foreground font-mono">
          {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
        </span>

        <div className="flex-1" />

        <Button size="icon-sm" variant="ghost" onClick={toggleMute}>
          {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
