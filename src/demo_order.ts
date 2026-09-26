import { prepareOrderHandoff } from "./marketplace_asset.js";

const handoff = await prepareOrderHandoff({
  orderId: "order-demo-1042",
  listingTitle: "Hand-thrown ceramic pour-over set",
  visualBrief: "Warm daylight, honest glaze texture, neutral tabletop, square catalog composition, no text or logos.",
  buyerName: "Mina",
});

console.log(JSON.stringify(handoff, null, 2));
