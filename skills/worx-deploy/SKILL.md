# worx-deploy

Hermes skill for deploying generated workers during active orchestrations.

## Goal

Allow Hermes to run:

1. `worx generate --spec <url|file> --output <worker-dir>`
2. `ntn workers deploy <worker-dir>`

## Inputs

- `spec`: OpenAPI 3.x URL or file path
- `output`: local worker output directory
- `filter` (optional): OpenAPI tag filter

## Behavior

- Generate a worker package with one `worker.tool()` per endpoint.
- Surface inferred secrets from auth schemes.
- Deploy via Notion Workers runtime.
