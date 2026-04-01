"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseVideoSyncOptions {
  onTimeUpdate?: (time: number) => void;
}

export function useVideoSync(options: UseVideoSyncOptions = {}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, []);

  // Track segment end time so we auto-pause when playback reaches it
  const segmentEndRef = useRef<number | null>(null);

  const seekToSegment = useCallback(
    (startTime: number, endTime?: number) => {
      seekTo(startTime);
      segmentEndRef.current = endTime ?? null;
    },
    [seekTo],
  );

  const registerVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      if (videoRef.current) {
        videoRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        videoRef.current.removeEventListener("play", handlePlay);
        videoRef.current.removeEventListener("pause", handlePause);
        videoRef.current.removeEventListener("loadedmetadata", handleMetadata);
      }

      videoRef.current = element;

      if (element) {
        element.addEventListener("timeupdate", handleTimeUpdate);
        element.addEventListener("play", handlePlay);
        element.addEventListener("pause", handlePause);
        element.addEventListener("loadedmetadata", handleMetadata);
      }
    },
    [],
  );

  function handleTimeUpdate() {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setCurrentTime(t);
      options.onTimeUpdate?.(t);

      // Auto-pause when playback reaches segment end boundary
      if (segmentEndRef.current != null && t >= segmentEndRef.current) {
        videoRef.current.pause();
        segmentEndRef.current = null;
      }
    }
  }

  function handlePlay() {
    setIsPlaying(true);
  }

  function handlePause() {
    setIsPlaying(false);
  }

  function handleMetadata() {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }

  return {
    currentTime,
    isPlaying,
    duration,
    seekTo,
    play,
    pause,
    toggle,
    seekToSegment,
    registerVideo,
    videoRef,
  };
}
