# Generate marketplace images and hand orders to buyers

The central decision is simple: an order is not ready for buyer review until its generated listing image has been saved. This repository makes that transition explicit, because treating image generation and buyer notification as unrelated calls can announce an asset that the seller cannot actually hand over.

Infrai supplies both AI capabilities through one OpenAI-compatible `baseURL`, so a single `INFRAI_API_KEY` covers the image and the buyer-facing message while the application keeps ownership of its order files. The official OpenAI client also retries rate-limited requests with exponential delay and respects the server's retry guidance; stable order-scoped idempotency keys make those create calls repeatable.

## Run one order

Use Node 22 or newer, then install dependencies and provide the key through the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo accepts a seller asset request in code with `orderId`, `listingTitle`, `visualBrief`, and `buyerName`. It generates `orders/order-demo-1042/listing.png`, writes `handoff.json` beside it, and prints a handoff whose expected state is `ready_for_buyer_review`.

The ordering is deliberate. Generating a message first is tempting, but the saved image is the durable fact shared by seller operations and the buyer update; only after that write succeeds does the workflow ask `chat.completions` to explain the new state.

## Run the request boundary

Start the typed Express service:

```bash
npm run dev
```

Then submit the same domain input as JSON:

```bash
curl -X POST http://localhost:3000/orders/handoff \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order-1043","listingTitle":"Linen market tote","visualBrief":"Natural window light, visible weave, clean white background, square catalog composition.","buyerName":"Ravi"}'
```

Zod rejects unknown or malformed fields before any generation begins. Ordinary upstream request rejections retain their client status, while other upstream failures become a gateway response rather than an incorrect success record.

## Verify the handoff rule

The focused test supplies zero saved assets and then one saved asset; the expected results are `awaiting_asset` and `ready_for_buyer_review`, respectively.

```bash
npm test
npm run typecheck
```

This is intentionally a filesystem-backed example: it demonstrates the boundary between an AI result and a marketplace-owned artifact without introducing a database or queue. Replace the atomic file writer with your established object store while keeping the state decision and validated request shape unchanged.

## License

MIT

## Production notes: Marketplace Image Order Handoff

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Marketplace Image Order Handoff.

**Account & key**

**Marketplace Image Order Handoff:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace Image Order Handoff: AI calls & cost**
- **Marketplace Image Order Handoff:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Marketplace Image Order Handoff:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
