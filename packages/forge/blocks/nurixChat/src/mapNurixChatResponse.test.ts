import { describe, expect, it } from "bun:test";
import { mapNurixChatResponse } from "./mapNurixChatResponse";

describe("mapNurixChatResponse", () => {
  it("maps supported fields and ignores entries without a variable", () => {
    expect(
      mapNurixChatResponse(
        {
          content: "Synthetic reply",
          conversationId: "conversation-1",
          messageId: "message-1",
        },
        [
          { item: "Message", variableId: "reply-variable" },
          { item: "Conversation ID", variableId: "conversation-variable" },
          { item: "Message ID", variableId: "message-variable" },
          { item: "Message" },
        ],
      ),
    ).toEqual([
      { id: "reply-variable", value: "Synthetic reply" },
      { id: "conversation-variable", value: "conversation-1" },
      { id: "message-variable", value: "message-1" },
    ]);
  });
});
