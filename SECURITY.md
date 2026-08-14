# Security

Report suspected vulnerabilities privately to the repository maintainers. Do not
open a public issue containing credentials, customer messages, adapter URLs with
query strings, raw HTTP bodies, or Nurix WebSocket frames.

No live Nurix credentials are required by this repository's test suite. The Data
API key and Gateway API key must remain encrypted Typebot credentials. The block
must never know or send the adapter deployment's private
`X-Adapter-Gateway-Secret`.
