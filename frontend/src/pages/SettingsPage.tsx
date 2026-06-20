import { KeyRound, ServerCog, ShieldCheck } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { API_BASE_URL } from "../lib/api";
import type { ConnectionState, SystemStatus } from "../types";

interface SettingsPageProps {
  connectionState: ConnectionState;
  status: SystemStatus;
}

export function SettingsPage({ connectionState, status }: SettingsPageProps) {
  const connectionLabel = connectionState === "online" ? "Online" : connectionState === "checking" ? "Checking" : "Offline";
  const connectionTone = connectionState === "online" ? "green" : connectionState === "checking" ? "amber" : "slate";

  return (
    <div>
      <PageHeader
        description="Configuration surface for environment-backed providers, API connectivity, and future role controls."
        eyebrow="Administration"
        title="Settings"
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ServerCog aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Runtime</h2>
              <p className="mt-1 text-xs text-slate-500">Backend status and voice mode</p>
            </div>
          </div>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">API</dt>
              <dd>
                <StatusBadge label={connectionLabel} tone={connectionTone} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Mode</dt>
              <dd>
                <StatusBadge label={status.voice_mode} tone="blue" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Version</dt>
              <dd className="text-sm font-medium text-slate-800">{status.version}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <KeyRound aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Providers</h2>
              <p className="mt-1 text-xs text-slate-500">Environment variable backed</p>
            </div>
          </div>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Telephony</dt>
              <dd>
                <StatusBadge label={status.telephony_provider} tone="slate" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Sarvam</dt>
              <dd>
                <StatusBadge label="not connected" tone="slate" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">API base</dt>
              <dd className="max-w-[170px] truncate text-sm font-medium text-slate-800">{API_BASE_URL}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Access</h2>
              <p className="mt-1 text-xs text-slate-500">Prepared for roles</p>
            </div>
          </div>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Auth</dt>
              <dd>
                <StatusBadge label="placeholder" tone="amber" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Roles</dt>
              <dd className="text-sm font-medium text-slate-800">manager, agent, admin</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Audit logs</dt>
              <dd>
                <StatusBadge label="schema ready" tone="green" />
              </dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  );
}
