"use client";

import { cn } from "@/lib/utils";

type ConsoleSectionSidebarItem<T extends string> = {
  key: T;
  label: string;
  description?: string;
};

type ConsoleSectionSidebarProps<T extends string> = {
  activeKey: T;
  className?: string;
  items: ConsoleSectionSidebarItem<T>[];
  onChange: (key: T) => void;
  title?: string;
};

export function ConsoleSectionSidebar<T extends string>({
  activeKey,
  className,
  items,
  onChange,
  title
}: ConsoleSectionSidebarProps<T>) {
  return (
    <aside className={cn("space-y-3", className)}>
      {title ? <div className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</div> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <button
            className={cn(
              "w-full rounded-[18px] border px-4 py-4 text-left transition",
              activeKey === item.key
                ? "border-blue-200 bg-blue-50/70 shadow-sm"
                : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white"
            )}
            key={item.key}
            onClick={() => onChange(item.key)}
            type="button"
          >
            <div className="text-sm font-semibold text-slate-950">{item.label}</div>
            {item.description ? <div className="mt-2 text-sm leading-6 text-slate-500">{item.description}</div> : null}
          </button>
        ))}
      </div>
    </aside>
  );
}
