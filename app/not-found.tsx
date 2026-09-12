import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-sm font-semibold text-rig-700">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-prairie-600">The page or vehicle listing may have been removed.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-rig-700 px-5 py-2 text-white">Browse cars</Link>
    </div>
  );
}
