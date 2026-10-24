import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center px-4 py-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">No encontramos esta página</h1>
      <p className="mt-3 text-lg text-muted">Puede que el link esté mal copiado o que el plan ya no exista.</p>
      <Link href="/" className="btn-primary mt-6">
        Ver planes
      </Link>
    </main>
  );
}
