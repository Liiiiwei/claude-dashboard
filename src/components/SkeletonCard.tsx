export default function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="h-5 glass-shimmer rounded-lg w-3/5 mb-3" />
      <div className="h-4 glass-shimmer rounded-lg w-4/5 mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="h-6 glass-shimmer rounded-full w-16" />
        <div className="h-6 glass-shimmer rounded-full w-12" />
      </div>
      <div className="h-3 glass-shimmer rounded-lg w-full" />
    </div>
  );
}
