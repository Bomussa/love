# love monorepo

## Package manager policy

This repository **officially uses `pnpm` only**.

- Required lockfile: `pnpm-lock.yaml` (root only).
- Unsupported lockfiles: `package-lock.json`, `yarn.lock`, and nested lockfiles (for example `frontend/pnpm-lock.yaml`).

## Install

```bash
pnpm install
```

## Common commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
```
