import { loadStripe } from "@stripe/stripe-js";

// Singleton — loadStripe should only be called once per page load.
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
