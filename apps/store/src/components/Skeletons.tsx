export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between overflow-hidden animate-pulse">
      {/* Image container skeleton */}
      <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800" />

      {/* boAt Signature Yellow Ribbon skeleton */}
      <div className="w-full h-6 bg-amber-200/80 dark:bg-amber-900/30 flex items-center justify-between px-2.5">
        <div className="h-2.5 bg-amber-300 dark:bg-amber-800/60 rounded w-20" />
        <div className="h-3.5 bg-white dark:bg-slate-800 rounded w-9" />
      </div>

      {/* Details skeleton */}
      <div className="p-3 sm:p-3.5 space-y-2">
        <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md w-4/5" />

        {/* Price & color dots skeleton */}
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-16" />
          <div className="flex space-x-1">
            <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>

        {/* Discount line */}
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-16" />

        {/* Bottom MOQ and button */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-14" />
          <div className="w-12 h-6 rounded-full bg-slate-200 dark:bg-slate-700" />
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

export function CategoryChipsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="w-full py-2">
      <div className="flex items-center space-x-4 sm:space-x-6 md:space-x-8 overflow-hidden py-1">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex flex-col items-center shrink-0 w-22 sm:w-26 md:w-28 animate-pulse">
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60" />
            <div className="h-3.5 w-16 bg-slate-100/70 dark:bg-slate-800/60 rounded mt-2.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryTopRailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="w-full py-2">
        <div className="flex items-center space-x-4 sm:space-x-6 md:space-x-8 overflow-hidden py-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center shrink-0 w-22 sm:w-26 md:w-28">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60" />
              <div className="h-3.5 w-16 bg-slate-100/70 dark:bg-slate-800/60 rounded mt-2.5" />
            </div>
          ))}
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
