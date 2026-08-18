import { describe, expect, it } from "bun:test";
import { mapNurixChatResponse } from "./mapNurixChatResponse";

describe("mapNurixChatResponse", () => {
  it("maps supported fields and ignores entries without a variable", () => {
    expect(
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
    ).toEqual([
      { id: "reply-variable", value: "Synthetic reply" },
      { id: "conversation-variable", value: "conversation-1" },
      { id: "message-variable", value: "message-1" },
      { id: "state-variable", value: "completed" },
    ]);
  });
});
