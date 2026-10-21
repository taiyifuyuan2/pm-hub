import { Fragment } from "react";
import { Icon } from "./Icon";

export interface Crumb {
  label: string;
  /** 押せる階層には指定する。現在地（最後）には付けない */
  onClick?: () => void;
  /** ラベルの左に出す色の点 */
  dotColor?: string;
}

/**
 * パンくずリスト。いまどの階層にいるか（すべて › カテゴリ › タスク）を示し、上の階層へ戻れる。
 * 最後の項目が現在地で、aria-current="page"。長い名前は省略して、全文は title で見られる。
 */
export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="パンくずリスト" className={`min-w-0 ${className}`}>
      <ol className="flex min-w-0 items-center gap-1 text-xs text-subtle">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={`${i}-${item.label}`}>
              <li className={`flex min-w-0 items-center ${isLast ? "" : "shrink-0"}`}>
                {item.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="flex max-w-[9rem] items-center gap-1.5 rounded px-1 py-0.5 hover:bg-hover hover:text-fg"
                  >
                    {item.dotColor && <span className="size-2 shrink-0 rounded-full" style={{ background: item.dotColor }} aria-hidden="true" />}
                    <span className="truncate">{item.label}</span>
                  </button>
                ) : (
                  <span
                    className={`flex min-w-0 items-center gap-1.5 px-1 py-0.5 ${isLast ? "font-medium text-muted" : ""}`}
                    aria-current={isLast ? "page" : undefined}
                    title={item.label}
                  >
                    {item.dotColor && <span className="size-2 shrink-0 rounded-full" style={{ background: item.dotColor }} aria-hidden="true" />}
                    <span className="truncate">{item.label}</span>
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="shrink-0">
                  <Icon name="chevronRight" size={12} className="text-line-strong" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
