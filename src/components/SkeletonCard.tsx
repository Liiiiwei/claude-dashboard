// 骨架卡片：尺寸與 ProjectCard 對齊（rounded-xl p-2.5），避免載入完成時版面跳動
export default function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl p-2.5" aria-hidden>
      <div className="h-4 glass-shimmer rounded-lg w-3/5 mb-2" />
      <div className="h-3 glass-shimmer rounded-lg w-4/5 mb-2.5" />
      <div className="flex gap-1.5 mb-2.5">
        <div className="h-5 glass-shimmer rounded-full w-14" />
        <div className="h-5 glass-shimmer rounded-full w-10" />
      </div>
      <div className="h-3 glass-shimmer rounded-lg w-2/5 mb-2" />
      <div className="flex gap-1.5">
        <div className="h-7 glass-shimmer rounded-lg flex-1" />
        <div className="h-7 glass-shimmer rounded-lg flex-1" />
      </div>
    </div>
  );
}
