# WEBAGENT.md

This file is for agents focused on browser, CDN, or web-import consumption.

## Goals
- Keep browser-facing guidance separate from Node/package guidance.
- Verify whether a real web delivery path exists before describing one.
- Prefer explicit, versioned import paths over vague hosting assumptions.

## What To Check
- Whether the package ships a browser-ready build or only source files.
- Whether a CDN can load the package without additional bundling.
- Whether hosted imports have stable MIME type and version semantics.
- Whether the README matches the actual supported consumption path.

## Web Consumption Rules
- GitHub-backed CDN imports are allowed when the target is a plain ESM file with no Node-only runtime requirements.
- Prefer jsDelivr or an equivalent CDN over raw GitHub URLs.
- Use a version tag or commit SHA for stable imports; `@main` is only for live development.
- Document the exact import string in the README so another project can copy it directly.

## Validation
- Prefer direct import-path and artifact checks over assumptions.
- Confirm the web-facing docs never overstate release or hosting support.
