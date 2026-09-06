import { useEffect, useRef, useState } from "react";
import type { HighlightSegment } from "./types";

function getYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return watchId;
      const parts = url.pathname.split("/").filter(Boolean);
      const index = parts.findIndex((part) => ["shorts", "embed", "live"].includes(part));
      const id = index >= 0 ? parts[index + 1] : undefined;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Captures a single video frame per highlight (at its start timestamp) onto
 * an offscreen canvas, so the Highlights list can show a real thumbnail
 * instead of a placeholder. Runs against a hidden <video> element so it
 * never disturbs the visible preview player's playback position.
 */
export function useThumbnails(videoUrl: string, highlights: HighlightSegment[]) {
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoUrl || highlights.length === 0) return;
    let cancelled = false;

    const youtubeId = getYouTubeVideoId(videoUrl);
    if (youtubeId) {
      const thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
      const next: Record<number, string> = {};
      for (const h of highlights) next[h.start] = thumbnail;
      setThumbnails(next);
      return () => {
        cancelled = true;
      };
    }

    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    hiddenVideoRef.current = video;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    async function captureAll() {
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => resolve();
      });
      if (cancelled || !ctx) return;

      canvas.width = 160;
      canvas.height = 90;

      for (const h of highlights) {
        if (cancelled) return;
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = h.start;
          setTimeout(resolve, 1500); // safety timeout if 'seeked' never fires
        });
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          if (!cancelled) {
            setThumbnails((prev) => ({ ...prev, [h.start]: dataUrl }));
          }
        } catch {
          // CORS-blocked sources (no crossOrigin support) simply skip the thumbnail
        }
      }
    }

    captureAll();
    return () => {
      cancelled = true;
    };
  }, [videoUrl, highlights]);

  return thumbnails;
}
