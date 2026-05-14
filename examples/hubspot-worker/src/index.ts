import { Worker, j } from "@notionhq/workers";

const worker = new Worker({ name: "hubspot-worker-example" });

worker.tool("listDeals", {
  title: "List Deals",
  description: "Fetches recent HubSpot deals.",
  schema: j.object({
    limit: j.number().optional().describe("Maximum number of deals to return"),
  }),
  execute: async ({ limit }, { secrets }) => {
    const query = new URLSearchParams();
    if (limit !== undefined) {
      query.set("limit", String(limit));
    }

    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${secrets.HUBSPOT_API_KEY}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HubSpot request failed: ${response.status}`);
    }

    return response.json();
  },
});

export default worker;
