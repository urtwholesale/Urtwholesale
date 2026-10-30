export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between overflow-hidden animate-pulse">
      {/* Image container skeleton */}
      <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800" />

      {/* Details skeleton */}
      <div className="p-3 sm:p-3.5 space-y-2">
        <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md w-4/5" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-md w-3/5" />

        <div className="pt-2 flex items-center justify-between border-t border-slate-50 dark:border-slate-800">
          <div className="space-y-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-14" />
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-md w-10" />
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800" />
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
    <div className="flex items-center space-x-2 sm:space-x-2.5 overflow-hidden py-0.5 px-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 aspect-square rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800/80 animate-pulse border border-slate-200/60 dark:border-white/5"
        />
      ))}
    </div>
  );
}

export function CategoryTopRailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Top category rail skeleton (Expanded to borders, non-sticky on desktop) */}
      <div className="sticky md:relative top-16 md:top-auto z-30 w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-2 sm:py-2.5 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-y border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
        <div className="w-full max-w-[1780px] mx-auto space-y-2">
          <div className="flex items-center space-x-2 sm:space-x-2.5 overflow-hidden py-0.5 px-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 aspect-square rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-white/5"
              />
            ))}
          </div>
          {/* Subcategory strip */}
          <div className="flex space-x-2 overflow-hidden pt-1.5 border-t border-slate-100 dark:border-slate-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-20 rounded-full bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      </div>
      {/* Product Grid */}
      <ProductGridSkeleton count={8} />
    </div>
  );
}

export function CategoryTwoPaneSkeleton() {
  return (
    <div className="flex bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 min-h-125 overflow-hidden">
      {/* Left pane skeleton */}
      <div className="w-28 sm:w-36 bg-slate-50 dark:bg-slate-950/80 border-r border-slate-100 dark:border-slate-800 p-2 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-2 space-y-1 animate-pulse">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-14 mx-auto" />
          </div>
        ))}
      </div>

      {/* Right pane skeleton */}
      <div className="flex-1 p-4 space-y-4">
        <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-36 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 animate-pulse"
            >
              <div className="aspect-square rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mx-auto" />
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
