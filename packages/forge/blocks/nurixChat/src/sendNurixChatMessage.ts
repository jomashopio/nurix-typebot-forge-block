import {
  maxAdapterResponseBytes,
  nurixAdapterMessagesUrl,
  nurixAdapterRequestTimeoutMs,
} from "./constants";
import {
  NurixAdapterError,
  type NurixChatResponse,
  type SendNurixChatMessageDependencies,
  type SendNurixChatMessageInput,
} from "./types";

export const sendNurixChatMessage = async (
  input: SendNurixChatMessageInput,
  dependencies: SendNurixChatMessageDependencies = {},
): Promise<NurixChatResponse> => {
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    dependencies.timeoutMs ?? nurixAdapterRequestTimeoutMs,
  );

  try {
    const response = await (dependencies.fetcher ?? fetch)(
      dependencies.endpoint ?? nurixAdapterMessagesUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.dataApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
          "X-Nurix-Gateway-Api-Key": input.gatewayApiKey,
        },
        body: JSON.stringify({
          widgetId: input.widgetId,
          userId: input.userId,
          message: input.message,
        }),
        redirect: "error",
        signal: abortController.signal,
      },
    );
    const payload = await readJsonResponse(response);

    if (!response.ok) throw parseErrorResponse(response.status, payload);
    return parseSuccessResponse(payload);
  } catch (error) {
    if (error instanceof NurixAdapterError) throw error;
    throw new NurixAdapterError(
      "NURIX_UNAVAILABLE",
      "The Nurix Chat service is temporarily unavailable.",
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
};

const readJsonResponse = async (response: Response): Promise<unknown> => {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxAdapterResponseBytes)
    throw protocolError();

  if (!response.body) throw protocolError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    totalBytes += result.value.byteLength;
    if (totalBytes > maxAdapterResponseBytes) {
      await reader.cancel();
      throw protocolError();
    }
    chunks.push(result.value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const payload: unknown = JSON.parse(new TextDecoder().decode(body));
    return payload;
  } catch {
    throw protocolError();
  }
};

const parseSuccessResponse = (payload: unknown): NurixChatResponse => {
  const content = readString(payload, "content", true, 10_000);
  const conversationId = readString(payload, "conversationId", false, 512);
  const messageId = readString(payload, "messageId", false, 512);
  if (
    content === undefined ||
    conversationId === undefined ||
    messageId === undefined
  )
    throw protocolError();
  return Object.freeze({ content, conversationId, messageId });
};

const parseErrorResponse = (status: number, payload: unknown) => {
  const error = readObject(payload, "error");
  const code = readString(error, "code", false, 128);
  const safeToRetry = readBoolean(error, "safeToRetry");

  if (code && safeToRetry !== undefined)
    return new NurixAdapterError(
      code,
      safeToRetry
        ? `Nurix Chat request failed (${code}) and can be retried with the same idempotency key.`
        : `Nurix Chat request failed (${code}) and must not be retried automatically.`,
      safeToRetry,
    );

  return new NurixAdapterError(
    "NURIX_UNAVAILABLE",
    `The Nurix Chat service returned HTTP ${status}.`,
    status === 408 || status === 425 || status === 429 || status >= 500,
  );
};

const readObject = (value: unknown, key: string): object | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const field = Reflect.get(value, key);
  return typeof field === "object" && field !== null ? field : undefined;
};

const readString = (
  value: unknown,
  key: string,
  allowEmpty: boolean,
  maxLength: number,
): string | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const field = Reflect.get(value, key);
  if (typeof field !== "string" || field.length > maxLength) return undefined;
  if (!allowEmpty && !field.trim()) return undefined;
  return field;
};

const readBoolean = (value: unknown, key: string): boolean | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const field = Reflect.get(value, key);
  return typeof field === "boolean" ? field : undefined;
};

const protocolError = () =>
  new NurixAdapterError(
    "NURIX_PROTOCOL_ERROR",
    "The Nurix Chat service returned an invalid response.",
    false,
  );
