import { createAction, option } from "@typebot.io/forge";
import { auth } from "../auth";

export const sendMessage = createAction({
  auth,
  name: "Send Message",
  turnableInto: undefined,
  options: option.object({
    widgetId: option.string.meta({
      layout: {
        label: "Widget ID",
        isRequired: true,
        placeholder: "Nurix chat widget ID",
      },
    }),
    userId: option.string.meta({
      layout: {
        label: "User ID",
        isRequired: true,
        placeholder: "Stable customer identifier",
        moreInfoTooltip:
          "Use the same stable identifier on every turn to reuse the Nurix conversation.",
      },
    }),
    message: option.string.meta({
      layout: {
        label: "Message",
        isRequired: true,
        placeholder: "How can I help?",
        inputType: "textarea",
      },
    }),
    idempotencyKey: option.string.meta({
      layout: {
        label: "Idempotency key",
        isRequired: true,
        placeholder: "Unique key for this logical message",
        moreInfoTooltip:
          "Store a stable key in a variable before this block and preserve it if the same message execution is retried.",
      },
    }),
    responseMapping: option
      .saveResponseArray(["Message", "Conversation ID", "Message ID"])
      .meta({
        layout: {
          accordion: "Save response",
        },
      }),
  }),
  getSetVariableIds: ({ responseMapping }) =>
    responseMapping?.flatMap((response) =>
      response.variableId ? [response.variableId] : [],
    ) ?? [],
});
