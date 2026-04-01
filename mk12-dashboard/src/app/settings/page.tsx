"use client";

import { Header } from "@/components/layout/Header";

export default function SettingsPage() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="text-2xl font-bold mb-2">Settings</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Configure your EditorLens MK-12 instance
          </p>

          <div className="space-y-8">
            {/* API Configuration */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                API Configuration
              </h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium">API Base URL</span>
                  <input
                    type="url"
                    defaultValue="http://localhost:3000"
                    className="mt-1 block h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">WebSocket URL</span>
                  <input
                    type="url"
                    defaultValue="ws://localhost:3001"
                    className="mt-1 block h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </label>
              </div>
            </section>

            {/* Pipeline Configuration */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pipeline Defaults
              </h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-border" />
                  <span className="text-sm">Auto-start pipeline on upload</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-border" />
                  <span className="text-sm">Enable knowledge graph extraction</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-sm">Auto-approve high-confidence segments (&gt;95%)</span>
                </label>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
