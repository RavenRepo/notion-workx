Implemented the remaining end-to-end blocker.

  What I changed:

  - src/generator/tool-builder.ts:60: dedupes generated parameter identifiers and avoids reserved local names, fixing collisions
    like path username plus body username.
  - src/generator/code-writer.ts:195: emits request payloads as requestBody so a generated body parameter cannot shadow the fetch
    body variable.
  - test/tool-builder.test.ts:180: added regression coverage for colliding path/body names.
  - test/code-writer.test.ts:58: updated writer coverage for the new requestBody output.

  Verification passed:

  - npx tsc --noEmit
  - npm test → 33 tests passed
  - npm run build
  - Generated /tmp/worx-simple-worker from local fixture, then npx tsc --noEmit passed
  - Generated /tmp/petstore-worker from https://petstore3.swagger.io/api/v3/openapi.json: 18 tools, 1 skipped multipart endpoint, t
    hen npm install and npx tsc --noEmit passed

  Remaining risks:

  - ntn is not installed locally, so live ntn workers deploy could not be run.
  - Root npm install reported 4 moderate vulnerabilities; I did not run npm audit fix --force.
  - Petstore OAuth/OpenID uses the PRD v1 ACCESS_TOKEN placeholder path.
