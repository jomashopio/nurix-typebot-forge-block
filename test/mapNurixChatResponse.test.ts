import assert from "node:assert/strict";
import test from "node:test";
import { mapNurixChatResponse } from "../packages/forge/blocks/nurixChat/src/mapNurixChatResponse.js";

test("maps all supported response fields and ignores empty variable IDs", () => {
  assert.deepEqual(
    mapNurixChatResponse(
      {
        content: "Synthetic reply",
        conversationId: "conversation-1",
        conversationState: "completed",
        messageId: "message-1",
      },
      [
        { item: "Message", variableId: "reply-variable" },
        { item: "Conversation ID", variableId: "conversation-variable" },
        { item: "Message ID", variableId: "message-variable" },
        { item: "Conversation state", variableId: "state-variable" },
        { item: "Message" },
        { item: "Conversation State", variableId: "unknown-variable" },
      ],
    ),
    [
      { id: "reply-variable", value: "Synthetic reply" },
      { id: "conversation-variable", value: "conversation-1" },
      { id: "message-variable", value: "message-1" },
      { id: "state-variable", value: "completed" },
    ],
  );
});
