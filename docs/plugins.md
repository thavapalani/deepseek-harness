# Plugin authoring

A plugin implements `HarnessPlugin` from `src/types.ts` and may provide any of these hooks:

- `planningContext` — returns bounded context or planning rules.
- `beforeImplementation` — materializes artifacts required before the agent edits code.
- `afterImplementation` — performs analysis after editing and verification.
- `beforePullRequest` — creates final documentation or metadata before commit.

Register a factory in `src/plugins/index.ts`, then add its name to `DSH_PLUGINS`.

Plugins run with the workflow's permissions, so treat their code as part of the trusted control plane. They should use argument-array process execution, avoid a shell, never print credentials, keep generated artifacts inside the workspace, and fail only when their output is required for delivery. Optional analysis tools should degrade gracefully.

The plugin context includes the issue, current harness state, and workspace path. A plugin must not modify approval state or broaden the approved plan.
