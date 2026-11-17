import Link from "next/link";

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Connected market</h1>
      <p className="mt-3 text-muted">This app connects to one existing binary market. Creating another market requires a separate contract deployment and configuration.</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-brand">View market →</Link>
    </div>
  );
}
