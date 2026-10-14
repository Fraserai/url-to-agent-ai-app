import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-5">
      <div className="card max-w-lg p-8 text-center">
        <h1 className="text-[32px] font-bold tracking-[-0.04em]">That page isn&apos;t here</h1>
        <p className="mt-3 text-sm leading-6 text-black/45">
          The agent or route you were looking for could not be found.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

