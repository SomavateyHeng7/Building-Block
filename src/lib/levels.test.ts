import { describe, expect, it } from "vitest";
import { getLevels, roadmapHeading, type Level } from "./levels";

const level = (name: string, status: Level["status"]): Level => ({ level: name, title: name, body: "", status });

describe("roadmap levels", () => {
  it("reports what the editor can do today", () => {
    const [l0, l1, l2] = getLevels();
    expect([l0.level, l0.status]).toEqual(["L0", "Available now"]);
    expect([l1.level, l1.status]).toEqual(["L1", "Available now"]);
    // Nothing builds L2 yet; when it does, this test is the reminder to update it.
    expect([l2.level, l2.status]).toEqual(["L2", "Coming next"]);
  });

  it("words the heading from the statuses", () => {
    expect(roadmapHeading([level("L0", "Available now"), level("L1", "Coming next"), level("L2", "Planned")])).toBe(
      "L0 today, L1 and L2 next",
    );
    expect(roadmapHeading(getLevels())).toBe("L0 and L1 today, L2 next");
    expect(roadmapHeading([level("L0", "Available now"), level("L1", "Available now")])).toBe("L0 and L1 are all available");
    expect(roadmapHeading([level("L0", "Available now"), level("L1", "Available now"), level("L2", "Available now")])).toBe(
      "L0, L1 and L2 are all available",
    );
  });
});
