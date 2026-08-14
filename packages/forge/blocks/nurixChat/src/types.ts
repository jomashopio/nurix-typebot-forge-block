export type NurixChatResponse = Readonly<{
  content: string;
  conversationId: string;
  messageId: string;
}>;

export type NurixResponseMapping = Readonly<{
  item?: string;
  variableId?: string;
}>;

export type NurixVariableUpdate = Readonly<{
  id: string;
  value: string;
}>;

export type SendNurixChatMessageInput = Readonly<{
  dataApiKey: string;
  gatewayApiKey: string;
  idempotencyKey: string;
  message: string;
  userId: string;
  widgetId: string;
}>;

export type SendNurixChatMessageDependencies = Readonly<{
  endpoint?: string;
  fetcher?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  timeoutMs?: number;
}>;

export class NurixAdapterError extends Error {
  readonly code: string;
  readonly safeToRetry: boolean;

  constructor(code: string, message: string, safeToRetry: boolean) {
    super(message);
    this.name = "NurixAdapterError";
    this.code = code;
    this.safeToRetry = safeToRetry;
  }
}
