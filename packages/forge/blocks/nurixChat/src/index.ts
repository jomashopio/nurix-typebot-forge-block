import { createBlock } from "@typebot.io/forge";
import { sendMessage } from "./actions/sendMessage";
import { auth } from "./auth";
import { NurixChatLogo } from "./logo";

export const nurixChatBlock = createBlock({
  id: "nurix-chat",
  name: "Nurix Chat",
  tags: ["ai", "chat", "nurix"],
  LightLogo: NurixChatLogo,
  auth,
  actions: [sendMessage],
});
