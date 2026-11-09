# Security policy

Do not report vulnerabilities in a public issue. Use the repository's private security advisory feature.

Keep `DSH_TRUSTED_ISSUES_ONLY=true` unless public model-powered intake is explicitly desired. Limit `DSH_TEST_COMMANDS` to deterministic project checks, pin third-party Actions by full commit SHA for high-assurance deployments, and use ephemeral runners. Rotate `DEEPSEEK_API_KEY` and any custom GitHub token immediately if workflow logs expose them.

The default workflow uses GitHub's short-lived `GITHUB_TOKEN`. If you replace it with an App token or PAT, set `DSH_STATE_AUTHOR` to that token identity's comment login so untrusted comments cannot masquerade as harness state.
