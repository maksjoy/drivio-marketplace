import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted">The page or vehicle listing may have been removed.</p>
      <ButtonLink href="/" className="mt-6">Browse cars</ButtonLink>
    </div>
  );
}
