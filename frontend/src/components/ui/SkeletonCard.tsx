export function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`skeleton rounded ${w} ${h}`} />;
}

export default function SkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card p-5 space-y-3">
      <SkeletonLine w="w-1/3" h="h-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} w={i % 2 === 0 ? 'w-full' : 'w-4/5'} h="h-3" />
      ))}
    </div>
  );
}
