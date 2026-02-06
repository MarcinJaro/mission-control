import { NextResponse } from "next/server";

// Stripe MRR calculation
async function getStripeMetrics() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { mrr: 0, subscribers: 0, revenue30d: 0, churn: 0, error: "STRIPE_SECRET_KEY not set" };
  }

  try {
    // Get active subscriptions
    const subsRes = await fetch(
      "https://api.stripe.com/v1/subscriptions?status=active&limit=100",
      {
        headers: { Authorization: `Bearer ${stripeKey}` },
      }
    );
    const subs = await subsRes.json();

    let mrr = 0;
    const subscribers = subs.data?.length || 0;

    for (const sub of subs.data || []) {
      for (const item of sub.items?.data || []) {
        const amount = item.price?.unit_amount || 0;
        const interval = item.price?.recurring?.interval;
        if (interval === "month") {
          mrr += amount / 100;
        } else if (interval === "year") {
          mrr += amount / 100 / 12;
        }
      }
    }

    // Get revenue last 30 days
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?created[gte]=${thirtyDaysAgo}&limit=100`,
      {
        headers: { Authorization: `Bearer ${stripeKey}` },
      }
    );
    const charges = await chargesRes.json();

    const revenue30d = (charges.data || [])
      .filter((c: any) => c.paid && !c.refunded)
      .reduce((sum: number, c: any) => sum + (c.amount || 0) / 100, 0);

    return { mrr, subscribers, revenue30d, churn: 0 };
  } catch (e) {
    console.error("Stripe error:", e);
    return { mrr: 0, subscribers: 0, revenue30d: 0, churn: 0, error: String(e) };
  }
}

// PostHog metrics
async function getPostHogMetrics() {
  const apiKey = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  
  if (!apiKey || !projectId) {
    return { activeUsers: 0, pageviews: 0, error: "POSTHOG_API_KEY or POSTHOG_PROJECT_ID not set" };
  }

  try {
    // Get unique users last 7 days
    const res = await fetch(
      `https://app.posthog.com/api/projects/${projectId}/insights/trend/?events=[{"id":"$pageview"}]&date_from=-7d`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    const data = await res.json();
    
    const pageviews = data.result?.[0]?.aggregated_value || 0;
    
    // Unique users approximation
    const usersRes = await fetch(
      `https://app.posthog.com/api/projects/${projectId}/insights/trend/?events=[{"id":"$pageview","math":"dau"}]&date_from=-7d`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    const usersData = await usersRes.json();
    const activeUsers = usersData.result?.[0]?.aggregated_value || 0;

    return { activeUsers, pageviews };
  } catch (e) {
    console.error("PostHog error:", e);
    return { activeUsers: 0, pageviews: 0, error: String(e) };
  }
}

// Main handler
export async function GET() {
  try {
    // Fetch all metrics in parallel
    const [stripe, posthog] = await Promise.all([
      getStripeMetrics(),
      getPostHogMetrics(),
    ]);

    const data = {
      // Overview
      totalMRR: stripe.mrr,
      totalRevenue30d: stripe.revenue30d,
      activeUsers: posthog.activeUsers,
      burnRate: 0, // TODO: Calculate from costs

      // Products
      products: {
        buzzgen: {
          mrr: stripe.mrr,
          subscribers: stripe.subscribers,
          churn: stripe.churn,
        },
        buzzrank: {
          users: 0, // TODO: Separate tracking
          pageviews: posthog.pageviews,
        },
        natureSolution: {
          orders: 0, // TODO: BaseLinker
          revenue: 0,
        },
      },

      // Costs (TODO: implement)
      costs: {
        infra: 0,
        api: 0,
        marketing: 0,
      },

      // Errors for debugging
      _errors: {
        stripe: stripe.error,
        posthog: posthog.error,
      },

      // Timestamp
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (e) {
    console.error("Metrics error:", e);
    return NextResponse.json(
      { error: "Failed to fetch metrics", details: String(e) },
      { status: 500 }
    );
  }
}
