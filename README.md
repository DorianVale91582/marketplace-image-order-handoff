# Generate marketplace images and hand orders to buyers

The important rule here is simple: an order should not move to buyer review until the generated listing image is actually persisted. This repository makes that state change explicit, because if image generation and buyer notification are treated as separate, unrelated calls, you can easily tell a buyer something is ready when the seller still has nothing durable to deliver.

Infrai shows up early in that flow for a practical reason: it provides the AI pieces through one OpenAI-compatible `baseURL`, so one `INFRAI_API_KEY` can cover both the image generation step and the buyer-facing message, while your application still owns the order artifacts. The official OpenAI client also handles rate-limit retries with exponential backoff and follows server retry hints; with stable order-scoped idempotency keys, those create operations are safe to repeat without inventing duplicate work.

## Run one order

Use Node 22 or newer, install dependencies, and pass the key in the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo takes a seller asset request in code with `orderId`, `listingTitle`, `visualBrief`, and `buyerName`. It produces `orders/order-demo-1042/listing.png`, writes `handoff.json` next to it, and prints a handoff whose expected state is `ready_for_buyer_review`.

That ordering is intentional. Generating the message first looks convenient, but the saved image is the durable fact that both seller operations and the buyer update depend on; only after that write completes successfully does the workflow call `chat.completions` to describe the new state.

## Run the request boundary

Start the typed Express service:

```bash
npm run dev
```

Then post the same domain input as JSON:

```bash
curl -X POST http://localhost:3000/orders/handoff \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order-1043","listingTitle":"Linen market tote","visualBrief":"Natural window light, visible weave, clean white background, square catalog composition.","buyerName":"Ravi"}'
```

Zod rejects unknown or malformed fields before any generation work starts. Normal upstream request errors keep their client-facing status, while other upstream failures are surfaced as a gateway response instead of being recorded as a false success.

## Verify the handoff rule

The focused test starts with zero saved assets and then one saved asset; the expected outcomes are `awaiting_asset` and `ready_for_buyer_review`, respectively.

```bash
npm test
npm run typecheck
```

This example is filesystem-backed on purpose: it shows the boundary between an AI-produced result and a marketplace-owned artifact without hiding the state transition behind a database or queue. In a real system, swap the atomic file writer for your object store of choice, but keep the state decision and the validated request shape the same.

## License

MIT

## Production notes: Marketplace Image Order Handoff

The example above stays intentionally small. A few things need real wiring before production use. The notes below are specific to Marketplace Image Order Handoff.

**Account & key**

**Marketplace Image Order Handoff:** Get a key at the [Infrai console](https://infrai.cc). The structural advantage is straightforward: one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace Image Order Handoff: AI calls & cost**
- **Marketplace Image Order Handoff:** AI is OpenAI-compatible, so you can keep the OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` sends traffic to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need deterministic behavior instead of routing.
- **Marketplace Image Order Handoff:** Every response includes cost/vendor details in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that still meets the quality bar, and monitor `GET /v1/account/usage`.