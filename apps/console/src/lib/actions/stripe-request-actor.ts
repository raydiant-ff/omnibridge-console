/**
 * Resolve the actor (human user) who triggered a Stripe event by looking up
 * the request log via the undocumented /v1/request_logs/:id endpoint.
 *
 * The response contains:
 *   request.from_dashboard: true/false
 *   request.from_dashboard_user: "admin@yourcompany.com"
 *
 * This is fire-and-forget — callers should .catch() errors.
 */

interface StripeActor {
  actorType: "stripe_dashboard" | "stripe_api" | "stripe_system" | "omni_user";
  actorId: string | null;
  actorName: string | null;
}

export async function resolveStripeActor(
  requestId: string | null | undefined,
  idempotencyKey: string | null | undefined,
): Promise<StripeActor> {
  // Check for Omni-originated events first
  if (idempotencyKey?.startsWith("omni:")) {
    const parts = idempotencyKey.split(":");
    return {
      actorType: "omni_user",
      actorId: parts[1] ?? null,
      actorName: parts[2] ?? null,
    };
  }

  // No request ID = Stripe system event (automated)
  if (!requestId) {
    return { actorType: "stripe_system", actorId: null, actorName: null };
  }

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { actorType: "stripe_api", actorId: null, actorName: null };

    const res = await fetch(`https://api.stripe.com/v1/request_logs/${requestId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!res.ok) {
      return { actorType: "stripe_api", actorId: requestId, actorName: null };
    }

    const log = await res.json();
    const req = log.request as {
      from_dashboard?: boolean;
      from_dashboard_user?: string;
      ip?: string;
    } | null;

    if (!req) {
      return { actorType: "stripe_system", actorId: null, actorName: null };
    }

    // Dashboard action — has the user's email
    if (req.from_dashboard && req.from_dashboard_user) {
      return {
        actorType: "stripe_dashboard",
        actorId: req.from_dashboard_user,
        actorName: req.from_dashboard_user,
      };
    }

    // API call (not from dashboard)
    return {
      actorType: "stripe_api",
      actorId: requestId,
      actorName: null,
    };
  } catch {
    // Non-blocking — don't fail the webhook over actor resolution
    return { actorType: "stripe_api", actorId: requestId, actorName: null };
  }
}
