import { useState } from "react";
import type { TimelineClip } from "../types";
import { formatTime } from "./HighlightsPanel";

interface Props {
  clips: TimelineClip[];
  thumbnails: Record<number, string>;
  sourceUrl: string;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onClear: () => void;
  onDownload: (clip: TimelineClip) => Promise<void>;
  onShare: (clip: TimelineClip) => Promise<void>;
  onDownloadCombined: () => Promise<void>;
  onShareCombined: () => Promise<void>;
  combinedVideoUrl: string;
  onPreviewCombined: () => Promise<void>;
}

export default function Timeline({
  clips,
  thumbnails,
  sourceUrl,
  onRemove,
  onReorder,
  onClear,
  onDownload,
  onShare,
  onDownloadCombined,
  onShareCombined,
  combinedVideoUrl,
  onPreviewCombined,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [busyClipActions, setBusyClipActions] = useState<Set<string>>(
    new Set()
  );

  const totalDuration = clips.reduce(
    (sum, c) => sum + (c.end - c.start),
    0
  );

  async function runClipAction(
    clip: TimelineClip,
    action: "download" | "share"
  ) {
    const key = `${action}-${clip.id}`;

    setBusyId(clip.id);
    setBusyAction(key);
    setBusyClipActions((current) => new Set(current).add(key));

    try {
      if (action === "download") {
        await onDownload(clip);
      } else {
        await onShare(clip);
      }
    } finally {
      setBusyId(null);
      setBusyAction(null);

      setBusyClipActions((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function runCombinedAction(action: "download" | "share") {
    const key = `combined-${action}`;

    setBusyId("combined");
    setBusyAction(key);

    try {
      if (action === "download") {
        await onDownloadCombined();
      } else {
        await onShareCombined();
      }
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  return (
    <div className="timeline">
      <div className="panel-header-row">
        <div>
          <span className="panel-header">🎬 My timeline</span>

          <div className="timeline-subtitle">
            Download or share each clip, or export them all together.
          </div>
        </div>

        <span className="panel-count">{clips.length}</span>
      </div>

      {clips.length === 0 ? (
        <p className="empty-state">
          No clips added yet — click “+ Add” on a highlight.
        </p>
      ) : (
        <>
          <ul className="timeline-list">
            {clips.map((c, i) => {
              const downloadKey = `download-${c.id}`;
              const shareKey = `share-${c.id}`;

              const isDownloading =
                busyAction === downloadKey;

              const isSharing =
                busyAction === shareKey;

              return (
                <li
                  key={c.id}
                  className="timeline-item timeline-item-expanded"
                >
                  <span className="drag-handle">⠿</span>

                  <div className="timeline-thumb">
                    {thumbnails[c.start] ? (
                      <img src={thumbnails[c.start]} alt="" />
                    ) : (
                      <div className="clip-thumb-placeholder small">
                        ▶
                      </div>
                    )}
                  </div>

                  <div className="timeline-info">
                    <span className="clip-time">
                      Clip {i + 1} · {formatTime(c.start)}–
                      {formatTime(c.end)}
                    </span>

                    <span className="timeline-text">
                      &ldquo;{c.transcript}&rdquo;
                    </span>

                    <div className="timeline-clip-actions">
                      {/* Individual Download */}
                      <button
                        className="timeline-action primary"
                        onClick={() =>
                          runClipAction(c, "download")
                        }
                        disabled={
                          !sourceUrl ||
                          busyClipActions.has(downloadKey)
                        }
                        aria-busy={isDownloading}
                      >
                        {isDownloading
                          ? "⏳ Exporting..."
                          : "⬇ Download"}
                      </button>

                      {/* Individual Share */}
                      <button
                        className="timeline-action"
                        onClick={() =>
                          runClipAction(c, "share")
                        }
                        disabled={
                          !sourceUrl ||
                          busyClipActions.has(shareKey)
                        }
                        aria-busy={isSharing}
                      >
                        {isSharing
                          ? "⏳ Preparing..."
                          : "↗ Share"}
                      </button>
                    </div>
                  </div>

                  <div className="timeline-controls">
                    <button
                      className="icon-btn"
                      disabled={
                        i === 0 || busyId !== null
                      }
                      onClick={() =>
                        onReorder(c.id, "up")
                      }
                      aria-label="Move up"
                    >
                      ↑
                    </button>

                    <button
                      className="icon-btn"
                      disabled={
                        i === clips.length - 1 ||
                        busyId !== null
                      }
                      onClick={() =>
                        onReorder(c.id, "down")
                      }
                      aria-label="Move down"
                    >
                      ↓
                    </button>

                    <button
                      className="icon-btn danger"
                      disabled={busyId !== null}
                      onClick={() => onRemove(c.id)}
                      aria-label="Remove"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="timeline-summary">
            <div>
              <div className="summary-label">
                Timeline summary
              </div>

              <div className="summary-sub">
                {clips.length}{" "}
                {clips.length === 1 ? "clip" : "clips"} selected
              </div>
            </div>

            <div className="summary-duration">
              {formatTime(totalDuration)}
            </div>
          </div>

          <div className="combined-card">
            <div className="combined-icon">🎬</div>

            <div className="combined-content">
              <div className="combined-title-row">
                <strong>Combined Highlights</strong>

                <span>
                  {clips.length} clips ·{" "}
                  {formatTime(totalDuration)}
                </span>
              </div>

              <p>
                All {clips.length} timeline{" "}
                {clips.length === 1 ? "clip is" : "clips are"}{" "}
                merged into one MP4 video.
              </p>

              {combinedVideoUrl && (
                <video
                  className="combined-video-preview"
                  src={combinedVideoUrl}
                  controls
                  preload="metadata"
                  playsInline
                />
              )}

              <div className="combined-actions">
                {/* Preview Combined */}
                <button
                  className="primary"
                  onClick={onPreviewCombined}
                  disabled={
                    !sourceUrl || busyId !== null
                  }
                  aria-busy={
                    busyAction === "combined-preview"
                  }
                >
                  {busyAction === "combined-preview"
                    ? "⏳ Creating preview..."
                    : "▶ Preview Combined"}
                </button>

                {/* Download Combined */}
                <button
                  onClick={() =>
                    runCombinedAction("download")
                  }
                  disabled={
                    !sourceUrl || busyId !== null
                  }
                  aria-busy={
                    busyAction === "combined-download"
                  }
                >
                  {busyAction === "combined-download"
                    ? "⏳ Exporting..."
                    : "⬇ Download Combined"}
                </button>

                {/* Share Combined */}
                <button
                  onClick={() =>
                    runCombinedAction("share")
                  }
                  disabled={
                    !sourceUrl || busyId !== null
                  }
                  aria-busy={
                    busyAction === "combined-share"
                  }
                >
                  {busyAction === "combined-share"
                    ? "⏳ Preparing..."
                    : "↗ Share Combined"}
                </button>
              </div>
            </div>
          </div>

          <div className="timeline-footer-actions">
            <button
              onClick={onClear}
              disabled={busyId !== null}
            >
              Clear timeline
            </button>
          </div>
        </>
      )}
    </div>
  );
}