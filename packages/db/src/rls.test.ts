import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { ANON, createPrisma, withCaller, type Caller } from "./client";
import { deletePapers, isAdmin, listAllPapers } from "./admin";
import { paperHash } from "./hash";
import { listPapers } from "./queries";

// Integration test against the local Supabase database (`db:start` + `db:reset`).
// Skipped when DATABASE_URL is not set (e.g. CI without a database).
const url = process.env.DATABASE_URL;
const ADMIN: Caller = { role: "authenticated", userId: "a0000000-0000-4000-8000-000000000001" };
const STRANGER: Caller = { role: "authenticated", userId: "b0000000-0000-4000-8000-000000000002" };

describe.skipIf(!url)("Prisma queries go through RLS", () => {
  const prisma = createPrisma(url!);
  afterAll(() => prisma.$disconnect());

  it("knows who is an admin", async () => {
    expect(await withCaller(prisma, ADMIN, isAdmin)).toBe(true);
    expect(await withCaller(prisma, STRANGER, isAdmin)).toBe(false);
    expect(await withCaller(prisma, ANON, isAdmin)).toBe(false);
  });

  it("lets anyone read published papers", async () => {
    const papers = await withCaller(prisma, ANON, (db) => listPapers(db, {}));
    expect(papers.length).toBeGreaterThan(0);
  });

  it("blocks writes from anon and non-admins, and rolls nothing back into place", async () => {
    const write = (caller: Caller) =>
      withCaller(prisma, caller, (db) =>
        db.courses.create({ data: { code: "99B11XX999", title: "x", semester: 1 } }),
      );
    await expect(write(ANON)).rejects.toThrow();
    await expect(write(STRANGER)).rejects.toThrow();
    const count = await withCaller(prisma, ANON, (db) =>
      db.courses.count({ where: { code: "99B11XX999" } }),
    );
    expect(count).toBe(0);
  });

  it("hides unpublished papers from non-admins but not from admins", async () => {
    const [first] = await withCaller(prisma, ADMIN, (db) => listAllPapers(db));
    const hash = first!.paper_hash;
    try {
      await withCaller(prisma, ADMIN, (db) =>
        db.papers.update({ where: { paper_hash: hash }, data: { published: false } }),
      );
      const seen = (caller: Caller) =>
        withCaller(prisma, caller, (db) => db.papers.count({ where: { paper_hash: hash } }));
      expect(await seen(ANON)).toBe(0);
      expect(await seen(STRANGER)).toBe(0);
      expect(await seen(ADMIN)).toBe(1);
    } finally {
      await withCaller(prisma, ADMIN, (db) =>
        db.papers.update({ where: { paper_hash: hash }, data: { published: true } }),
      );
    }
  });

  it("refuses deletes from non-admins and rolls back partial bulk deletes", async () => {
    const [a, b] = await withCaller(prisma, ADMIN, (db) => listAllPapers(db));
    const hashes = [a!.paper_hash, b!.paper_hash];
    const count = () =>
      withCaller(prisma, ADMIN, (db) => db.papers.count({ where: { paper_hash: { in: hashes } } }));

    await expect(withCaller(prisma, STRANGER, (db) => deletePapers(db, hashes))).rejects.toThrow();
    await expect(withCaller(prisma, ANON, (db) => deletePapers(db, hashes))).rejects.toThrow();
    // One unknown hash makes the whole admin delete fail and roll back.
    await expect(
      withCaller(prisma, ADMIN, (db) => deletePapers(db, [...hashes, "0".repeat(64)])),
    ).rejects.toThrow();
    expect(await count()).toBe(2);
  });

  it("derives paper_hash in the database exactly like paperHash()", async () => {
    const rows = await withCaller(prisma, ANON, (db) =>
      db.papers.findMany({
        select: { paper_hash: true, course_code: true, term: true, year: true },
      }),
    );
    for (const r of rows) expect(r.paper_hash).toBe(paperHash(r));
  });
});
