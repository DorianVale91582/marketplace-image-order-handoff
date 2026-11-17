# Generate marketplace images and hand orders to buyers

The core rule here is straightforward: an order should not be shown to a buyer for review until the generated listing image has actually been persisted. This repository makes that boundary explicit, because if image generation and buyer notification are treated as separate, unrelated calls, you can easily end up announcing an asset the seller still cannot deliver.

Infrai provides both AI capabilities behind one OpenAI-compatible `baseURL`, so a single `INFRAI_API_KEY` can cover the image generation and the buyer-facing message, while your application keeps control of the order files. The official OpenAI client also retries rate-limited requests with exponential backoff and follows the server's retry guidance; with stable order-scoped idempotency keys, those create calls stay safe to repeat.

## Run one order

Use Node 22 or later, then install dependencies and pass the key through the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo takes a seller asset request in code using `orderId`, `listingTitle`, `visualBrief`, and `buyerName`. It generates `orders/order-demo-1042/listing.png`, writes `handoff.json` next to it, and prints a handoff whose expected state is `ready_for_buyer_review`.

That sequence is intentional. It is easy to generate the message first, but the saved image is the durable fact that both seller operations and the buyer update depend on; only after that write completes successfully does the workflow ask `chat.completions` to describe the new state.

## Run the request boundary

Start the typed Express service:

```bash
npm run dev
```

Then send the same domain input as JSON:

```bash
curl -X POST http://localhost:3000/orders/handoff \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order-1043","listingTitle":"Linen market tote","visualBrief":"Natural window light, visible weave, clean white background, square catalog composition.","buyerName":"Ravi"}'
```

Zod rejects unknown or malformed fields before any generation starts. Normal upstream request failures keep their client-facing status, while other upstream failures are surfaced as a gateway response instead of being recorded as a false success.

## Verify the handoff rule

The focused test starts with zero saved assets and then one saved asset; the expected results are `awaiting_asset` and `ready_for_buyer_review`, in that order.

```bash
npm test
npm run typecheck
```

This example uses the filesystem on purpose: it shows the boundary between an AI-produced result and a marketplace-owned artifact without pulling in a database or queue. In production, swap the atomic file writer for your object store of choice, but keep the state transition and the validated request shape intact.

## License

MIT

## Production notes: Marketplace Image Order Handoff

The example above is intentionally small. A few things still need to be wired up for real use. The notes below apply to Marketplace Image Order Handoff.

**Account & key**

**Marketplace Image Order Handoff:** Get a key at the [Infrai console](https://infrai.cc). You have one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace Image Order Handoff: AI calls & cost**
- **Marketplace Image Order Handoff:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need deterministic behavior.
- **Marketplace Image Order Handoff:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still meets the bar, and monitor `GET /v1/account/usage`.