import type {
  NurixChatResponse,
  NurixResponseMapping,
  NurixVariableUpdate,
} from "./types";

export const mapNurixChatResponse = (
  response: NurixChatResponse,
  mappings: readonly NurixResponseMapping[] | undefined,
): NurixVariableUpdate[] =>
  mappings?.flatMap((mapping) => {
    if (!mapping.variableId) return [];
    if (mapping.item === "Conversation ID")
      return [{ id: mapping.variableId, value: response.conversationId }];
    if (mapping.item === "Message ID")
      return [{ id: mapping.variableId, value: response.messageId }];
    return [{ id: mapping.variableId, value: response.content }];
  }) ?? [];
