"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

export function MoraTapAlong({ units, prompt, note }: { units: string[]; prompt: string; note: string }) {
  const [beat, setBeat] = useState(0);
  const complete = beat === units.length;

  function tap() {
    setBeat((current) => Math.min(current + 1, units.length));
  }

  return (
    <div className="mora-tap-along">
      <div>
        <span>Tap-along exercise</span>
        <strong>{prompt}</strong>
        <p>{note}</p>
      </div>
      <ol aria-label={`${units.length}-mora pattern`}>
        {units.map((unit, index) => <li className={index < beat ? "heard" : ""} key={`${unit}-${index}`} lang="ja"><span>{index + 1}</span>{unit}</li>)}
      </ol>
      {complete ? (
        <button type="button" onClick={() => setBeat(0)}><RotateCcw size={14} />Repeat {units.length} beats</button>
      ) : (
        <button type="button" onClick={tap}>Tap beat {beat + 1}</button>
      )}
      <p className="sr-status" aria-live="polite">{complete ? `Complete: ${units.length} morae.` : beat ? `Beat ${beat}: ${units[beat - 1]}.` : "Ready to tap."}</p>
    </div>
  );
}
