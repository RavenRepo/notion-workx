import { Worker, j } from "@notionhq/workers";

const worker = new Worker({ name: "stripe-worker-example" });

worker.tool("getCustomer", {
  title: "Retrieve A Customer",
  description: "Fetch a Stripe customer by ID.",
  schema: j.object({
    id: j.string().describe("Stripe customer ID"),
  }),
  execute: async ({ id }, { secrets }) => {
    const response = await fetch(`https://api.stripe.com/v1/customers/${id}`, {
      headers: {
        Authorization: `Bearer ${secrets.STRIPE_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Stripe request failed: ${response.status}`);
    }

    return response.json();
  },
});

export default worker;
