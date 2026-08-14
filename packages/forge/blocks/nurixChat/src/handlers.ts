import { createActionHandler } from "@typebot.io/forge";
import { sendMessage } from "./actions/sendMessage";
import { mapNurixChatResponse } from "./mapNurixChatResponse";
import { sendNurixChatMessage } from "./sendNurixChatMessage";
import { NurixAdapterError } from "./types";

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export default [
  createActionHandler(sendMessage, {
    server: async ({
      credentials: { dataApiKey, gatewayApiKey },
      options: { idempotencyKey, message, responseMapping, userId, widgetId },
      variables,
      logs,
    }) => {
      if (!dataApiKey?.trim())
        return logs.add("Nurix Data API key is required.");
      if (!gatewayApiKey?.trim())
        return logs.add("Nurix Gateway API key is required.");
      if (!widgetId?.trim())
        return logs.add("Nurix Chat widget ID is required.");
      if (!userId?.trim()) return logs.add("Nurix Chat user ID is required.");
      if (!message?.trim()) return logs.add("Nurix Chat message is required.");
      if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey))
        return logs.add(
          "Nurix Chat idempotency key must contain 8–128 letters, numbers, periods, underscores, colons, or hyphens.",
        );

      try {
        const response = await sendNurixChatMessage({
          dataApiKey,
          gatewayApiKey,
          idempotencyKey,
          widgetId,
          userId,
          message,
        });
        const variableUpdates = mapNurixChatResponse(response, responseMapping);
        if (variableUpdates.length > 0) variables.set(variableUpdates);
      } catch (error) {
        logs.add({
          status: "error",
          context: "While sending message to Nurix Chat",
          description:
            error instanceof NurixAdapterError
              ? error.message
              : "The Nurix Chat service is temporarily unavailable.",
        });
      }
    },
  }),
];
