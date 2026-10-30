/** Placeholder cards shown while the catalog loads, so the results area never flashes empty. */
export function ListingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading cars" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {[0, 1, 2].map((item) => (
        <div key={item} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="aspect-[4/3] animate-pulse bg-surface-sunken" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-sunken" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}
