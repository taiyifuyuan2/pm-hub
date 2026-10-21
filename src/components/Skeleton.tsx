/** 読み込み中の目安になる、光が流れる灰色のブロック。中身の形に近づけて置く */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer rounded-md bg-[linear-gradient(100deg,var(--c-hover)_30%,var(--c-active)_50%,var(--c-hover)_70%)] bg-[length:220%_100%] ${className}`}
    />
  );
}

/** タスクカード1枚分の形 */
function TaskCardSkeleton() {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/**
 * 初回の読み込み中に、アプリ全体の枠（3列）を見せる。
 * 「ローカルサーバーに接続しています…」の文字だけを出すより、完成後の形が分かるぶん待ち時間を短く感じる。
 */
export function AppSkeleton({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col bg-canvas" role="status" aria-live="polite" aria-label={message}>
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-4">
        <Skeleton className="size-5" />
        <Skeleton className="h-4 w-20" />
        <div className="ml-4 hidden gap-2 sm:flex">
          {["w-14", "w-11", "w-16", "w-12"].map((w) => (
            <Skeleton key={w} className={`h-5 rounded-full ${w}`} />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[300px] shrink-0 border-r border-line bg-sidebar p-3 lg:block">
          <Skeleton className="mb-3 h-9 w-full" />
          <Skeleton className="mb-4 h-8 w-full" />
          {[0, 1, 2, 3].map((i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <div className="space-y-2 border-b border-line px-5 py-4">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 w-72 max-w-full" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="size-9 animate-spin-slow rounded-full border-2 border-line-strong border-t-fg" />
            <p className="text-sm text-fg">{message}</p>
            {hint && <p className="max-w-md text-xs leading-relaxed text-subtle">{hint}</p>}
          </div>
          <div className="px-4 pb-4">
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
        <div className="hidden w-[340px] shrink-0 border-l border-line bg-sidebar p-3 xl:block">
          <Skeleton className="mb-3 h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

/** 一覧の行の形（許可ルールの読み込みなど） */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="読み込み中">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
