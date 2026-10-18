export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3 border border-slate-100 shadow-xs flex flex-col justify-between animate-pulse">
      {/* Image container skeleton */}
      <div className="relative aspect-square w-full rounded-xl sm:rounded-2xl bg-slate-100 overflow-hidden" />

      {/* Details skeleton */}
      <div className="mt-3 space-y-2">
        <div className="h-3.5 bg-slate-100 rounded-md w-4/5" />
        <div className="h-3 bg-slate-100 rounded-md w-3/5" />

        <div className="pt-2 flex items-center justify-between border-t border-slate-50">
          <div className="space-y-1">
            <div className="h-4 bg-slate-200 rounded-md w-14" />
            <div className="h-2.5 bg-slate-100 rounded-md w-10" />
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CategoryChipsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex space-x-2 overflow-hidden py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-9 w-24 rounded-full bg-slate-100 animate-pulse shrink-0"
        />
      ))}
    </div>
  );
}

export function CategoryTwoPaneSkeleton() {
  return (
    <div className="flex bg-white rounded-2xl border border-slate-100 min-h-[500px] overflow-hidden">
      {/* Left pane skeleton */}
      <div className="w-28 sm:w-36 bg-slate-50 border-r border-slate-100 p-2 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-2 space-y-1 animate-pulse">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-200" />
            <div className="h-2.5 bg-slate-200 rounded w-14 mx-auto" />
          </div>
        ))}
      </div>

      {/* Right pane skeleton */}
      <div className="flex-1 p-4 space-y-4">
        <div className="h-5 bg-slate-100 rounded w-36 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 animate-pulse"
            >
              <div className="aspect-square rounded-xl bg-slate-200" />
              <div className="h-3 bg-slate-200 rounded w-3/4 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 animate-pulse">
      <div className="aspect-square rounded-3xl bg-slate-100 border border-slate-100" />
      <div className="space-y-4">
        <div className="h-6 bg-slate-200 rounded-lg w-4/5" />
        <div className="h-4 bg-slate-100 rounded-md w-full" />
        <div className="h-4 bg-slate-100 rounded-md w-2/3" />
        <div className="h-20 bg-slate-50 rounded-2xl p-4 border border-slate-100" />
        <div className="h-12 bg-slate-200 rounded-2xl w-full" />
      </div>
    </div>
  );
}
