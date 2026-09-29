import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <Link href="/papers" className="mt-4 inline-block text-brand-600 hover:underline">
        Browse papers
      </Link>
    </div>
  );
}
