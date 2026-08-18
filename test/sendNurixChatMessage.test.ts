import assert from "node:assert/strict";
import test from "node:test";
import { sendNurixChatMessage } from "../packages/forge/blocks/nurixChat/src/sendNurixChatMessage.js";
import { NurixAdapterError } from "../packages/forge/blocks/nurixChat/src/types.js";

const input = Object.freeze({
  dataApiKey: "data-key-sentinel",
  gatewayApiKey: "gateway-key-sentinel",
  idempotencyKey: "logical-message-123",
  message: "Synthetic test message",
  userId: "synthetic-user",
  widgetId: "173",
});

test("sends the exact adapter request once without the private gateway header", async () => {
  const calls: Array<{ input: string | URL | Request; init?: RequestInit }> =
    [];
  const fetcher = async (
    requestInput: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ input: requestInput, init });
    return jsonResponse({
      content: "Synthetic reply",
      conversationId: "conversation-1",
      messageId: "message-1",
    });
  };

  const response = await sendNurixChatMessage(input, { fetcher });

  assert.deepEqual(response, {
    content: "Synthetic reply",
    conversationId: "conversation-1",
    messageId: "message-1",
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.input,
    "https://nurix-typebot-adapter-2eazj.ondigitalocean.app/v1/messages",
  );
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.redirect, "error");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("Authorization"), `Bearer ${input.dataApiKey}`);
  assert.equal(headers.get("X-Nurix-Gateway-Api-Key"), input.gatewayApiKey);
  assert.equal(headers.get("Idempotency-Key"), input.idempotencyKey);
  assert.equal(headers.has("X-Adapter-Gateway-Secret"), false);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    widgetId: input.widgetId,
    userId: input.userId,
    message: input.message,
  });
});

test("does not retry and does not expose credentials from a network failure", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    throw new Error(
      `${input.dataApiKey}:${input.gatewayApiKey}:${input.message}`,
    );
  };

  await assert.rejects(sendNurixChatMessage(input, { fetcher }), (error) => {
    assert.ok(error instanceof NurixAdapterError);
    assert.equal(error.code, "NURIX_UNAVAILABLE");
    assert.equal(error.safeToRetry, true);
    assert.doesNotMatch(
      error.message,
      /data-key-sentinel|gateway-key-sentinel|Synthetic/,
    );
    return true;
  });
  assert.equal(calls, 1);
});

test("preserves a structured adapter error without exposing its raw body", async () => {
  const fetcher = async () =>
    jsonResponse(
      {
        error: {
          code: "NURIX_DELIVERY_UNKNOWN",
          message: `${input.dataApiKey}:${input.gatewayApiKey}:raw-upstream-details`,
          safeToRetry: false,
          requestId: "request-1",
        },
      },
      504,
    );

  await assert.rejects(sendNurixChatMessage(input, { fetcher }), (error) => {
    assert.ok(error instanceof NurixAdapterError);
    assert.equal(error.code, "NURIX_DELIVERY_UNKNOWN");
    assert.equal(error.safeToRetry, false);
    assert.match(error.message, /must not be retried automatically/);
    assert.doesNotMatch(
      error.message,
      /data-key-sentinel|gateway-key-sentinel|raw-upstream/,
    );
    return true;
  });
});

test("rejects malformed and oversized success bodies", async () => {
  await assert.rejects(
    sendNurixChatMessage(input, {
      fetcher: async () => jsonResponse({ content: "Missing IDs" }),
    }),
    (error) =>
      error instanceof NurixAdapterError &&
      error.code === "NURIX_PROTOCOL_ERROR",
  );

  await assert.rejects(
    sendNurixChatMessage(input, {
      fetcher: async () =>
        new Response("x".repeat(65_537), {
          headers: { "Content-Length": "65537" },
        }),
    }),
    (error) =>
      error instanceof NurixAdapterError &&
      error.code === "NURIX_PROTOCOL_ERROR",
  );
});

test("aborts one timed-out request without replaying it", async () => {
  let calls = 0;
  const fetcher = async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls += 1;
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        {
          once: true,
        },
      );
    });
  };

  await assert.rejects(
    sendNurixChatMessage(input, { fetcher, timeoutMs: 1 }),
    (error) =>
      error instanceof NurixAdapterError && error.code === "NURIX_UNAVAILABLE",
  );
  assert.equal(calls, 1);
});

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
