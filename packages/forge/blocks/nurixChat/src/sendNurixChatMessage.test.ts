import { describe, expect, it } from "bun:test";
import { sendNurixChatMessage } from "./sendNurixChatMessage";
import { NurixAdapterError } from "./types";

const input = Object.freeze({
  dataApiKey: "data-key-sentinel",
  gatewayApiKey: "gateway-key-sentinel",
  idempotencyKey: "logical-message-123",
  message: "Synthetic test message",
  userId: "synthetic-user",
  widgetId: "173",
});

describe("sendNurixChatMessage", () => {
  it("sends the exact request once without the private gateway header", async () => {
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
        conversationState: "completed",
        messageId: "message-1",
      });
    };

    await expect(sendNurixChatMessage(input, { fetcher })).resolves.toEqual({
      content: "Synthetic reply",
      conversationId: "conversation-1",
      conversationState: "completed",
      messageId: "message-1",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(
      "https://nurix-typebot-adapter-2eazj.ondigitalocean.app/v1/messages",
    );
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.redirect).toBe("error");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${input.dataApiKey}`);
    expect(headers.get("X-Nurix-Gateway-Api-Key")).toBe(input.gatewayApiKey);
    expect(headers.get("Idempotency-Key")).toBe(input.idempotencyKey);
    expect(headers.has("X-Adapter-Gateway-Secret")).toBe(false);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      widgetId: input.widgetId,
      userId: input.userId,
      message: input.message,
    });
  });

  it("defaults an absent conversation state to active", async () => {
    const fetcher = async () =>
      jsonResponse({
        content: "Synthetic reply",
        conversationId: "conversation-1",
        messageId: "message-1",
      });

    await expect(sendNurixChatMessage(input, { fetcher })).resolves.toEqual({
      content: "Synthetic reply",
      conversationId: "conversation-1",
      conversationState: "active",
      messageId: "message-1",
    });
  });

  it("rejects a malformed present conversation state", async () => {
    for (const conversationState of [
      "",
      "Completed",
      " active",
      "active.now",
      "a".repeat(65),
      1,
      null,
    ]) {
      const error = await captureError(
        sendNurixChatMessage(input, {
          fetcher: async () =>
            jsonResponse({
              content: "Synthetic reply",
              conversationId: "conversation-1",
              conversationState,
              messageId: "message-1",
            }),
        }),
      );
      expect(error.code).toBe("NURIX_PROTOCOL_ERROR");
    }
  });

  it("does not retry or expose credentials after a network failure", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      throw new Error(
        `${input.dataApiKey}:${input.gatewayApiKey}:${input.message}`,
      );
    };

    const error = await captureError(sendNurixChatMessage(input, { fetcher }));
    expect(error.code).toBe("NURIX_UNAVAILABLE");
    expect(error.safeToRetry).toBe(true);
    expect(error.message).not.toMatch(
      /data-key-sentinel|gateway-key-sentinel|Synthetic/,
    );
    expect(calls).toBe(1);
  });

  it("preserves delivery-unknown semantics without exposing the raw body", async () => {
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

    const error = await captureError(sendNurixChatMessage(input, { fetcher }));
    expect(error.code).toBe("NURIX_DELIVERY_UNKNOWN");
    expect(error.safeToRetry).toBe(false);
    expect(error.message).toMatch(/must not be retried automatically/);
    expect(error.message).not.toMatch(
      /data-key-sentinel|gateway-key-sentinel|raw-upstream/,
    );
  });

  it("rejects malformed and oversized responses", async () => {
    expect(
      (
        await captureError(
          sendNurixChatMessage(input, {
            fetcher: async () => jsonResponse({ content: "Missing IDs" }),
          }),
        )
      ).code,
    ).toBe("NURIX_PROTOCOL_ERROR");

    expect(
      (
        await captureError(
          sendNurixChatMessage(input, {
            fetcher: async () =>
              new Response("x".repeat(65_537), {
                headers: { "Content-Length": "65537" },
              }),
          }),
        )
      ).code,
    ).toBe("NURIX_PROTOCOL_ERROR");
  });
});

const captureError = async (operation: Promise<unknown>) => {
  try {
    await operation;
  } catch (error) {
    if (error instanceof NurixAdapterError) return error;
    throw error;
  }
  throw new Error("Expected the Nurix adapter operation to fail.");
};

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
