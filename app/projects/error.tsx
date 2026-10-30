"use client";

import Link from "next/link";

export default function ProjectsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Projects could not load</h1>
      <p className="mt-3 text-muted-foreground">The server could not complete this request. Try again in a moment.</p>
      <div className="mt-6 flex items-center gap-5">
        <button type="button" onClick={() => retry()} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Try again</button>
        <Link href="/" className="text-sm text-muted-foreground">Back to OneRack Pro</Link>
      </div>
    </main>
  );
}
