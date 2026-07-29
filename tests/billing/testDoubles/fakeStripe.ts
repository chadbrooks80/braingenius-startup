type FakeStripeEvent = {
  type: string;
  data: { object: { id: string } };
};

let event: FakeStripeEvent = {
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1234567890" } },
};

export const PRICE_ENV_BY_PLAN = {
  MONTHLY: "price_monthly",
  LIFETIME: "price_lifetime",
};

export function __setStripeEvent(nextEvent: FakeStripeEvent): void {
  event = nextEvent;
}

export function getStripe() {
  return {
    webhooks: {
      constructEvent(_body: string, signature: string, secret: string) {
        if (signature !== "valid-signature" || secret !== "test-webhook-secret") {
          throw new Error("invalid signature");
        }
        return event;
      },
    },
  };
}
