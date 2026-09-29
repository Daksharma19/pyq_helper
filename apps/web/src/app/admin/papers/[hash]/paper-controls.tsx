"use client";

import { useState, useTransition } from "react";
import { removePaper, setPublished } from "@/app/admin/actions";
import { Notice } from "@/components/admin/notice";
import { btnDanger, btnSecondary } from "@/components/admin/styles";

export function PaperControls({ hash, published }: { hash: string; published: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          onClick={() => start(() => setPublished(hash, !published))}
          className={btnSecondary}
        >
          {published ? "Unpublish" : "Publish"}
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this paper and its PDF? This cannot be undone.")) return;
            // On success the action redirects to the list; it only returns on failure.
            start(async () => setError((await removePaper(hash)).errors?._));
          }}
          className={btnDanger}
        >
          {pending ? "Working…" : "Delete paper"}
        </button>
      </div>
    </section>
  );
}
