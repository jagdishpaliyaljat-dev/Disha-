// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { saveUserProfile, clearUserProfile } from "../src/utils/userProfileStorage";
import { ADMIN_EMAILS } from "../src/utils/userProfileStorage";

const mockProfiles = Array.from({ length: 120 }, (_, i) => ({
  id: `u_${i}`,
  email: `u${i}@example.com`,
  display_name: `User ${i}`,
  photo_url: `https://img/${i}.png`,
  role: i % 5 === 0 ? "admin" : "student",
  created_at: new Date(Date.now() - i * 1000).toISOString(),
  updated_at: new Date(Date.now() - i * 1000).toISOString(),
}));

const upsertCalls: any[] = [];
const updateCalls: any[] = [];

function makeQuery() {
  let filtered: any[] = mockProfiles;
  const q: any = {
    select: () => q,
    order: () => q,
    range: (from: number, to: number) =>
      Promise.resolve({ data: filtered.slice(from, to + 1), error: null }),
    eq: (col: string, val: any) => {
      filtered = filtered.filter((r) => r[col] === val);
      return q;
    },
    upsert: (payload: any) => {
      upsertCalls.push(payload);
      return Promise.resolve({ error: null });
    },
    update: (payload: any) => {
      updateCalls.push(payload);
      return q;
    },
    delete: () => q,
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: filtered, count: filtered.length, error: null }).then(resolve, reject),
  };
  return q;
}

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: () => makeQuery(),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
  isSupabaseConfigured: () => true,
}));

import {
  fetchRegisteredUsers,
  mapRowToUserProfile,
  registerUserToDirectory,
  updateUserRole,
  setLocalUsersDirectory,
  getLocalUsersDirectory,
} from "../src/utils/userManagementStorage";

describe("Admin User Management — pagination & columns", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserProfile();
    upsertCalls.length = 0;
    updateCalls.length = 0;
    saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
  });

  it("ADM-USR-10 mapRowToUserProfile reads display_name/photo_url", () => {
    const u = mapRowToUserProfile(mockProfiles[0]);
    expect(u.name).toBe("User 0");
    expect(u.photoURL).toBe("https://img/0.png");
  });

  it("ADM-USR-11 fetchRegisteredUsers page 1 returns 50 and cursor 50", async () => {
    const page1 = await fetchRegisteredUsers(undefined, 50);
    expect(page1.users).toHaveLength(50);
    expect(page1.hasMore).toBe(true);
    expect(page1.lastVisible).toBe(50);
    expect(page1.users[0].name).toBe("User 0");
  });

  it("ADM-USR-12 fetchRegisteredUsers page 2 returns next 50 (no duplicates)", async () => {
    const page1 = await fetchRegisteredUsers(undefined, 50);
    const page2 = await fetchRegisteredUsers(page1.lastVisible, 50);
    expect(page2.users).toHaveLength(50);
    expect(page2.users[0].id).toBe("u_50");
    const ids = new Set([...page1.users.map((u: any) => u.id), ...page2.users.map((u: any) => u.id)]);
    expect(ids.size).toBe(100);
  });

  it("ADM-USR-13 fetchRegisteredUsers final page hasMore false", async () => {
    const page1 = await fetchRegisteredUsers(undefined, 50);
    const page2 = await fetchRegisteredUsers(page1.lastVisible, 50);
    const page3 = await fetchRegisteredUsers(page2.lastVisible, 50);
    expect(page3.users).toHaveLength(20);
    expect(page3.hasMore).toBe(false);
    expect(page3.lastVisible).toBeNull();
  });

  it("ADM-USR-14 registerUserToDirectory upserts display_name/photo_url", async () => {
    await registerUserToDirectory({ id: "new_u", name: "New User", email: "new@x.com", photoURL: "https://img/new.png", role: "student" } as any);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].display_name).toBe("New User");
    expect(upsertCalls[0].photo_url).toBe("https://img/new.png");
    expect(upsertCalls[0].full_name).toBeUndefined();
    expect(upsertCalls[0].avatar_url).toBeUndefined();
  });

  it("ADM-USR-15 updateUserRole persists and updates local directory", async () => {
    setLocalUsersDirectory([{ id: "u_1", name: "User 1", email: "u1@example.com", role: "student" } as any]);
    await updateUserRole("u_1", "admin");
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].role).toBe("admin");
    const u = getLocalUsersDirectory().find((x: any) => x.id === "u_1");
    expect(u?.role).toBe("admin");
  });
});
