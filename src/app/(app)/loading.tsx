export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-6 w-56 rounded bg-muted" />
        <div className="h-3 w-96 max-w-full rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface h-28 p-4">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-4 h-7 w-24 rounded bg-muted" />
            <div className="mt-2 h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="surface h-72 xl:col-span-2" />
        <div className="surface h-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="surface h-40" />
        ))}
      </div>
    </div>
  );
}
