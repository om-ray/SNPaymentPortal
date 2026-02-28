import { NextResponse } from "next/server";
import { fetchPlansFromStripe } from "@/lib/plans";

export async function GET() {
  try {
    const plans = await fetchPlansFromStripe();
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 },
    );
  }
}
