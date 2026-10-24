# DNS for AI Discovery (DNS-AID)

DNS-AID publishes your agent endpoints as DNS records so agents can find them without fetching a web page. Agents and discovery tools query DNS for names under your domain's `_agents` namespace and read connection details from SVCB or HTTPS records (RFC 9460). DNS-AID itself is an IETF Internet-Draft, so field details may change; check the draft before shipping. The gain: an agent that knows only `example.com` can locate your A2A or index endpoint, and DNSSEC lets it trust the answer.

## Requirements

- Publish records under the `_agents` namespace of your domain. Owner names look like `_index._agents.example.com` or `_a2a._agents.example.com`: `_{service}._agents.{domain}`.
- Use ServiceMode `SVCB` records, or `HTTPS` records for HTTPS endpoints. Each record carries `alpn` and endpoint connection parameters.
- Use numeric `keyNNNNN` SvcParamKey names for experimental DNS-AID custom parameters until they are registered. RFC 9460 reserves `key65280` to `key65534` for private use.
- Sign public DNS-AID discovery zones with DNSSEC so validating resolvers return authenticated data.

Example record:

```
_a2a._agents.example.com. 3600 IN SVCB 1 agent.example.com. alpn="a2a" port=443 mandatory=alpn,port
```

Field by field:

- `_a2a._agents.example.com.`: owner name. `_a2a` is the service label, `_agents` the namespace.
- `3600`: TTL in seconds. Resolvers cache the answer for one hour.
- `IN SVCB`: class and record type. Use `HTTPS` for plain HTTPS endpoints.
- `1`: SvcPriority. Any value above 0 means ServiceMode: the record describes an endpoint. `0` would mean AliasMode, which is not used here.
- `agent.example.com.`: TargetName, the host that serves the endpoint. A `.` means the owner name itself.
- `alpn="a2a"`: application protocol identifier clients use to talk to that endpoint.
- `port=443`: TCP/UDP port of the endpoint.
- `mandatory=alpn,port`: keys a client MUST understand. A client that does not support one of them must skip this record.

DNSSEC must be enabled on the zone. Without it, a validating resolver cannot mark the answer authenticated, and an attacker on the path can forge the endpoint.

## How to serve it on a static site

A static site cannot do this. DNS records live at your DNS provider, not in the site files. Add the SVCB or HTTPS record in the provider's dashboard or API. On Cloudflare DNS, add the record in the zone, then turn on DNSSEC for the zone and copy the DS record to your registrar. The target host must exist and serve the protocol named in `alpn`.

## When not to publish it

Publish only when a real agent endpoint exists at the target host and answers the protocol in `alpn`. A record pointing at nothing sends agents to a dead or wrong service. Enable DNSSEC first; an unsigned discovery zone invites spoofing.

## Verify

```sh
dig +dnssec SVCB _a2a._agents.example.com
curl -s -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=_a2a._agents.example.com&type=SVCB'
```

Expect your record in the answer and `"AD": true` in the JSON, which means the resolver authenticated it. The scanner queries DNS-over-HTTPS at `https://cloudflare-dns.com/dns-query` and falls back to `https://dns.google/resolve`. Run `POST https://isitagentready.com/api/scan` with `{"url": "https://example.com"}`. `checks.discoverability.dnsAid.status` must read `"pass"`.
