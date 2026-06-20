import { BotMessageSquare } from "lucide-react";

import { StatusBadge } from "./StatusBadge";
import type { ConnectionState, SystemStatus } from "../types";

interface TopbarProps {
  connectionState: ConnectionState;
  pageTitle: string;
  status: SystemStatus;
}

export function Topbar({ connectionState, pageTitle, status }: TopbarProps) {
  const apiTone = connectionState === "online" ? "green" : connectionState === "checking" ? "amber" : "slate";
  const apiLabel = connectionState === "online" ? "API online" : connectionState === "checking" ? "Checking API" : "API offline";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
              <BotMessageSquare aria-hidden="true" className="h-5 w-5" />
            </div>
            <p className="truncate text-sm font-semibold text-slate-950">CollectVoice AI</p>
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium uppercase text-slate-500">CollectVoice AI</p>
            <h1 className="mt-0.5 truncate text-lg font-semibold text-slate-950">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <StatusBadge label={status.voice_mode} tone="blue" />
          <StatusBadge label={apiLabel} tone={apiTone} />
          <div className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 sm:flex">
            CV
          </div>
        </div>
      </div>
    </header>
  );
}
