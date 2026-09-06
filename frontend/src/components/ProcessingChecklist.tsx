interface Props {
  progress: number;
}

const STEPS = [
  { label: "Video received", at: 1 },
  { label: "Extracting audio", at: 10 },
  { label: "Transcribing speech", at: 25 },
  { label: "Analyzing sentiment", at: 45 },
  { label: "Scoring segments", at: 65 },
  { label: "Ranking highlights", at: 85 },
  { label: "Finalizing results", at: 95 },
];

export default function ProcessingChecklist({ progress }: Props) {
  return (
    <div className="checklist">
      <div className="checklist-header">
        <span>Analyzing your video…</span>
        <span className="checklist-pct">{progress}%</span>
      </div>
      <div className="progress-bar small">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <ul className="checklist-steps">
        {STEPS.map((step) => {
          const done = progress > step.at + 5;
          const current = !done && progress >= step.at;
          return (
            <li key={step.label} className={done ? "done" : current ? "current" : ""}>
              <span className="check-icon">{done ? "✓" : current ? "○" : "○"}</span>
              {step.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
