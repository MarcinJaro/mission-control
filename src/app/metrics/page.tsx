"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Utility
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

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "zinc",
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  icon: string;
  color?: "zinc" | "emerald" | "blue" | "amber" | "red" | "purple";
}) {
  const colorClasses = {
    zinc: "border-zinc-700",
    emerald: "border-emerald-500/50",
    blue: "border-blue-500/50",
    amber: "border-amber-500/50",
    red: "border-red-500/50",
    purple: "border-purple-500/50",
  };

  return (
    <div
      className={cn(
        "bg-zinc-900 rounded-xl p-6 border-l-4",
        colorClasses[color]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-sm">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>}
          {trend && (
            <p
              className={cn(
                "text-sm mt-2",
                trend.value >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%{" "}
              {trend.label}
            </p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

// Product Section
function ProductSection({
  name,
  emoji,
  metrics,
  color,
}: {
  name: string;
  emoji: string;
  metrics: { label: string; value: string }[];
  color: "emerald" | "blue" | "amber" | "purple";
}) {
  const colorClasses = {
    emerald: "bg-emerald-500/10 border-emerald-500/30",
    blue: "bg-blue-500/10 border-blue-500/30",
    amber: "bg-amber-500/10 border-amber-500/30",
    purple: "bg-purple-500/10 border-purple-500/30",
  };

  return (
    <div className={cn("rounded-xl p-5 border", colorClasses[color])}>
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <span>{emoji}</span>
        {name}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-zinc-400 text-xs">{m.label}</p>
            <p className="text-xl font-semibold">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Loading skeleton
function MetricSkeleton() {
  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-24 mb-3"></div>
      <div className="h-8 bg-zinc-800 rounded w-32"></div>
    </div>
  );
}

// Main Page
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
        // Use placeholder data for now
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
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-400 hover:text-white">
              ← Back
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>📊</span>
              <span>Metrics Dashboard</span>
            </h1>
          </div>
          <div className="text-sm text-zinc-500">
            Last updated: {new Date().toLocaleString("pl-PL")}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Error banner */}
        {error && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <p className="text-amber-400">
              ⚠️ Using placeholder data. API not configured yet: {error}
            </p>
          </div>
        )}

        {/* Overview Cards */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-400 mb-4">Overview</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <MetricSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total MRR"
                value={formatCurrency(data?.totalMRR || 0)}
                trend={{ value: 12, label: "vs last month" }}
                icon="💰"
                color="emerald"
              />
              <MetricCard
                title="Revenue (30d)"
                value={formatCurrency(data?.totalRevenue30d || 0)}
                subtitle="All products"
                icon="📈"
                color="blue"
              />
              <MetricCard
                title="Active Users"
                value={formatNumber(data?.activeUsers || 0)}
                subtitle="Last 7 days"
                icon="👥"
                color="purple"
              />
              <MetricCard
                title="Burn Rate"
                value={formatCurrency(data?.burnRate || 0)}
                subtitle="Monthly costs"
                icon="🔥"
                color="red"
              />
            </div>
          )}
        </section>

        {/* Products */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-400 mb-4">
            Products
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ProductSection
              name="BuzzGen.io"
              emoji="🎬"
              color="emerald"
              metrics={[
                {
                  label: "MRR",
                  value: formatCurrency(data?.products?.buzzgen?.mrr || 0),
                },
                {
                  label: "Subscribers",
                  value: formatNumber(data?.products?.buzzgen?.subscribers || 0),
                },
                {
                  label: "Churn",
                  value: `${data?.products?.buzzgen?.churn || 0}%`,
                },
                { label: "LTV", value: formatCurrency(0) },
              ]}
            />
            <ProductSection
              name="BuzzRank.io"
              emoji="🔍"
              color="blue"
              metrics={[
                {
                  label: "Active Users",
                  value: formatNumber(data?.products?.buzzrank?.users || 0),
                },
                {
                  label: "Page Views",
                  value: formatNumber(data?.products?.buzzrank?.pageviews || 0),
                },
                { label: "MRR", value: formatCurrency(0) },
                { label: "Trial→Paid", value: "0%" },
              ]}
            />
            <ProductSection
              name="Nature-Solution"
              emoji="🌿"
              color="amber"
              metrics={[
                {
                  label: "Orders (30d)",
                  value: formatNumber(
                    data?.products?.natureSolution?.orders || 0
                  ),
                },
                {
                  label: "Revenue (30d)",
                  value: formatCurrency(
                    data?.products?.natureSolution?.revenue || 0
                  ),
                },
                { label: "Avg Order", value: formatCurrency(0) },
                { label: "Return Rate", value: "0%" },
              ]}
            />
          </div>
        </section>

        {/* Costs */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-400 mb-4">
            Monthly Costs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Infrastructure"
              value={formatCurrency(data?.costs?.infra || 0)}
              subtitle="Vercel, Firebase, Convex"
              icon="🖥️"
              color="zinc"
            />
            <MetricCard
              title="API Costs"
              value={formatCurrency(data?.costs?.api || 0)}
              subtitle="OpenAI, ElevenLabs, etc."
              icon="🔌"
              color="zinc"
            />
            <MetricCard
              title="Marketing"
              value={formatCurrency(data?.costs?.marketing || 0)}
              subtitle="Ads, tools"
              icon="📢"
              color="zinc"
            />
          </div>
        </section>

        {/* Setup Guide */}
        <section className="mt-8 bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">🔧 Setup Required</h2>
          <p className="text-zinc-400 mb-4">
            Add these environment variables to connect data sources:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="font-mono text-emerald-400">STRIPE_SECRET_KEY</p>
              <p className="text-zinc-500">BuzzGen payments</p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="font-mono text-emerald-400">POSTHOG_API_KEY</p>
              <p className="text-zinc-500">Analytics data</p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="font-mono text-emerald-400">
                GOOGLE_SERVICE_ACCOUNT_JSON
              </p>
              <p className="text-zinc-500">GA4 traffic data</p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="font-mono text-emerald-400">BASELINKER_API_KEY</p>
              <p className="text-zinc-500">E-commerce orders</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
