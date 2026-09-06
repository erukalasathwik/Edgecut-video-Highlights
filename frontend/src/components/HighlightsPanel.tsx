import type { HighlightSegment } from "../types";
import { deriveTags } from "../tags";

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

interface Props {
  highlights: HighlightSegment[];
  totalCount: number;
  thumbnails: Record<number, string>;
  onPreview: (start: number) => void;
  onAdd: (highlight: HighlightSegment) => void;
  addedStarts: Set<number>;
}

export default function HighlightsPanel({
  highlights,
  totalCount,
  thumbnails,
  onPreview,
  onAdd,
  addedStarts,
}: Props) {
  if (totalCount === 0) {
    return <p className="empty-state">No highlights yet — generate to see results here.</p>;
  }

  return (
    <div className="panel">
      <div className="panel-header-row">
        <span className="panel-header">✨ AI highlights</span>
        <span className="panel-count">
          Showing {highlights.length} of {totalCount}
        </span>
      </div>

      {highlights.length === 0 ? (
        <p className="empty-state">No highlights match this interest — try “All”.</p>
      ) : (
        <div className="clip-list">
          {highlights.map((h, i) => {
            const alreadyAdded = addedStarts.has(h.start);
            const tags = deriveTags(h);
            const thumb = thumbnails[h.start];
            return (
              <div className="clip-card" key={`${h.start}-${h.end}`}>
                <div className="clip-thumb" onClick={() => onPreview(h.start)}>
                  {thumb ? (
                    <img src={thumb} alt="" />
                  ) : (
                    <div className="clip-thumb-placeholder">▶</div>
                  )}
                </div>
                <div className="clip-body">
                  <div className="clip-row">
                    <span className="clip-index">Clip {i + 1}</span>
                    <span className="clip-time">
                      {formatTime(h.start)} → {formatTime(h.end)}
                    </span>
                    <span className="clip-score">{Math.round(h.score * 100)}%</span>
                  </div>
                  <p className="clip-transcript">&ldquo;{h.transcript}&rdquo;</p>
                  <div className="clip-tags">
                    {tags.map((t) => (
                      <span className="tag-pill" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="clip-reason">💡 {h.reason}</div>
                  <div className="clip-actions">
                    <button onClick={() => onPreview(h.start)}>▶ Preview</button>
                    <button
                      disabled={alreadyAdded}
                      onClick={() => onAdd(h)}
                      className="primary"
                    >
                      {alreadyAdded ? "Added" : "+ Add"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
