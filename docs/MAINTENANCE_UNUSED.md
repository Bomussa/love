# Unused Files Maintenance (Non-Destructive)

This repo includes a best-effort scanner to detect unused files and an optional archiver to move them under `archive/unused/` without deletion.

## Scan for unused files
```bash
node scripts/maintenance/find-unused.js
```
Outputs `scripts/maintenance/unused-report.json`.

## Archive (optional, safe)
```bash
ARCHIVE_CONFIRM=true node scripts/maintenance/archive-unused.js
```
Moves files listed in the report to `archive/unused/`. Review changes in Git before merging.

Notes:
- The scanner is static and best-effort. Dynamic imports or runtime references may be missed; always review before archiving.
- No UI/CSS/assets are changed by these scripts.
