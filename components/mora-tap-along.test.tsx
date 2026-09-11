import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoraTapAlong } from "@/components/mora-tap-along";

describe("MoraTapAlong", () => {
  it("counts every visible and hidden timing unit and can repeat", () => {
    render(<MoraTapAlong units={["が", "っ", "こ", "う"]} prompt="Tap がっこう" note="Keep four beats." />);
    for (let beat = 1; beat <= 4; beat += 1) fireEvent.click(screen.getByRole("button", { name: `Tap beat ${beat}` }));
    expect(screen.getByText("Complete: 4 morae.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /repeat 4 beats/i }));
    expect(screen.getByRole("button", { name: "Tap beat 1" })).toBeInTheDocument();
  });
});
