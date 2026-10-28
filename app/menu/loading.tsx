/** Menu skeleton — mirrors the real card grid to avoid layout shift. */
export default function MenuLoading() {
  return (
    <main className="min-h-dvh bg-canvas">
      <div className="container-page pt-12 pb-32">
        <div className="mx-auto h-7 w-40 animate-pulse rounded-full bg-paper-deep" />
        <div className="mx-auto mt-4 h-12 w-56 animate-pulse rounded-2xl bg-paper-deep" />
        <div className="mx-auto mt-3 h-5 w-80 max-w-full animate-pulse rounded-full bg-paper-deep" />
        <div className="mx-auto mt-8 h-13 max-w-2xl animate-pulse rounded-full bg-paper-deep" />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-card border border-line bg-paper p-4"
            >
              <div className="h-40 animate-pulse rounded-xl bg-paper-deep" />
              <div className="mt-4 h-5 w-2/3 animate-pulse rounded-full bg-paper-deep" />
              <div className="mt-2 h-4 w-full animate-pulse rounded-full bg-paper-deep" />
              <div className="mt-4 flex justify-between">
                <div className="h-6 w-20 animate-pulse rounded-full bg-paper-deep" />
                <div className="h-10 w-24 animate-pulse rounded-full bg-paper-deep" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
