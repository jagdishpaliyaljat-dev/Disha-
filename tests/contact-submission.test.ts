// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";

// Keep unit tests hermetic: never talk to the real Supabase project.
vi.mock("../src/lib/supabase", () => ({
  isSupabaseConfigured: () => false,
  supabase: null,
}));

import {
  loadContactMessages,
  saveContactMessages,
  submitContactMessage,
  fetchContactMessages,
  updateContactMessageStatus,
  deleteContactMessage,
} from "../src/utils/contactStorage";

describe("Contact form submission pipeline", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("CT-01 valid submission persists and returns success", async () => {
    const res = await submitContactMessage({
      name: "Test User",
      email: "test@example.com",
      subject: "General Inquiry",
      message: "This is a valid contact message with enough detail.",
    });
    expect(res.success).toBe(true);
    expect(res.id).toBeTruthy();
    const stored = loadContactMessages();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Test User");
    expect(stored[0].email).toBe("test@example.com");
    expect(stored[0].subject).toBe("General Inquiry");
    expect(stored[0].status).toBe("new");
  });

  it("CT-02 missing required fields fails without persisting", async () => {
    const res = await submitContactMessage({
      name: "",
      email: "test@example.com",
      subject: "General Inquiry",
      message: "Enough detail message here.",
    });
    expect(res.success).toBe(false);
    expect(loadContactMessages()).toHaveLength(0);
  });

  it("CT-03 short message fails", async () => {
    const res = await submitContactMessage({
      name: "Test User",
      email: "test@example.com",
      subject: "General Inquiry",
      message: "short",
    });
    expect(res.success).toBe(false);
    expect(loadContactMessages()).toHaveLength(0);
  });

  it("CT-04 duplicate submission within window is blocked", async () => {
    const payload = {
      name: "Test User",
      email: "test@example.com",
      subject: "General Inquiry",
      message: "Duplicate detection message with enough detail.",
    };
    const first = await submitContactMessage(payload);
    expect(first.success).toBe(true);
    const second = await submitContactMessage(payload);
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already submitted/i);
    expect(loadContactMessages()).toHaveLength(1);
  });

  it("CT-05 retry after failure preserves no partial state", async () => {
    // simulate storage failure via prototype spy (jsdom blocks instance override)
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const fail = await submitContactMessage({
      name: "Test User",
      email: "test@example.com",
      subject: "General Inquiry",
      message: "This message should fail to persist due to storage error.",
    });
    expect(fail.success).toBe(false);
    spy.mockRestore();
    const ok = await submitContactMessage({
      name: "Test User",
      email: "test@example.com",
      subject: "General Inquiry",
      message: "This message should succeed after storage recovers.",
    });
    expect(ok.success).toBe(true);
    expect(loadContactMessages()).toHaveLength(1);
  });

  it("CT-06 save/load roundtrip preserves fields", () => {
    const msg = {
      id: "m1",
      name: "N",
      email: "e@x.com",
      subject: "S",
      message: "M",
      createdAt: new Date().toISOString(),
      status: "new" as const,
    };
    saveContactMessages([msg]);
    const loaded = loadContactMessages();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ id: "m1", name: "N", email: "e@x.com" });
  });

  it("CT-07 status update applies to the targeted message only", async () => {
    saveContactMessages([
      {
        id: "a",
        name: "A",
        email: "a@x.com",
        subject: "S",
        message: "first message body",
        createdAt: new Date().toISOString(),
        status: "new",
      },
      {
        id: "b",
        name: "B",
        email: "b@x.com",
        subject: "S",
        message: "second message body",
        createdAt: new Date().toISOString(),
        status: "new",
      },
    ]);

    const ok = await updateContactMessageStatus("b", "read");
    expect(ok).toBe(true);
    const stored = loadContactMessages();
    expect(stored.find((m) => m.id === "a")?.status).toBe("new");
    expect(stored.find((m) => m.id === "b")?.status).toBe("read");
  });

  it("CT-08 delete removes only the targeted message", async () => {
    saveContactMessages([
      {
        id: "keep",
        name: "K",
        email: "k@x.com",
        subject: "S",
        message: "keep this message",
        createdAt: new Date().toISOString(),
        status: "new",
      },
      {
        id: "drop",
        name: "D",
        email: "d@x.com",
        subject: "S",
        message: "drop this message",
        createdAt: new Date().toISOString(),
        status: "new",
      },
    ]);

    const ok = await deleteContactMessage("drop");
    expect(ok).toBe(true);
    const stored = loadContactMessages();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("keep");
  });

  it("CT-09 fetch falls back to cached messages when Supabase is unavailable", async () => {
    saveContactMessages([
      {
        id: "cached",
        name: "C",
        email: "c@x.com",
        subject: "S",
        message: "cached fallback message",
        createdAt: new Date().toISOString(),
        status: "new",
      },
    ]);

    const msgs = await fetchContactMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe("cached");
  });
});
