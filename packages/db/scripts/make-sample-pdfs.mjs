// Generates placeholder PDFs for the seeded sample papers into supabase/seed-papers/.
// Paths must match storage_path values in supabase/seed.sql.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase");
const seed = await readFile(join(root, "seed.sql"), "utf8");
const rows = [...seed.matchAll(/\('(\w+)', '(T\d)', (\d{4}), (\d+), (\d+), '([^']+\.pdf)'\)/g)];

for (const [, code, term, year, marks, n, path] of rows) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  const lines = [
    "Jaypee Institute of Information Technology, Noida",
    `${term} Examination ${year}`,
    `Course code: ${code}`,
    `Max marks: ${marks}    Questions: ${n}`,
    "",
    "SAMPLE PLACEHOLDER PAPER (seed data)",
    ...Array.from({ length: Number(n) }, (_, i) => `Q${i + 1}. Sample question ${i + 1}.`),
  ];
  lines.forEach((t, i) => page.drawText(t, { x: 50, y: 780 - i * 24, size: 14, font }));
  const out = join(root, "seed-papers", path);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, await doc.save());
  console.log("wrote", path);
}
