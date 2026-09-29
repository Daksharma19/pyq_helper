"use client";

import { useTransition } from "react";
import { removePaper, setPublished } from "@/app/admin/actions";
import { btnDanger, btnSecondary } from "@/components/admin/styles";

export function PaperControls({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
      <button
        disabled={pending}
        onClick={() => start(() => setPublished(id, !published))}
        className={btnSecondary}
      >
        {published ? "Unpublish" : "Publish"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this paper and its PDF? This cannot be undone.")) {
            start(() => removePaper(id));
          }
        }}
        className={btnDanger}
      >
        Delete
      </button>
    </section>
  );
}
