# DeepSeek Harness (DSH)

DSH is an approval-gated software delivery agent driven by GitHub issues. It asks focused clarification questions, creates a content-addressed implementation plan, waits for a trusted maintainer to approve that exact plan, implements it with constrained tools, runs sandbox verification, and opens a pull request.

## Workflow

```text
issue opened
    │
    ▼
clarifying ── /dsh answer ... ──► planned
                                      │
                         /dsh approve <plan-id>
                                      │
                                      ▼
                               implementing
                                      │
                         plugins + sandbox tests
                                      │
                                      ▼
                                pull request
```

No code is written or executed before approval. Each plan gets a SHA-256-derived 12-character ID; approval is rejected if it does not match the current pending plan.

## Install in a repository

1. Copy this project into the repository (or publish it as a reusable action and reference it there).
2. Run `npm install` and commit `package-lock.json`.
3. Add `DEEPSEEK_API_KEY` in **Settings → Secrets and variables → Actions → Secrets**.
4. Optionally add repository variables:

   - `DEEPSEEK_MODEL` — defaults to `deepseek-flash`.
   - `DSH_PLUGINS` — defaults to `spec-kit,graphify,documentation`.
   - `DSH_TEST_COMMANDS` — comma-separated exact commands the implementation agent may run.
   - `DSH_TRUSTED_ISSUES_ONLY` — defaults to `true`; only issues opened by write-level collaborators start DSH.
   - `DSH_STATE_AUTHOR` — defaults to `github-actions[bot]`; change this when using a GitHub App or PAT whose comments have another author.

5. Ensure repository Actions settings allow workflows to create pull requests. The workflow explicitly requests `contents: write`, `issues: write`, and `pull-requests: write`.
6. Merge `.github/workflows/dsh.yml` to the default branch. GitHub only triggers `issues` and `issue_comment` workflows from the default branch.

The default safe posture ignores issues from external users, preventing arbitrary users from spending model tokens. Set `DSH_TRUSTED_ISSUES_ONLY=false` only if public intake is intentional; implementation approval still requires write-level repository permission.

## Issue commands

- `/dsh answer <answers>` — the issue author or a trusted maintainer answers clarification questions and automatically creates a plan.
- `/dsh plan` — regenerates a plan (trusted maintainers only).
- `/dsh approve <plan-id>` — approves the exact current plan and starts implementation.
- `/dsh status` — reports the current phase.
- `/dsh retry` — retries an already-approved implementation after a safe failure.

## Plugins

Plugins implement optional lifecycle hooks. Enable them with `DSH_PLUGINS`.

### Spec Kit

The `spec-kit` plugin applies the Spec-Driven Development flow and materializes durable artifacts under `.dsh/specs/issue-N/`:

- `spec.md` — requirements and acceptance criteria
- `plan.md` — approved approach, assumptions, and risks
- `tasks.md` — implementation tasks and verification

These are repository-native artifacts. You can additionally install GitHub Spec Kit's `specify` CLI for its full interactive workflows; DSH does not require a global CLI in CI.

### Graphify

The `graphify` plugin uses an existing `graphify-out/GRAPH_REPORT.md` as planning context. If a graph already exists and the `graphify` executable is installed, it runs an incremental, non-visual refresh after implementation. Absence of Graphify never blocks delivery.

To enable refreshes, install `graphifyy` on the runner before the DSH step and create the initial graph once.

### Documentation

The `documentation` plugin adds documentation requirements to planning and writes an auditable implementation report under `.dsh/reports/` before the pull request.

See [docs/plugins.md](docs/plugins.md) to add more plugins.

## Local development

```bash
npm install
npm test
npm run check
npm run build
```

For a local event replay, set the variables in `.env.example`, point `GITHUB_EVENT_PATH` at a saved GitHub webhook payload, and run `npm run dev`. Use a test repository: a successful approved run pushes a branch and creates a real pull request.

## Security model

- Issue bodies, comments, repository files, and plugin context are explicitly treated as untrusted data.
- Only write/maintain/admin collaborators can approve, regenerate, or retry implementation.
- State is accepted only from comments authored by `DSH_STATE_AUTHOR`.
- File tools reject absolute paths, traversal, secrets, `.git`, dependencies, and generated-output directories.
- The agent cannot run arbitrary shell commands. It can only invoke exact commands in `DSH_TEST_COMMANDS`, without a shell.
- The entire delivery job runs in a disposable `node:22-bookworm` job container, and verification subprocesses receive a further-reduced environment with GitHub and DeepSeek credentials removed.
- Tests must all pass before commit, push, or PR creation.
- A failure is recorded on the issue and opens no pull request.

For stronger isolation on self-hosted runners, use an ephemeral VM and restrict network egress. The included job container isolates the process/filesystem from the host, but test processes still execute repository code and the overall job needs network access for DeepSeek and GitHub.

## Current scope

DSH uses GitHub Actions as its event transport and state is stored in bot-authored issue comments, so no database or always-on webhook server is required. The implementation agent edits text files; binary generation and interactive commands are intentionally outside the default sandbox.
