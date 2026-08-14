import { createAuth, option } from "@typebot.io/forge";

export const auth = createAuth({
  type: "encryptedCredentials",
  name: "Nurix Chat account",
  schema: option.object({
    dataApiKey: option.string.meta({
      layout: {
        label: "Data API key",
        isRequired: true,
        helperText: "Enter the Data API key supplied by Nurix.",
        inputType: "password",
        withVariableButton: false,
        isDebounceDisabled: true,
      },
    }),
    gatewayApiKey: option.string.meta({
      layout: {
        label: "Gateway API key",
        isRequired: true,
        helperText: "Enter the Gateway API key supplied by Nurix.",
        inputType: "password",
        withVariableButton: false,
        isDebounceDisabled: true,
      },
    }),
  }),
});
