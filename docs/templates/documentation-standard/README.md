# Documentation Standard Template

Use this folder as the baseline documentation pack for a new or existing product repository.

## Template Structure

```text
documentation-standard/
├─ README.md
├─ api/
│  ├─ api-outline.template.md
│  └─ provider-contract.template.md
├─ architecture/
│  ├─ entity-relationship.template.md
│  └─ system-overview.template.md
├─ planning/
│  └─ roadmap.template.md
├─ product/
│  ├─ project-blueprint.template.md
│  ├─ project-snapshot.template.md
│  └─ workflow-spec.template.md
└─ runbooks/
   └─ deployment-guide.template.md
```

## Rules

- keep folder names lowercase
- keep file names lowercase `kebab-case`
- keep one document focused on one responsibility
- update product, architecture, API, and runbook docs together when direction changes

## How To Use

1. copy this folder into the target repository
2. rename `.template.md` files into active document names
3. replace placeholders like `<ProjectName>`
4. connect the target repository `README.md` and `docs/README.md` to the active files
