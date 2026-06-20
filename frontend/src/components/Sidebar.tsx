import { BotMessageSquare } from "lucide-react";

import type { NavigationItem, PageKey } from "../types";

interface SidebarProps {
  activePage: PageKey;
  navigation: NavigationItem[];
  onNavigate: (page: PageKey) => void;
}

export function Sidebar({ activePage, navigation, onNavigate }: SidebarProps) {
  return (
    <aside className="hidden min-h-screen border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
          <BotMessageSquare aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-950">CollectVoice AI</p>
          <p className="text-xs text-slate-500">Collections console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-5" aria-label="Sidebar navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activePage;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-6 py-4">
        <p className="text-xs font-medium uppercase text-slate-400">Auth</p>
        <p className="mt-1 text-sm text-slate-600">Role-ready placeholder</p>
      </div>
    </aside>
  );
}
