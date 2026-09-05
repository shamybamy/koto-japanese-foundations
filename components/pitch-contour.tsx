export function PitchContour({ pattern }: { pattern: "heiban" | "atamadaka" | "nakadaka" | "odaka" }) {
  const points = {
    heiban: "8,42 47,14 86,14 125,14 164,14",
    atamadaka: "8,14 47,42 86,42 125,42 164,42",
    nakadaka: "8,42 47,14 86,42 125,42 164,42",
    odaka: "8,42 47,14 86,14 125,14 164,42",
  }[pattern];
  return (
    <svg className="pitch-contour" viewBox="0 0 172 56" role="img" aria-label={`${pattern} simplified pitch contour`}>
      <path d="M8 48H164" className="pitch-guide" />
      <polyline points={points} className="pitch-line" />
      {points.split(" ").map((point) => { const [cx, cy] = point.split(","); return <circle key={point} cx={cx} cy={cy} r="4" />; })}
    </svg>
  );
}
