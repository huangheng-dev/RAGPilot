# First Public Release Runbook

## Purpose

This runbook defines the exact first-release sequence for publishing RagPilot to GitHub without losing project direction or leaking local-only material.

It is intentionally practical.

Use it when the repository owner is ready to turn the current local project into a public open-source repository.

## Preconditions

Do not start the first public release until all of the following are true:

1. `README.md` matches the current code reality
2. `docs/planning/phase-5-release-checklist.md` is reviewed
3. local runtime output is ignored
4. no private notes were placed in public docs folders
5. the repository owner has chosen the final open-source `LICENSE`

## First Public Release Sequence

### 1. Review repository framing

Confirm these files are current:

- `README.md`
- `CONTRIBUTING.md`
- `docs/product/project-snapshot.md`
- `docs/planning/progress-flow.md`
- `docs/planning/roadmap.md`

### 2. Confirm local-only boundaries

Verify that these areas are not being prepared for publication:

- `.env*` except `.env.example`
- `.codex/`
- `.codex-runtime/`
- `.playwright-cli/`
- `logs/`
- `.logs/`
- `output/`
- `work/`
- `tmp/`
- `docs/internal/`
- `docs/private/`

### 3. Run validation

Run the minimum release validation:

```bash
npm run web:build
F:\RagPilot\apps\api\.venv\Scripts\python.exe -m pytest F:\RagPilot\apps\api\tests
```

If the local environment differs, use the equivalent project Python environment.

### 4. Run a final secret scan

Search the source tree and documentation for accidental credentials, private keys, or provider secrets before the first commit is published.

The scan should cover at least:

- web source
- API source
- infrastructure config
- docs
- root environment examples

### 5. Initialize Git if needed

If the local project still has no `.git` directory:

```bash
git init
git add .
git commit -m "Initial RagPilot open-source baseline"
```

If Git is already initialized, keep the current repository history and skip this step.

### 6. Attach the public remote

Create the public GitHub repository, then attach it:

```bash
git remote add origin <your-github-repository-url>
git branch -M main
git push -u origin main
```

### 7. Tag the first public baseline

After the first public push is confirmed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Adjust the first tag if a different version is chosen.

Use `first-tagged-release-checklist.md` before the tag is created.

## First Release Messaging

The first public framing should stay honest:

- open-source
- active development
- production-oriented architecture
- core operator chain already implemented
- deeper authentication, evaluation, MCP management, and production hardening still in progress

Do not frame RagPilot as finished if the current production blueprint is still being built out.

## After the First Public Release

Immediately after the first public push:

1. verify the GitHub repository landing text matches `README.md`
2. verify CI runs successfully on GitHub
3. verify no local-only files were included
4. record the baseline in the next project progress update
