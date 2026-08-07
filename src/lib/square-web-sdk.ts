// Square's Web Payments SDK has no npm auto-loader (unlike Stripe's
// loadStripe) — it's a CDN <script> tag that attaches `window.Square`.
declare global {
  interface Window {
    Square?: {
      payments: (
        applicationId: string,
        locationId: string
      ) => {
        card: () => Promise<SquarePaymentMethod>;
        applePay: (paymentRequest: unknown) => Promise<SquarePaymentMethod>;
        googlePay: (paymentRequest: unknown) => Promise<SquarePaymentMethod>;
        paymentRequest: (options: {
          countryCode: string;
          currencyCode: string;
          total: { amount: string; label: string };
        }) => unknown;
      };
    };
  }
}

export type SquareTokenizeResult = {
  status: string;
  token?: string;
  errors?: { message: string }[];
};

export type SquarePaymentMethod = {
  attach: (selector: string) => Promise<void>;
  destroy: () => Promise<void>;
  tokenize: () => Promise<SquareTokenizeResult>;
};

let sdkPromise: Promise<NonNullable<Window["Square"]>> | null = null;

export function loadSquareSdk(): Promise<NonNullable<Window["Square"]>> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (window.Square) {
      resolve(window.Square);
      return;
    }
    const src =
      process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production"
        ? "https://web.squarecdn.com/v1/square.js"
        : "https://sandbox.web.squarecdn.com/v1/square.js";
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      if (window.Square) resolve(window.Square);
      else reject(new Error("Square Web Payments SDK loaded but window.Square is missing"));
    };
    script.onerror = () => reject(new Error("Failed to load Square Web Payments SDK"));
    document.head.appendChild(script);
  });

  return sdkPromise;
}
