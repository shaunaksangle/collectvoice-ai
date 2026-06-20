import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { ConnectionState, NavigationItem, PageKey, SystemStatus } from "../types";

interface LayoutProps {
  activePage: PageKey;
  children: ReactNode;
  connectionState: ConnectionState;
  navigation: NavigationItem[];
  onNavigate: (page: PageKey) => void;
  pageTitle: string;
  status: SystemStatus;
}

export function Layout({
  activePage,
  children,
  connectionState,
  navigation,
  onNavigate,
  pageTitle,
  status,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[272px_1fr]">
      <Sidebar activePage={activePage} navigation={navigation} onNavigate={onNavigate} />

      <div className="min-w-0">
        <Topbar connectionState={connectionState} pageTitle={pageTitle} status={status} />

        <nav className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation">
          <div className="flex gap-2 overflow-x-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === activePage;

              return (
                <button
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
