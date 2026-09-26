import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { prepareOrderHandoff } from "./marketplace_asset.js";

const requestBody = z.object({
  orderId: z.string().regex(/^[a-zA-Z0-9_-]{3,64}$/),
  listingTitle: z.string().trim().min(3).max(120),
  visualBrief: z.string().trim().min(10).max(1000),
  buyerName: z.string().trim().min(1).max(80),
}).strict();

const app = express();
app.use(express.json({ limit: "32kb" }));

app.post("/orders/handoff", async (req, res) => {
  const parsed = requestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: z.treeifyError(parsed.error) });
    return;
  }

  try {
    const handoff = await prepareOrderHandoff(parsed.data);
    res.status(201).json(handoff);
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status < 500) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(502).json({ error: "The order handoff could not be completed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Order handoff service listening on http://localhost:${port}`));
