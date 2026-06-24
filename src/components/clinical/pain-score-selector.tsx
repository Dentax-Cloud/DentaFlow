"use client";

const PAIN_EMOJIS = ["😊", "😊", "🙂", "😐", "😕", "😣", "😖", "😫", "😩", "🤯", "💀"];
const PAIN_COLORS = [
  "bg-green-500",
  "bg-green-400",
  "bg-lime-400",
  "bg-yellow-400",
  "bg-yellow-500",
  "bg-orange-400",
  "bg-orange-500",
  "bg-red-400",
  "bg-red-500",
  "bg-red-600",
  "bg-red-700",
];
const PAIN_LABELS = [
  "No pain",
  "Very mild",
  "Mild",
  "Mild-moderate",
  "Moderate",
  "Moderate-severe",
  "Severe",
  "Very severe",
  "Intense",
  "Excruciating",
  "Worst possible",
];

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export function PainScoreSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md ${PAIN_COLORS[value]}`}
        >
          {value}
        </div>
        <div>
          <p className="text-2xl">{PAIN_EMOJIS[value]}</p>
          <p className="text-sm font-medium">{PAIN_LABELS[value]}</p>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: "linear-gradient(to right, #22c55e 0%, #eab308 50%, #ef4444 100%)",
        }}
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0 — No pain</span>
        <span>5 — Moderate</span>
        <span>10 — Worst</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-8 w-8 rounded-full text-xs font-bold transition-all ${
              value === n
                ? `${PAIN_COLORS[n]} scale-110 text-white ring-2 ring-offset-1 ring-current`
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
