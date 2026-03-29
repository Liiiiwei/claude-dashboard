export default function SkeletonCard() {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 animate-pulse">
      <div className="h-5 bg-gray-800 rounded w-3/5 mb-3" />
      <div className="h-4 bg-gray-800 rounded w-4/5 mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="h-6 bg-gray-800 rounded-full w-16" />
        <div className="h-6 bg-gray-800 rounded-full w-12" />
      </div>
      <div className="h-3 bg-gray-800 rounded w-full" />
    </div>
  );
}
