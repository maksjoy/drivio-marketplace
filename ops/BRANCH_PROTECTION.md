# Required main-branch protection

GitHub repository rulesets are currently empty. Apply the following rule to `main` in GitHub Settings → Rules → Rulesets (or Branch protection rules):

- Require a pull request before merging.
- Require the `build` check from the `Test P2PCars Web` workflow to pass.
- Require conversation resolution before merging.
- Block force pushes and branch deletion.
- Require review of CODEOWNERS changes; if only one maintainer exists, do not require a second human approval until another trusted maintainer is available.
- Do not allow bypass for ordinary changes. Keep an emergency owner bypass only if needed for outage recovery.

The repository includes `.github/CODEOWNERS` and a production PR checklist so this can be enabled without code changes.
