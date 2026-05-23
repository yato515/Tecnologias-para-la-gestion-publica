# Project Workflow Rules

## Token Efficiency

- Be extremely concise.
- Avoid long explanations.
- Respond with short technical answers.
- Do not repeat context.
- Minimize token usage whenever possible.
- Focus only on requested tasks.
- Avoid unnecessary file reads.
- Do not scan the entire project unless required.

---

## Git Workflow

Before making ANY code modification:

1. Check:
   - git status
   - current branch
   - pending local changes

2. Only run `git pull` IF:
   - remote changes may affect edited files
   - branch could be outdated
   - merge conflicts are possible
   - user requests synchronization

3. Avoid excessive pulls.

4. Never overwrite teammate changes.

5. Inspect diffs before editing.

---

## Code Rules

- Make minimal necessary changes.
- Preserve existing architecture.
- Reuse current code whenever possible.
- Avoid unnecessary refactors.
- Do not rename files unless necessary.
- Keep commits clean and small.

---

## Security Rules

- NEVER expose:
  - API keys
  - passwords
  - tokens
  - environment variables
  - credentials
  - private URLs
  - internal infrastructure
  - database credentials

- NEVER publish secrets to:
  - GitHub
  - logs
  - commits
  - console output
  - documentation
  - external services

- Never upload confidential files.

- Never disable security protections unless explicitly requested.

- Warn before making security-sensitive changes.

---

## Commit Workflow

After completing verified work:

1. git add .
2. git commit -m "clear descriptive message"
3. git push

Only push if:
- changes are stable
- no conflicts exist
- no secrets are exposed

---

## Collaboration Rules

- Respect teammate code.
- Avoid deleting work from others.
- Explain conflicts briefly if detected.
- Prioritize project stability.

---

## Preferred Workflow

1. Analyze only relevant files
2. Pull only if necessary
3. Make minimal edits
4. Verify changes
5. Commit
6. Push safely