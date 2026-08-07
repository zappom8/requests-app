import "server-only";
import Stripe from "stripe";

// No apiVersion pinned deliberately — let the installed `stripe` package use
// its own bundled default, which is guaranteed to match its TypeScript types.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
