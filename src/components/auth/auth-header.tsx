import Link from "next/link";

export function AuthHeader() {
  return (
    <header className="mb-8 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-sm font-bold text-zinc-950">
          D
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">DentaFlow</span>
      </Link>
    </header>
  );
}
