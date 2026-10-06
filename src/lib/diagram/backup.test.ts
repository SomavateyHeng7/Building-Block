import { describe, expect, it } from "vitest";
import { BACKUP_NUDGE_MS, backupState, formatAge, needsBackupNudge } from "./backup";
import type { Diagram } from "./types";

const NOW = Date.parse("2026-10-20T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function iso(msBeforeNow: number): string {
  return new Date(NOW - msBeforeNow).toISOString();
}

function diagram(updatedAt: string, createdAt = updatedAt, withNodes = true): Diagram {
  return {
    schemaVersion: 1,
    id: "d1",
    name: "Test",
    legend: [],
    activeSectionId: "s1",
    sections: [
      {
        id: "s1",
        name: "Main",
        nodes: withNodes
          ? [
              {
                id: "b1",
                type: "block",
                position: { x: 0, y: 0 },
                size: { width: 100, height: 40 },
                data: { kind: "block", label: "CRM", containerId: null },
              },
            ]
          : [],
      },
    ],
    createdAt,
    updatedAt,
  };
}

describe("backupState", () => {
  it("is never without a backup", () => {
    expect(backupState(diagram(iso(0)), undefined)).toBe("never");
  });

  it("is current when the backup is at or after the last change", () => {
    expect(backupState(diagram(iso(DAY)), iso(DAY))).toBe("current");
    expect(backupState(diagram(iso(DAY)), iso(0))).toBe("current");
  });

  it("is stale when the diagram changed after the backup", () => {
    expect(backupState(diagram(iso(0)), iso(DAY))).toBe("stale");
  });
});

describe("needsBackupNudge", () => {
  it("ignores empty diagrams", () => {
    expect(needsBackupNudge(diagram(iso(30 * DAY), iso(30 * DAY), false), undefined, NOW)).toBe(false);
  });

  it("ignores diagrams whose backup covers the latest changes", () => {
    expect(needsBackupNudge(diagram(iso(30 * DAY)), iso(20 * DAY), NOW)).toBe(false);
  });

  it("nudges a never-backed-up diagram once it is a week old", () => {
    expect(needsBackupNudge(diagram(iso(0), iso(BACKUP_NUDGE_MS - DAY)), undefined, NOW)).toBe(false);
    expect(needsBackupNudge(diagram(iso(0), iso(BACKUP_NUDGE_MS)), undefined, NOW)).toBe(true);
  });

  it("nudges when the last backup is a week old and changes came after it", () => {
    expect(needsBackupNudge(diagram(iso(0)), iso(3 * DAY), NOW)).toBe(false);
    expect(needsBackupNudge(diagram(iso(0)), iso(8 * DAY), NOW)).toBe(true);
  });
});

describe("formatAge", () => {
  it("reads as days", () => {
    expect(formatAge(iso(DAY / 2), NOW)).toBe("today");
    expect(formatAge(iso(DAY), NOW)).toBe("yesterday");
    expect(formatAge(iso(5 * DAY), NOW)).toBe("5 days ago");
  });
});
