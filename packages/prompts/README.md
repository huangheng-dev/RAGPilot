# Prompts

This package is the boundary for authored Prompt assets and optional import/export tooling.

The active runtime catalog is persisted in the `prompt_templates` and `prompt_versions` tables. Baseline versions are installed by database migration, while chat messages and Agent runs retain the selected version ID and a privacy-safe rendered snapshot hash. Runtime records do not copy retrieved document content into this package.
