import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentPositions } from "./polymarket-utils";

const account = "0x1111111111111111111111111111111111111111";

test("getCurrentPositions requests the Data API for the supplied funder", async () => {
  let requestedUrl = "";
  const positions = await getCurrentPositions(account, async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify([
        {
          asset: "123",
          conditionId: "condition-1",
          title: "Example market",
          size: "4.5",
          avgPrice: "0.42",
        },
      ]),
      { status: 200 },
    );
  });

  assert.match(requestedUrl, /data-api\.polymarket\.com\/positions/);
  assert.match(requestedUrl, /user=0x1111111111111111111111111111111111111111/);
  assert.deepEqual(positions, [
    {
      asset: "123",
      conditionId: "condition-1",
      title: "Example market",
      size: 4.5,
      avgPrice: 0.42,
    },
  ]);
});

test("getCurrentPositions fails closed for an invalid address or upstream error", async () => {
  let called = false;
  const invalid = await getCurrentPositions("not-an-address", async () => {
    called = true;
    return new Response("[]", { status: 200 });
  });
  assert.equal(invalid, null);
  assert.equal(called, false);

  const failed = await getCurrentPositions(account, async () => new Response("", { status: 503 }));
  assert.equal(failed, null);
});
