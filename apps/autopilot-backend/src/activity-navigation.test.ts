import { describe, expect, test } from "bun:test";

import type { ActivityNavigationState } from "./activity-navigation";
import { didAdvanceActivity, parseFrameProgress } from "./activity-navigation";

function state(
  progress: string | null,
  overrides: Partial<ActivityNavigationState> = {},
): ActivityNavigationState {
  return {
    frameUrl: "https://example.com/stage",
    previewSource: "question-1",
    progress,
    ...overrides,
  };
}

describe("parseFrameProgress", () => {
  test("parses Edgenuity progress text", () => {
    expect(parseFrameProgress("6 of 10")).toEqual({ current: 6, total: 10 });
  });

  test("rejects unrelated text", () => {
    expect(parseFrameProgress("Frame 2")).toBeNull();
  });
});

describe("didAdvanceActivity", () => {
  test("accepts increasing progress", () => {
    expect(didAdvanceActivity(state("6 of 10"), state("7 of 10"))).toBe(true);
  });

  test("rejects unchanged progress even when the preview changes", () => {
    expect(
      didAdvanceActivity(
        state("6 of 10"),
        state("6 of 10", { previewSource: "question-2" }),
      ),
    ).toBe(false);
  });

  test("rejects backward progress", () => {
    expect(didAdvanceActivity(state("6 of 10"), state("3 of 10"))).toBe(false);
  });

  test("accepts a reset after the final frame", () => {
    expect(didAdvanceActivity(state("10 of 10"), state("1 of 10"))).toBe(true);
  });

  test("uses preview changes when progress is unavailable", () => {
    expect(
      didAdvanceActivity(
        state(null),
        state(null, { previewSource: "question-2" }),
      ),
    ).toBe(true);
  });
});
