// Shown by loading.tsx while a room's server data is on its way, so a tap never feels frozen.
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton h-3 w-24 rounded-full" />
      <div className="skeleton mt-4 mb-8 h-10 w-56 rounded-2xl sm:h-12 sm:w-72" />
      <ul className="space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="flex items-center gap-4 rounded-[28px] bg-ivory p-5 shadow-card">
            <div className="skeleton size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/5 rounded-full" />
              <div className="skeleton h-3 w-3/5 rounded-full" />
            </div>
            <div className="skeleton h-10 w-24 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
