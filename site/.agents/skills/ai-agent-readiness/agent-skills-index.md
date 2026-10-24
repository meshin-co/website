An Agent Skills discovery index is a JSON file that lists the skills a site offers to outside agents, each with a URL and a content hash. Agents read it to find a procedure, download it, and check it was not altered. It is defined by the [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc) v0.2.0. On a content site it is good for one thing: publishing procedures an outside agent can actually run on behalf of a reader, such as "find the article that answers a question" or "cite this site correctly".

## Requirements

- Serve JSON at `/.well-known/agent-skills/index.json` with HTTP 200 and `Content-Type: application/json`.
- `$schema`: MUST be `https://schemas.agentskills.io/discovery/0.2.0/schema.json`.
- `skills`: array. Every entry has all five fields:
  - `name`: skill identifier. Lowercase letters, digits and hyphens only.
  - `type`: `"skill-md"` or `"archive"`.
  - `description`: one short sentence on what the skill does.
  - `url`: URL of the skill artifact (absolute, or a path on the same origin).
  - `digest`: `sha256:` followed by the lowercase hex SHA-256 of the artifact bytes (64 hex characters).
- `skill-md`: the `url` points at a single `SKILL.md` file. Use it when the skill is one document.
- `archive`: the `url` points at a bundle (for example a `.tar.gz` or `.zip`) holding `SKILL.md` plus scripts or reference files. Use it when the skill needs more than one file.

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "find-article",
      "type": "skill-md",
      "description": "Finds the article on example.com that answers a question.",
      "url": "https://example.com/.well-known/agent-skills/find-article/SKILL.md",
      "digest": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    }
  ]
}
```

The digest above is the hash of the 4 bytes `test`. Yours is the hash of your artifact.

## How to serve it on a static site

A static site can do all of it. Put `index.json` and each artifact in the public directory under `.well-known/agent-skills/`. On Cloudflare Pages no paid plan is needed. Set `Content-Type: application/json` for the index if the host does not infer it.

Compute the digest of the exact bytes the server returns:

```sh
echo "sha256:$(shasum -a 256 find-article/SKILL.md | cut -d' ' -f1)"
echo "sha256:$(sha256sum find-article/SKILL.md | cut -d' ' -f1)"
```

Use `shasum -a 256` on macOS and `sha256sum` on Linux. Both print lowercase hex. Regenerate the digest whenever the artifact changes, even by one byte or a line ending. It is a build-time output: write a build step that hashes each artifact and writes `index.json`. NEVER type a digest by hand.

## When not to publish it

Publish a skill only when an outside agent can run it. Do not republish a repository's internal build procedures (deploy steps, gate commands, contributor workflows) as public skills: they describe a workflow an outsider cannot execute, and they leak how the site is built. Do not publish an empty `skills` array to pass a scanner. Every entry must point at a real artifact whose digest matches.

## Verify

```sh
curl -si https://example.com/.well-known/agent-skills/index.json | head -20
curl -s https://example.com/.well-known/agent-skills/find-article/SKILL.md | shasum -a 256
```

The second hash MUST equal the `digest` value after `sha256:`. Then run the scanner:

```sh
curl -s -X POST https://isitagentready.com/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}' | jq '.checks.discovery.agentSkills.status'
```

`checks.discovery.agentSkills.status` MUST read `"pass"`.
