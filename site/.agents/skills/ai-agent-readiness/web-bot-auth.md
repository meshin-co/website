# Web Bot Auth

Web Bot Auth lets a site prove who it is when it sends requests. Every other item on this checklist is about agents arriving at your site; this one is about requests your site itself sends out, from a crawler, a fetcher, or an agent you run. Receiving sites read the signature and decide whether to trust the bot. It builds on HTTP Message Signatures (RFC 9421) and the IETF WebBotAuth working group drafts (https://datatracker.ietf.org/wg/webbotauth/about/). A site that runs no outbound crawler or agent has nothing to sign, which is why the scanner marks this item informational. The gain: your bot is verified instead of being guessed from its User-Agent string.

## Requirements

- Publish a JWKS (JSON Web Key Set) at `/.well-known/http-message-signatures-directory`. Respond `200`. Upstream draft media type: `application/http-message-signatures-directory+json`.
- The JWKS is a JSON object with a `keys` array. It MUST contain at least one public key for signature verification. Each entry is a JWK:
  - `kty`: key type, `OKP` for Ed25519, `RSA` for RSA.
  - `crv`: curve name, for example `Ed25519`. Used with `OKP`/`EC` keys. Ed25519 keys also carry the public value in `x`.
  - `n` and `e`: RSA modulus and exponent. Used instead of `crv` for `RSA` keys.
  - `kid`: key ID. Signed requests refer to it as `keyid`. Use the JWK thumbprint (RFC 7638).
  - `alg`: signature algorithm, for example `EdDSA` (draft examples use `ed25519`).
- Never publish the private key. Only the public half goes in the JWKS.
- Sign the requests your bot or agent sends, so receiving sites can verify them.
- Add two headers to each signed request:
  - `Signature-Agent`: where the verifier finds your directory, `https://example.com` for the example host.
  - `Signature-Input`: lists the signed components, such as `@authority` and `signature-agent`, plus parameters `created`, `expires`, `keyid` (the `kid`), `alg`, `nonce`, and `tag="web-bot-auth"`.
- Send the `Signature` header (RFC 9421) with the signature bytes. The verifier fetches your JWKS, looks up `keyid`, and checks the signature over the components named in `Signature-Input`.

Example directory:

```json
{ "keys": [{ "kty": "OKP", "crv": "Ed25519", "x": "{public-key}", "kid": "{thumbprint}", "alg": "EdDSA" }] }
```

## How to serve it on a static site

A static site can publish the directory but cannot sign anything. Put the JWKS in a file at `/.well-known/http-message-signatures-directory` in the public directory. On Cloudflare Pages, add a rule in the `_headers` file to set `Content-Type` for that path, because the file has no extension.

Signing happens in your outbound client: the crawler or agent process holds the private key and attaches the three headers on each request. On Cloudflare, Web Bot Auth has built-in support for verifying incoming bot signatures; check the dashboard for plan requirements.

## When not to publish it

Publish the directory only after an outbound bot or agent exists and signs requests with the matching private key. A JWKS with no signing client advertises an identity nothing uses. If you run no outbound bot, skip this item; the informational status is correct.

## Verify

```sh
curl -i https://example.com/.well-known/http-message-signatures-directory
```

Expect `200`, the JSON media type, and a `keys` array with at least one entry. Then run the scanner: `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. `checks.botAccessControl.webBotAuth.status` must read `"pass"`. A site publishing no directory reads `"neutral"`, not `"fail"`: the scanner treats this item as informational.
