import { INTEREST_TAGS, type InterestTag } from "../tags";

interface Props {
  active: InterestTag;
  onChange: (tag: InterestTag) => void;
}

export default function InterestFilter({ active, onChange }: Props) {
  return (
    <div className="interest-grid">
      {INTEREST_TAGS.map((tag) => (
        <button
          key={tag}
          className={`interest-chip ${active === tag ? "active" : ""}`}
          onClick={() => onChange(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
