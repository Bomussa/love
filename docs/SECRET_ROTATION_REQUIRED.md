# Secret Rotation Required (Immediate)

The repository was sanitized to remove exposed credentials and JWT-like values. Because leaked secrets may have been compromised, rotate all related credentials immediately.

## Required Rotations
1. **Supabase**
   - Rotate `service_role` and `anon` JWT keys in Supabase project settings.
   - Regenerate any Supabase personal access tokens used for CLI/API automation.
2. **Vercel**
   - Revoke and recreate personal/team API tokens.
   - Update `VERCEL_TOKEN` in CI/CD secrets.
3. **GitHub**
   - Revoke exposed Personal Access Tokens.
   - Replace secrets in repository/org environment settings.

## After Rotation
- Update CI/CD secret stores only (GitHub Actions/Vercel/Supabase secret managers).
- Do not commit live keys into `.env.example` or source files.
- Run secret scan before merge:
  - `gitleaks detect --source . --no-git`
