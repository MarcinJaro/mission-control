import { NextResponse } from "next/server";

const CRONS_API_URL = process.env.CRONS_API_URL || "https://zosia.creativerebels.pl/api/crons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch(CRONS_API_URL, {
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch crons: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch crons:", error);
    return NextResponse.json(
      { error: "Failed to fetch crons", jobs: [] },
      { status: 500 }
    );
  }
}
