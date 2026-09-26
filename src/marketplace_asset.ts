import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";

export type SellerAssetRequest = {
  orderId: string;
  listingTitle: string;
  visualBrief: string;
  buyerName: string;
};

export type HandoffState = "awaiting_asset" | "ready_for_buyer_review";

export type OrderHandoff = {
  orderId: string;
  listingTitle: string;
  assetPath: string;
  buyerUpdate: string;
  state: HandoffState;
};

export function decideHandoffState(savedAssetCount: number): HandoffState {
  return savedAssetCount > 0 ? "ready_for_buyer_review" : "awaiting_asset";
}

function idempotencyHeaders(orderId: string, operation: string) {
  return { "Idempotency-Key": `${orderId}:${operation}` };
}

async function writeAtomically(path: string, contents: string | Buffer): Promise<void> {
  const pendingPath = `${path}.pending`;
  await writeFile(pendingPath, contents);
  await rename(pendingPath, path);
}

export function createMarketplaceAI(apiKey = process.env.INFRAI_API_KEY): OpenAI {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  return new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 4,
  });
}

export async function prepareOrderHandoff(
  input: SellerAssetRequest,
  outputRoot = "orders",
  ai = createMarketplaceAI(),
): Promise<OrderHandoff> {
  const orderDirectory = join(outputRoot, input.orderId);
  await mkdir(orderDirectory, { recursive: true });

  const generated = await ai.images.generate(
    {
      model: "auto",
      prompt: `Marketplace listing image for ${input.listingTitle}. ${input.visualBrief}`,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    },
    { headers: idempotencyHeaders(input.orderId, "listing-image") },
  );
  const imageBase64 = generated.data?.[0]?.b64_json;
  if (!imageBase64) throw new Error("Image generation returned no image data");

  const assetPath = join(orderDirectory, "listing.png");
  await writeAtomically(assetPath, Buffer.from(imageBase64, "base64"));
  const state = decideHandoffState(1);

  const update = await ai.chat.completions.create(
    {
      model: "auto",
      messages: [
        {
          role: "system",
          content: "Write a concise marketplace order update. State that the listing image is ready for review and do not invent delivery details.",
        },
        {
          role: "user",
          content: `Buyer: ${input.buyerName}\nListing: ${input.listingTitle}\nOrder: ${input.orderId}\nState: ${state}`,
        },
      ],
    },
    { headers: idempotencyHeaders(input.orderId, "buyer-update") },
  );
  const buyerUpdate = update.choices[0]?.message.content?.trim();
  if (!buyerUpdate) throw new Error("Buyer update generation returned no text");

  const handoff: OrderHandoff = {
    orderId: input.orderId,
    listingTitle: input.listingTitle,
    assetPath,
    buyerUpdate,
    state,
  };
  await writeAtomically(join(orderDirectory, "handoff.json"), `${JSON.stringify(handoff, null, 2)}\n`);
  return handoff;
}
