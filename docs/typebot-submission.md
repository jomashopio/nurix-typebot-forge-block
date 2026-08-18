# Typebot submission checklist

1. Open and obtain agreement on a Typebot GitHub issue before submitting code.
2. Confirm the fixed adapter URL is
   `https://nurix-typebot-adapter-2eazj.ondigitalocean.app/v1/messages`.
3. Confirm the Nurix logo and contribution license are approved.
4. Run `node scripts/sync-to-typebot.mjs <typebot-checkout>` from this repository.
5. In the Typebot checkout, run:

```sh
bun install
bunx nx sync
bunx nx test @typebot.io/nurix-chat-block
bunx nx typecheck @typebot.io/nurix-chat-block
bunx nx typecheck @typebot.io/forge-repository
bunx nx affected -t generate-openapi
bunx nx format-and-lint
```

6. Review the generated `bun.lock`, TypeScript references, OpenAPI artifact, and
   Docker build-context changes. Those generated files belong in the Typebot PR,
   not this canonical source repository.
7. Confirm the final diff contains no live credentials, deployment secrets, raw
   response fixtures, or WebSocket implementation.
8. Open the pull request from a fork of `baptisteArno/typebot.io` and link the agreed
   specification issue, adapter contract, and hosted E2E evidence.

The synchronization script fails when required upstream anchors are missing. This
is intentional: upstream changes must be reviewed instead of guessed around.
