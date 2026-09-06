import { useMemo, useRef, useState } from "react";
import HighlightsPanel from "./components/HighlightsPanel";
import Timeline from "./components/Timeline";
import InterestFilter from "./components/InterestFilter";
import ProcessingChecklist from "./components/ProcessingChecklist";
import {
  createHighlightJob,
  exportClip,
  exportCombined,
  pollJob,
  uploadVideo,
} from "./api";
import { useThumbnails } from "./useThumbnails";
import { deriveTags, type InterestTag } from "./tags";
import type {
  HighlightSegment,
  JobStatus,
  TimelineClip,
} from "./types";

const DURATION_PRESETS = [
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
  { label: "2m", value: 120 },
  { label: "5m", value: 300 },
];

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

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
      const index = parts.findIndex((part) => part === "shorts" || part === "embed" || part === "live");
      const id = index >= 0 ? parts[index + 1] : undefined;
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

function getYouTubeEmbedUrl(videoId: string, startSeconds = 0) {
  const start = Math.max(0, Math.floor(startSeconds));
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&controls=1${start ? `&start=${start}&autoplay=1` : ""}`;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function App() {
  const [sourceTab, setSourceTab] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const [sourceVideoUrl, setSourceVideoUrl] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [maxHighlights, setMaxHighlights] = useState(5);
  const [targetDuration, setTargetDuration] = useState(60);
  const [interest, setInterest] = useState<InterestTag>("All");

  const [status, setStatus] = useState<JobStatus | "idle">("idle");
  const [progress, setProgress] = useState(0);
  const [highlights, setHighlights] = useState<HighlightSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [combinedVideoUrl, setCombinedVideoUrl] = useState("");
  const [youtubePreviewStart, setYoutubePreviewStart] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const thumbnails = useThumbnails(loadedUrl, highlights);

  const filteredHighlights = useMemo(() => {
    if (interest === "All") {
      return highlights;
    }

    return highlights.filter((h) =>
      deriveTags(h).includes(interest)
    );
  }, [highlights, interest]);

  function loadUrlPreview(value: string) {
    const url = value.trim();
    if (!url || !isHttpUrl(url)) return;

    setLoadedUrl(url);
    setSourceVideoUrl(url);
    setUploadFile(null);
    setUploadName("");
    setHighlights([]);
    setTimelineClips([]);
    setCombinedVideoUrl("");
    setYoutubePreviewStart(0);
    setStatus("idle");
    setError(null);
  }

  function handleUrlChange(value: string) {
    setVideoUrl(value);
    if (getYouTubeVideoId(value) || isHttpUrl(value)) {
      loadUrlPreview(value);
    }
  }

  function handleLoadVideo() {
    const url = videoUrl.trim();
    if (!url) {
      setError("Paste a YouTube link or a direct MP4/MOV/WebM video URL.");
      return;
    }

    if (!isHttpUrl(url)) {
      setError("Please enter a valid http:// or https:// video URL.");
      return;
    }

    loadUrlPreview(url);
  }

  function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    // Check file size
    if (file.size > MAX_VIDEO_SIZE) {
      setError(
        "Video is too large. Maximum allowed size is 500 MB."
      );
      setUploadFile(null);
      setUploadName("");
      return;
    }

    // Check video type
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only MP4, MOV and WebM videos are supported."
      );
      setUploadFile(null);
      setUploadName("");
      return;
    }

    setUploadFile(file);
    setUploadName(file.name);
    setSourceVideoUrl("");

    const previewUrl = URL.createObjectURL(file);
    setLoadedUrl(previewUrl);

    setHighlights([]);
    setTimelineClips([]);
    setCombinedVideoUrl("");
    setStatus("idle");
    setError(null);
  }

  async function handleGenerate() {
    setError(null);
    setHighlights([]);
    setStatus("queued");
    setProgress(0);

    try {
      let sourceUrl: string;

      if (sourceTab === "upload") {
        if (!uploadFile) {
          throw new Error(
            "Please select a video file first."
          );
        }

        // Upload video to backend using Multer
        const uploadResult = await uploadVideo(uploadFile);

        sourceUrl = uploadResult.videoUrl;
        setSourceVideoUrl(sourceUrl);
      } else {
        sourceUrl = loadedUrl;

        if (!sourceUrl) {
          throw new Error(
            "Please load a video first."
          );
        }
      }

      // Create highlight processing job
      const { jobId } = await createHighlightJob(
        sourceUrl,
        maxHighlights,
        targetDuration
      );

      stopPollingRef.current?.();

      stopPollingRef.current = pollJob(
        jobId,
        (update) => {
          setStatus(update.status);

          if (typeof update.progress === "number") {
            setProgress(update.progress);
          }

          if (update.status === "completed") {
            setHighlights(update.highlights || []);
          }

          if (update.status === "failed") {
            setError(
              update.error || "Job failed"
            );
          }
        }
      );
    } catch (err: unknown) {
      setStatus("failed");

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to start job");
      }
    }
  }

  function handlePreview(start: number) {
    const youtubeId = getYouTubeVideoId(loadedUrl);
    if (youtubeId) {
      setYoutubePreviewStart(start);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    video.currentTime = start;
    video.play().catch(() => {});
  }

  function handleAdd(
    highlight: HighlightSegment
  ) {
    setCombinedVideoUrl("");
    setTimelineClips((prev) => [
      ...prev,
      {
        ...highlight,
        id: `${highlight.start}-${highlight.end}`,
      },
    ]);
  }

  function getMediaUrl(url: string) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;

    if (configuredApiUrl) {
      return `${configuredApiUrl.replace(/\/$/, "")}${url}`;
    }

    const isLocalFrontend =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    return isLocalFrontend
      ? `http://localhost:8787${url}`
      : `${window.location.origin}${url}`;
  }

  async function downloadMedia(url: string, filename: string) {
    const response = await fetch(getMediaUrl(url));

    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleDownloadClip(clip: TimelineClip) {
    if (!sourceVideoUrl) {
      throw new Error("Video source is not available.");
    }

    setError(null);

    try {
      const result = await exportClip(sourceVideoUrl, clip);
      await downloadMedia(result.videoUrl, result.filename);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not download clip.";
      setError(message);
    }
  }

  async function handleShareClip(clip: TimelineClip) {
    if (!sourceVideoUrl) {
      throw new Error("Video source is not available.");
    }

    setError(null);

    try {
      const result = await exportClip(sourceVideoUrl, clip);
      const url = getMediaUrl(result.videoUrl);

      if (navigator.share) {
        await navigator.share({
          title: "EdgeCut Highlight",
          text: "Check out this EdgeCut highlight.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("Share link copied to your clipboard.");
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : "Could not share clip.";
      setError(message);
    }
  }

  async function handlePreviewCombined() {
    if (!sourceVideoUrl || timelineClips.length === 0) {
      setError("Add at least one clip to the timeline first.");
      return;
    }

    setError(null);

    try {
      const result = await exportCombined(sourceVideoUrl, timelineClips);
      setCombinedVideoUrl(getMediaUrl(result.videoUrl));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not create the combined preview.";
      setError(message);
    }
  }

  async function handleDownloadCombined() {
    if (!sourceVideoUrl || timelineClips.length === 0) {
      throw new Error("Add at least one clip to the timeline first.");
    }

    setError(null);

    try {
      const result = await exportCombined(sourceVideoUrl, timelineClips);
      await downloadMedia(result.videoUrl, result.filename);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not create the combined video.";
      setError(message);
    }
  }

  async function handleShareCombined() {
    if (!sourceVideoUrl || timelineClips.length === 0) {
      throw new Error("Add at least one clip to the timeline first.");
    }

    setError(null);

    try {
      const result = await exportCombined(sourceVideoUrl, timelineClips);
      const url = getMediaUrl(result.videoUrl);

      if (navigator.share) {
        await navigator.share({
          title: "EdgeCut Combined Highlights",
          text: "Check out my combined EdgeCut highlights.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        window.alert("Share link copied to your clipboard.");
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : "Could not share the combined video.";
      setError(message);
    }
  }

  function handleRemove(id: string) {
    setTimelineClips((prev) =>
      prev.filter((c) => c.id !== id)
    );
    setCombinedVideoUrl("");
  }

  function handleReorder(
    id: string,
    direction: "up" | "down"
  ) {
    setTimelineClips((prev) => {
      const idx = prev.findIndex(
        (c) => c.id === id
      );

      const swapWith =
        direction === "up"
          ? idx - 1
          : idx + 1;

      if (
        idx < 0 ||
        swapWith < 0 ||
        swapWith >= prev.length
      ) {
        return prev;
      }

      const next = [...prev];

      [next[idx], next[swapWith]] = [
        next[swapWith],
        next[idx],
      ];

      setCombinedVideoUrl("");
      return next;
    });
  }

  const addedStarts = new Set(
    timelineClips.map((c) => c.start)
  );

  const isBusy =
    status === "queued" ||
    status === "processing";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>{" "}
          EdgeCut
        </div>

        <div className="brand-tagline">
          Find the moments worth sharing.
        </div>
      </header>

      <section className="step-grid">
        <div className="panel step-panel">
          <div className="step-title">
            <span className="step-badge">1</span>{" "}
            Video source
          </div>

          <div className="source-tabs">
            <button
              className={
                sourceTab === "url"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setSourceTab("url");
                setError(null);
              }}
            >
              Video URL
            </button>

            <button
              className={
                sourceTab === "upload"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setSourceTab("upload");
                setError(null);
              }}
            >
              Upload video
            </button>
          </div>

          {sourceTab === "url" ? (
            <>
              <label className="field-label">
                Paste video URL
              </label>

              <input
                type="text"
                placeholder="https://example.com/raw-video.mp4"
                value={videoUrl}
                onChange={(e) =>
                  handleUrlChange(e.target.value)
                }
                className="url-input"
              />

              <button
                className="primary full-width"
                onClick={handleLoadVideo}
              >
                Load video
              </button>
              <p className="hint url-support-hint">
                Supports YouTube links and direct MP4, MOV or WebM URLs. Preview loads automatically when a valid URL is pasted.
              </p>
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />

              <button
                className="primary full-width"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={isBusy}
              >
                {uploadName ||
                  "Choose a video file"}
              </button>

              <p className="hint">
                MP4, MOV or WebM • Maximum file size:
                500 MB
              </p>
            </>
          )}
        </div>

        <div className="panel step-panel">
          <div className="step-title">
            Video preview
          </div>

          {loadedUrl ? (
            getYouTubeVideoId(loadedUrl) ? (
              <div className="video-preview-shell youtube-preview-shell">
                <iframe
                  key={`${getYouTubeVideoId(loadedUrl)}-${youtubePreviewStart}`}
                  className="preview-player youtube-player"
                  src={getYouTubeEmbedUrl(getYouTubeVideoId(loadedUrl)!, youtubePreviewStart)}
                  title="YouTube video preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <div className="source-badge">YouTube preview</div>
              </div>
            ) : (
              <div className="video-preview-shell">
                <video
                  ref={videoRef}
                  src={loadedUrl}
                  controls
                  className="preview-player"
                  playsInline
                  onError={() => setError("This URL could not be played as a browser video. Use a direct MP4, MOV or WebM file URL.")}
                />
                <div className="source-badge">Direct video URL</div>
              </div>
            )
          ) : (
            <div className="preview-placeholder">
              Paste a YouTube link or direct MP4/MOV/WebM URL to preview it automatically
            </div>
          )}
        </div>
      </section>

      <section className="step-grid">
        <div className="panel step-panel">
          <div className="step-title">
            <span className="step-badge">2</span>{" "}
            Highlight preferences
          </div>

          <label className="field-label">
            Max highlights: {maxHighlights}
          </label>

          <input
            type="range"
            min={1}
            max={15}
            value={maxHighlights}
            onChange={(e) =>
              setMaxHighlights(
                Number(e.target.value)
              )
            }
          />

          <label className="field-label">
            Target duration: {targetDuration}s
          </label>

          <input
            type="range"
            min={15}
            max={300}
            step={5}
            value={targetDuration}
            onChange={(e) =>
              setTargetDuration(
                Number(e.target.value)
              )
            }
          />

          <div className="preset-row">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.value}
                className={
                  targetDuration === p.value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setTargetDuration(p.value)
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel step-panel generate-panel">
          <div className="generate-copy">
            <div className="generate-icon">
              ✨
            </div>

            <p>
              EdgeCut will analyze your video and
              find the most interesting moments.
            </p>
          </div>

          <button
            className="primary full-width generate-btn"
            onClick={handleGenerate}
            disabled={
              isBusy ||
              (sourceTab === "upload"
                ? !uploadFile
                : !loadedUrl)
            }
          >
            {isBusy
              ? "Generating…"
              : "Generate highlights"}
          </button>

          {error && (
            <p className="error">
              ⚠ {error}
            </p>
          )}
        </div>
      </section>

      <section className="panel step-panel">
        <div className="step-title">
          <span className="step-badge">3</span>{" "}
          What kind of moments do you want?
        </div>

        <InterestFilter
          active={interest}
          onChange={setInterest}
        />

        <p className="hint">
          Only moments matching the selected
          interest are shown below.
        </p>
      </section>

      {isBusy && (
        <section className="panel step-panel">
          <ProcessingChecklist
            progress={progress}
          />
        </section>
      )}

      <section className="content-grid">
        <HighlightsPanel
          highlights={filteredHighlights}
          totalCount={highlights.length}
          thumbnails={thumbnails}
          onPreview={handlePreview}
          onAdd={handleAdd}
          addedStarts={addedStarts}
        />

        <Timeline
          clips={timelineClips}
          thumbnails={thumbnails}
          sourceUrl={sourceVideoUrl}
          onRemove={handleRemove}
          onReorder={handleReorder}
          onClear={() => {
            setTimelineClips([]);
            setCombinedVideoUrl("");
          }}
          onDownload={handleDownloadClip}
          onShare={handleShareClip}
          onDownloadCombined={handleDownloadCombined}
          onShareCombined={handleShareCombined}
          combinedVideoUrl={combinedVideoUrl}
          onPreviewCombined={handlePreviewCombined}
        />
      </section>
    </div>
  );
}