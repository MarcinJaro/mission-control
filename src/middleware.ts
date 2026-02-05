import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Check if Clerk is configured
const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/",
  "/chat(.*)",
  "/deliverables(.*)",
]);

// Public routes (API endpoints for agents)
const isPublicRoute = createRouteMatcher([
  "/api/deliverables(.*)",  // Deliverables API - public for now
  "/sign-in(.*)",
  // "/sign-up(.*)",  // DISABLED - only existing users can log in
]);

// Fallback middleware when Clerk is not configured
function noAuthMiddleware(req: NextRequest) {
  return NextResponse.next();
}

// Clerk middleware when configured
const authMiddleware = clerkMiddleware(async (auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return;
  }
  
  // Protect all other routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export default hasClerkKeys ? authMiddleware : noAuthMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
