# Adapter messages contract

The authoritative machine-readable contract is
[`openapi.yaml`](https://github.com/jomashopio/nurix-typebot-adapter/blob/codex/add-nurix-adapter/openapi.yaml).

The Forge block uses only:

```http
POST /v1/messages
Authorization: Bearer <Nurix Data API key>
X-Nurix-Gateway-Api-Key: <Nurix Gateway API key>
Idempotency-Key: <stable logical-message key>
Content-Type: application/json
```

```json
{
  "widgetId": "widget-id",
  "userId": "stable-user-id",
  "message": "Hello"
}
```

Success is `{ "content", "conversationId", "messageId" }`. Errors use the
adapter's sanitized `{ "error": { "code", "message", "safeToRetry", "requestId" } }`
envelope. The block performs no automatic retry, regardless of status or error code.
