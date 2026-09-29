import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, createPrisma, withCaller, type Caller } from "./client";
import { deletePapers, isAdmin } from "./admin";
import { paperHash, sha256 } from "./hash";
import { listPapers } from "./queries";

// Integration test against the local Supabase database (`db:start`). It creates its own
// fixture course and papers and removes them afterwards, so it doesn't depend on (or touch)
// whatever real data is in the database. Skipped when DATABASE_URL is not set (CI).
const url = process.env.DATABASE_URL;
const ADMIN: Caller = { role: "authenticated", userId: "a0000000-0000-4000-8000-000000000001" };
const STRANGER: Caller = { role: "authenticated", userId: "b0000000-0000-4000-8000-000000000002" };

const COURSE = "99Z99ZZ999"; // valid shape, never a real JIIT code
const KEYS = [
  { course_code: COURSE, term: "T1" as const, year: 2001 },
  { course_code: COURSE, term: "T2" as const, year: 2001 },
];
const HASHES = KEYS.map(paperHash);

describe.skipIf(!url)("Prisma queries go through RLS", () => {
  const prisma = createPrisma(url!);
  const asAdmin = <T>(fn: Parameters<typeof withCaller<T>>[2]) => withCaller(prisma, ADMIN, fn);
  const cleanup = () =>
    asAdmin(async (db) => {
      await db.papers.deleteMany({ where: { course_code: COURSE } });
      await db.courses.deleteMany({ where: { code: COURSE } });
    });

  beforeAll(async () => {
    await cleanup(); // leftovers from an interrupted run
    await asAdmin(async (db) => {
      await db.courses.create({ data: { code: COURSE, title: "RLS test course", semester: 1 } });
      for (const k of KEYS) {
        await db.papers.create({
          data: {
            ...k,
            total_marks: 20,
            num_questions: 5,
            storage_path: `__rls-test__/${k.year}-${k.term}.pdf`,
            file_hash: sha256(`rls-test ${k.term}`),
          },
        });
      }
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const count = (caller: Caller) =>
    withCaller(prisma, caller, (db) => db.papers.count({ where: { paper_hash: { in: HASHES } } }));

  it("knows who is an admin", async () => {
    expect(await withCaller(prisma, ADMIN, isAdmin)).toBe(true);
    expect(await withCaller(prisma, STRANGER, isAdmin)).toBe(false);
    expect(await withCaller(prisma, ANON, isAdmin)).toBe(false);
  });

  it("lets anyone read published papers", async () => {
    const papers = await withCaller(prisma, ANON, (db) => listPapers(db, { course: COURSE }));
    expect(papers.map((p) => p.paper_hash).sort()).toEqual([...HASHES].sort());
  });

  it("blocks writes from anon and non-admins", async () => {
    const write = (caller: Caller) =>
      withCaller(prisma, caller, (db) =>
        db.courses.update({ where: { code: COURSE }, data: { title: "hacked" } }),
      );
    await expect(write(ANON)).rejects.toThrow();
    await expect(write(STRANGER)).rejects.toThrow();
    const course = await withCaller(prisma, ANON, (db) =>
      db.courses.findUnique({ where: { code: COURSE } }),
    );
    expect(course?.title).toBe("RLS test course");
  });

  it("hides unpublished papers from non-admins but not from admins", async () => {
    const hash = HASHES[0]!;
    await asAdmin((db) =>
      db.papers.update({ where: { paper_hash: hash }, data: { published: false } }),
    );
    const seen = (caller: Caller) =>
      withCaller(prisma, caller, (db) => db.papers.count({ where: { paper_hash: hash } }));
    expect(await seen(ANON)).toBe(0);
    expect(await seen(STRANGER)).toBe(0);
    expect(await seen(ADMIN)).toBe(1);
    await asAdmin((db) =>
      db.papers.update({ where: { paper_hash: hash }, data: { published: true } }),
    );
  });

  it("derives paper_hash in the database exactly like paperHash()", async () => {
    const rows = await withCaller(prisma, ANON, (db) =>
      db.papers.findMany({
        select: { paper_hash: true, course_code: true, term: true, year: true },
      }),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.paper_hash).toBe(paperHash(r));
  });

  it("refuses deletes from non-admins and rolls back partial bulk deletes", async () => {
    await expect(withCaller(prisma, STRANGER, (db) => deletePapers(db, HASHES))).rejects.toThrow();
    await expect(withCaller(prisma, ANON, (db) => deletePapers(db, HASHES))).rejects.toThrow();
    // One unknown hash makes the whole admin delete fail and roll back.
    await expect(asAdmin((db) => deletePapers(db, [...HASHES, "0".repeat(64)]))).rejects.toThrow();
    expect(await count(ADMIN)).toBe(2);
  });

  it("lets admins bulk delete", async () => {
    const paths = await asAdmin((db) => deletePapers(db, HASHES));
    expect(paths).toHaveLength(2);
    expect(await count(ADMIN)).toBe(0);
  });
});
