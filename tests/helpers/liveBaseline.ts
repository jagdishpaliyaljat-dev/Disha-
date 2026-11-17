import { expect } from "vitest";

export interface LiveTableCounts {
  subjects: number;
  chapters: number;
  topics: number;
  questions: number;
  profiles: number;
  attempts: number;
  bookmarks: number;
}

/**
 * Live integration tests must work in two legitimate states:
 *   1. a seeded curriculum database, or
 *   2. a completely fresh/unseeded database.
 *
 * A partially populated curriculum (some tables empty while others are not)
 * is treated as a real integrity failure. Private tables must always remain
 * unreadable through the public client (RLS).
 */
export function assertCleanOrSeededBaseline(
  counts: LiveTableCounts
): "seeded" | "empty" {
  const curriculumRows =
    counts.subjects + counts.chapters + counts.topics + counts.questions;

  // RLS: private tables must never leak rows to the public client.
  expect(counts.profiles).toBe(0);
  expect(counts.attempts).toBe(0);
  expect(counts.bookmarks).toBe(0);

  if (curriculumRows === 0) {
    console.warn(
      "[live-db] Database is unseeded (0 curriculum rows). " +
        "Skipping seeded-baseline assertions; run pilots/import_pilot.sql " +
        "with a service-role key to enable them."
    );
    return "empty";
  }

  expect(counts.subjects).toBeGreaterThanOrEqual(1);
  expect(counts.chapters).toBeGreaterThanOrEqual(1);
  expect(counts.topics).toBeGreaterThanOrEqual(1);
  expect(counts.questions).toBeGreaterThanOrEqual(1);
  return "seeded";
}
