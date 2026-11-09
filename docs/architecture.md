# Architecture

## Components

- `Orchestrator` maps GitHub events and commands to the state machine.
- `GitHubService` reads issues, validates collaborator permissions, stores state comments, manages labels, and opens PRs.
- `DeepSeekClient` provides JSON planning and function/tool calling using the DeepSeek Chat Completions API.
- `ImplementationAgent` executes an approved plan using four constrained tools: list, read, write, and allowlisted test.
- `WorkspaceSandbox` enforces path, size, process, timeout, and environment boundaries.
- Plugins enrich planning and run hooks around implementation and PR preparation.

## State and idempotency

State is encoded in a hidden `dsh-state` marker in bot-authored issue comments. The latest valid comment by `DSH_STATE_AUTHOR` is authoritative. GitHub Actions concurrency serializes runs per issue. Replayed issue events stop when state already exists, and an approval is valid only in `planned` state with the current plan ID.

## Trust boundaries

```text
untrusted                         trusted control plane
─────────                         ─────────────────────
issue body ─┐
comments ───┼──► prompt boundary ─► DeepSeek ─► validated JSON/tool calls
repo files ─┘                                      │
                                                   ▼
maintainer approval ───────────────────────► constrained sandbox
                                                   │
                                                   ▼
                                            tests → commit → PR
```

GitHub permission checks and plan IDs are deterministic controls outside the model. The model cannot approve its own plan or select arbitrary processes.
