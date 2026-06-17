# 1. CI-gated production deploys

- Status: Accepted
- Date: 2026-06-16

## Context

`main` is the sole active branch and the live/deploy branch (`master` was deleted).
Previously, two GitHub Actions workflows both triggered on `push` to `main` and ran
**independently**:

- `ci.yml` — `Build & Test (.NET)` and `Build (Frontend)` (incl. accessibility gates).
- `azure-dev.yml` — `azd` provision/deploy of the API (Container Apps) and the client
  (Static Web App).

Because there was no dependency between them, a **red CI did not stop a deploy**. This
actually happened: the accessibility-tooling push (`0d27073`) deployed to production in
parallel with CI. We want production to deploy only after CI passes.

## Decision

Consolidate deployment into the `CI` workflow (`ci.yml`) as a `deploy` job that:

- declares `needs: [build-and-test, build-frontend]`, so it only starts after both build
  jobs succeed (a failing build job blocks the deploy);
- is gated by `if:` to run only on a push to `main` or a manual `workflow_dispatch`;
- carries the `id-token: write` permission at the **job level** (for OIDC `azd` login),
  leaving the build jobs on default permissions.

`azure-dev.yml` is deleted; its `workflow_dispatch` capability is preserved by the gated
job (manual runs now also run CI first). There is **no manual approval gate** — a green CI
is the only gate, and deploys continue on every merge to `main`.

## Consequences

- A failing CI run cannot deploy to production.
- One source of truth for build + deploy; deploy ordering is guaranteed by `needs:`.
- Manual deploys (`workflow_dispatch`) run the full CI first; there is **no CI-bypassing
  emergency deploy**. If one is ever needed, add a separate `workflow_dispatch`-only
  workflow.
- Existing status-check names (`Build & Test (.NET)`, `Build (Frontend)`) are unchanged,
  so branch protection rules referencing them keep working.

## Alternatives considered

- **`workflow_run` gate** — keep `azure-dev.yml` separate, trigger on the `CI` workflow
  completing with `conclusion == success` on `main`. Rejected: requires a branch+conclusion
  guard and checking out the CI run's `head_sha`; more moving parts than a single pipeline.
- **Tag/release-triggered deploy** — deploy only on `v*` tags, decoupling "merged" from
  "released." Rejected for now: adds release ceremony the project doesn't need yet.
- **GitHub Environments + protection rules** — a `production` environment with required
  reviewers / wait timer for a manual approval gate. Rejected for now (solo maintainer);
  can be layered on later by adding `environment: production` to the deploy job.
