import { AppShell } from "@/components/shell/app-shell";

type SkeletonProps = {
  className?: string;
  style?: React.CSSProperties;
};

function SkeletonBlock({ className = "", style }: SkeletonProps) {
  return <span aria-hidden="true" className={`skeleton-block ${className}`} style={style} />;
}

function SkeletonLine({ width = "100%" }: Readonly<{ width?: string }>) {
  return <SkeletonBlock className="skeleton-line" style={{ width }} />;
}

function SkeletonHeader({ wide = false }: Readonly<{ wide?: boolean }>) {
  return (
    <header className="page-header">
      <div className="skeleton-stack">
        <SkeletonLine width="140px" />
        <SkeletonBlock className="skeleton-title" style={{ width: wide ? "min(520px, 80vw)" : "min(380px, 72vw)" }} />
        <SkeletonLine width="min(640px, 86vw)" />
      </div>
    </header>
  );
}

function SkeletonCard({ lines = 3, tall = false }: Readonly<{ lines?: number; tall?: boolean }>) {
  return (
    <article className={`card skeleton-card ${tall ? "skeleton-card-tall" : ""}`}>
      <SkeletonLine width="42%" />
      <SkeletonBlock className="skeleton-heading" />
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLine key={index} width={`${Math.max(42, 92 - index * 14)}%`} />
      ))}
    </article>
  );
}

function SkeletonList({ rows = 5 }: Readonly<{ rows?: number }>) {
  return (
    <div className="grid">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-list-row" key={index}>
          <SkeletonBlock className="skeleton-avatar" />
          <span className="skeleton-stack">
            <SkeletonLine width={`${82 - index * 4}%`} />
            <SkeletonLine width={`${52 - index * 3}%`} />
          </span>
        </div>
      ))}
    </div>
  );
}

export async function DashboardSkeleton() {
  return (
    <AppShell>
      <header className="dashboard-hero">
        <div className="skeleton-stack">
          <SkeletonLine width="180px" />
          <SkeletonBlock className="skeleton-title" style={{ width: "min(420px, 80vw)" }} />
          <SkeletonLine width="min(520px, 80vw)" />
        </div>
        <SkeletonCard lines={1} />
      </header>
      <section className="dashboard-grid">
        <article className="card autopilot-dashboard-card skeleton-card">
          <SkeletonLine width="180px" />
          <SkeletonBlock className="skeleton-heading" />
          <SkeletonLine width="70%" />
          <div className="metric-pair">
            <SkeletonBlock className="skeleton-metric" />
            <SkeletonBlock className="skeleton-metric" />
          </div>
        </article>
        <SkeletonCard tall />
        <SkeletonCard tall />
        <SkeletonCard tall />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard tall />
      </section>
    </AppShell>
  );
}

export async function AutopilotSkeleton() {
  return (
    <AppShell>
      <SkeletonHeader wide />
      <section className="autopilot-hero card">
        <div className="skeleton-stack">
          <SkeletonLine width="160px" />
          <SkeletonBlock className="skeleton-title" style={{ width: "min(420px, 80vw)" }} />
          <SkeletonLine width="75%" />
        </div>
        <SkeletonBlock className="skeleton-score" />
        <SkeletonCard lines={2} />
      </section>
      <section className="stats-grid grid" style={{ marginTop: 18 }}>
        {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} lines={1} />)}
      </section>
      <section className="workspace-grid" style={{ marginTop: 18 }}>
        <SkeletonCard tall lines={6} />
        <SkeletonCard tall lines={6} />
      </section>
    </AppShell>
  );
}

export async function WorkspaceSkeleton({ title = "Loading workspace" }: Readonly<{ title?: string }>) {
  return (
    <AppShell>
      <SkeletonHeader />
      <span className="sr-only">{title}</span>
      <section className="workspace-grid">
        <SkeletonCard tall lines={6} />
        <SkeletonCard tall lines={4} />
      </section>
      <section className="grid notes-grid" style={{ marginTop: 18 }}>
        {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} lines={3} />)}
      </section>
    </AppShell>
  );
}

export async function ListPageSkeleton({ title = "Loading list" }: Readonly<{ title?: string }>) {
  return (
    <AppShell>
      <SkeletonHeader />
      <span className="sr-only">{title}</span>
      <section className="workspace-grid">
        <article className="card">
          <SkeletonList rows={7} />
        </article>
        <SkeletonCard tall lines={5} />
      </section>
    </AppShell>
  );
}

export async function SpotifySkeleton() {
  return (
    <AppShell>
      <SkeletonHeader />
      <section className="workspace-grid">
        <article className="card">
          <div className="spotify-now-playing">
            <SkeletonBlock className="skeleton-cover" />
            <span className="skeleton-stack">
              <SkeletonLine width="120px" />
              <SkeletonBlock className="skeleton-heading" />
              <SkeletonLine width="60%" />
            </span>
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <SkeletonBlock className="skeleton-button" />
            <SkeletonBlock className="skeleton-button" />
            <SkeletonBlock className="skeleton-button" />
          </div>
          <SkeletonList rows={4} />
        </article>
        <SkeletonCard tall lines={6} />
      </section>
    </AppShell>
  );
}
