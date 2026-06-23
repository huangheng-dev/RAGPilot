# First Tagged Release Checklist

## Purpose

This checklist defines what should be true before RagPilot creates its first public version tag.

It applies after the repository has already been pushed publicly at least once.

## Tagging Goal

The first tag should represent a clean public baseline:

- documentation matches the code reality
- CI is active
- the repository has no local-only residue
- the tag can be used as a stable future reference point

## Suggested Baseline

Unless a different release number is chosen intentionally, the first public baseline can use:

```text
v0.1.0
```

This signals:

- open-source baseline published
- active development continues
- not yet a finished `1.0` product commitment

## Pre-Tag Checklist

Before creating the first public tag:

1. confirm `README.md` still matches the current implementation
2. confirm `docs/product/project-snapshot.md` matches the real project stage
3. confirm `docs/planning/progress-flow.md` and `docs/planning/roadmap.md` are current
4. confirm `CONTRIBUTING.md` and `SECURITY.md` are present
5. confirm CI passes on the default branch
6. confirm local-only folders and `.env*` files are not tracked
7. confirm the chosen `LICENSE` is present
8. confirm the main product chain is still the public framing of the project

## Tag Sequence

```bash
git tag v0.1.0
git push origin v0.1.0
```

If the project owner selects a different first tag, replace the version accordingly.

## Post-Tag Follow-up

After the first tag:

1. add the tag reference to release notes or the next project update
2. keep future changes incremental instead of rewriting public history
3. treat the tagged baseline as the first stable open-source checkpoint for future contributors
