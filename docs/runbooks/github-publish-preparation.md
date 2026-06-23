# GitHub Publish Preparation

## Purpose

This runbook defines how RagPilot should be prepared before it is published to GitHub.

It exists to protect two things at the same time:

- the repository should stay clean and professional in public
- the project should not lose its long-term direction while development is still in progress

## Publish Rule

RagPilot can be published to GitHub before the platform is feature-complete.

Open-source publication should represent the project honestly as:

- active development
- production-oriented architecture
- stable product direction
- incomplete but real implementation

It should not present unfinished work as if the product were already complete.

## What Must Stay Public

These files and themes should remain in the public repository because they protect project direction:

- `README.md`
- `docs/README.md`
- `docs/product/project-snapshot.md`
- `docs/product/project-blueprint.md`
- `docs/product/platform-blueprint-reference.md`
- `docs/product/technology-rollout.md`
- `docs/planning/roadmap.md`
- `docs/architecture/*`
- `docs/api/api-outline.md`
- `docs/runbooks/local-development.md`

These documents define:

- what RagPilot is
- what it is not
- the target product chain
- the technology boundaries
- the current implementation state
- the remaining roadmap

If these are removed, later development is more likely to drift.

## What Should Stay Private

The following categories should not be published to GitHub when they contain internal-only material:

- temporary delivery notes
- personal implementation reminders
- local debugging notes
- internal operating instructions
- private business context
- unpublished internal strategy drafts

Recommended future private folders:

```text
docs/internal/
docs/private/
```

If those folders are introduced later, they should be added to `.gitignore` or excluded intentionally from commit selection.

## Local-Only Files

The public repository should not include local development residue such as:

- `.codex/`
- `.codex-runtime/`
- `.playwright-cli/`
- `logs/`
- `output/`
- `work/`
- `node_modules/`
- `.next/`
- `.venv/`
- `tmp/`
- local `.env` files
- local `*.log` files

These are now covered by `.gitignore`.

## Release Checklist

Before the first GitHub publish:

1. verify `README.md` still matches the current code reality
2. verify product-direction markdown stays aligned with the current main chain
3. verify no internal-only notes were placed into public docs folders
4. verify `.env`, local logs, and local runtime folders are ignored
5. verify ports, startup commands, and route descriptions are still correct
6. verify the repository does not claim unfinished modules are complete
7. add a `LICENSE` before public release
8. verify whether the local working tree is already initialized as Git and initialize it if not
9. follow the first-publish step order in `first-public-release.md`

## Ongoing Update Rule

After the repository is public:

- continue updating the project incrementally
- keep unfinished areas clearly described as current constraints or next milestones
- do not remove blueprint documents just because implementation is still catching up
- when new technology is introduced, land it through the main product chain instead of as a detached demo

## Current Recommendation

RagPilot is suitable for GitHub publication once the repository owner is ready, even though some features are still incomplete.

The current recommended public framing is:

- open-source
- active development
- production-oriented
- architecture established
- core operator chain already implemented
- deeper governance, authentication, evaluation, and advanced runtime work still in progress
