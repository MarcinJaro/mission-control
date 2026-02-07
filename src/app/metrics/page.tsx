"use client";

import { useState, useEffect } from "react";
import DashboardHeader from "../../components/DashboardHeader";

function formatCurrency(amount: number, currency = "PLN") {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number) {
  return new Intl.NumberFormat("pl-PL").format(num);
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Metric Card - clean design matching dashboard
function MetricCard({
  title,
  value,
  subtitle,
  trend,
  accentColor = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  accentColor?: "default" | "green" | "blue" | "amber" | "red";
}) {
  const borderColors = {
    default: "border-l-[var(--border)]",
    green: "border-l-emerald-500",
    blue: "border-l-blue-500",
    amber: "border-l-amber-500",
    red: "border-l-red-500",
  };

  return (
    <div className={cn(
      "card-glow p-5 border-l-4",
      borderColors[accentColor]
    )}>
      <p className="text-[var(--text-muted)] text-xs font-mono uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold mt-2 text-[var(--text-primary)]">{value}</p>
      {subtitle && <p className="text-[var(--text-muted)] text-xs mt-1">{subtitle}</p>}
      {trend && (
        <p className={cn(
          "text-xs mt-2 font-mono",
          trend.value >= 0 ? "text-emerald-400" : "text-red-400"
        )}>
          {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}

// Product Section - consistent with dashboard cards
function ProductSection({
  name,
  metrics,
  accentColor,
}: {
  name: string;
  metrics: { label: string; value: string }[];
  accentColor: "green" | "blue" | "amber" | "violet";
}) {
  const colorClasses = {
    green: "border-emerald-500/30 bg-emerald-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  };

  return (
    <div className={cn("rounded-xl p-5 border", colorClasses[accentColor])}>
      <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-4 font-mono uppercase tracking-wider">
        {name}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-[var(--text-muted)] text-[10px] font-mono uppercase">{m.label}</p>
            <p className="text-lg font-semibold text-[var(--text-primary)]">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Loading skeleton
function MetricSkeleton() {
  return (
    <div className="card-glow p-5 animate-pulse">
      <div className="h-3 bg-[var(--bg-elevated)] rounded w-20 mb-3"></div>
      <div className="h-7 bg-[var(--bg-elevated)] rounded w-28"></div>
    </div>
  );
}

export default function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/metrics/overview");
        if (!res.ok) throw new Error("Failed to fetch metrics");
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setData({
          totalMRR: 0,
          totalRevenue30d: 0,
          activeUsers: 0,
          burnRate: 0,
          products: {
            buzzgen: { mrr: 0, subscribers: 0, churn: 0 },
            buzzrank: { users: 0, pageviews: 0 },
            natureSolution: { orders: 0, revenue: 0 },
          },
          costs: {
            infra: 0,
            api: 0,
            marketing: 0,
          },
        });
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
      <DashboardHeader
        rightContent={
          <div className="text-xs text-[var(--text-muted)] font-mono">
            {new Date().toLocaleDateString("pl-PL")}
          </div>
        }
      />

      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Error banner */}
        {error && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <p className="text-amber-400 text-sm">
              Placeholder data — API not configured: {error}
            </p>
          </div>
        )}

        {/* Overview Cards */}
        <section className="mb-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center gap-3">
            <span>Overview</span>
            <span className="flex-1 h-px bg-[var(--border)]" />
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <MetricSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total MRR"
                value={formatCurrency(data?.totalMRR || 0)}
                trend={{ value: 12, label: "vs last month" }}
                accentColor="green"
              />
              <MetricCard
                title="Revenue 30d"
                value={formatCurrency(data?.totalRevenue30d || 0)}
                subtitle="All products"
                accentColor="blue"
              />
              <MetricCard
                title="Active Users"
                value={formatNumber(data?.activeUsers || 0)}
                subtitle="Last 7 days"
                accentColor="amber"
              />
              <MetricCard
                title="Burn Rate"
                value={formatCurrency(data?.burnRate || 0)}
                subtitle="Monthly costs"
                accentColor="red"
              />
            </div>
          )}
        </section>

        {/* Products */}
        <section className="mb-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center gap-3">
            <span>Products</span>
            <span className="flex-1 h-px bg-[var(--border)]" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ProductSection
              name="BuzzGen.io"
              accentColor="green"
              metrics={[
                { label: "MRR", value: formatCurrency(data?.products?.buzzgen?.mrr || 0) },
                { label: "Subscribers", value: formatNumber(data?.products?.buzzgen?.subscribers || 0) },
                { label: "Churn", value: `${data?.products?.buzzgen?.churn || 0}%` },
                { label: "LTV", value: formatCurrency(0) },
              ]}
            />
            <ProductSection
              name="BuzzRank.io"
              accentColor="blue"
              metrics={[
                { label: "Active Users", value: formatNumber(data?.products?.buzzrank?.users || 0) },
                { label: "Page Views", value: formatNumber(data?.products?.buzzrank?.pageviews || 0) },
                { label: "MRR", value: formatCurrency(0) },
                { label: "Trial→Paid", value: "0%" },
              ]}
            />
            <ProductSection
              name="Nature-Solution"
              accentColor="amber"
              metrics={[
                { label: "Orders 30d", value: formatNumber(data?.products?.natureSolution?.orders || 0) },
                { label: "Revenue 30d", value: formatCurrency(data?.products?.natureSolution?.revenue || 0) },
                { label: "Avg Order", value: formatCurrency(0) },
                { label: "Return Rate", value: "0%" },
              ]}
            />
          </div>
        </section>

        {/* Costs */}
        <section className="mb-8">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center gap-3">
            <span>Monthly Costs</span>
            <span className="flex-1 h-px bg-[var(--border)]" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Infrastructure"
              value={formatCurrency(data?.costs?.infra || 0)}
              subtitle="Vercel, Firebase, Convex"
            />
            <MetricCard
              title="API Costs"
              value={formatCurrency(data?.costs?.api || 0)}
              subtitle="OpenAI, ElevenLabs, etc."
            />
            <MetricCard
              title="Marketing"
              value={formatCurrency(data?.costs?.marketing || 0)}
              subtitle="Ads, tools"
            />
          </div>
        </section>

        {/* Setup Guide */}
        <section className="card-glow p-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4">
            Setup Required
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mb-4">
            Add environment variables to connect data sources:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              { key: "STRIPE_SECRET_KEY", desc: "BuzzGen payments" },
              { key: "POSTHOG_API_KEY", desc: "Analytics data" },
              { key: "GOOGLE_SERVICE_ACCOUNT_JSON", desc: "GA4 traffic" },
              { key: "BASELINKER_API_KEY", desc: "E-commerce orders" },
            ].map(({ key, desc }) => (
              <div key={key} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3">
                <p className="font-mono text-[var(--accent)] text-xs">{key}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
