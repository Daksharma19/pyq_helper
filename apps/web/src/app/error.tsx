"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <button onClick={reset} className="mt-4 text-brand-600 hover:underline">
        Try again
      </button>
    </div>
  );
}
