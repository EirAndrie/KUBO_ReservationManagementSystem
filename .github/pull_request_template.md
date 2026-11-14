<!--
Fill in every section. Write "None" or "Not checked" instead of deleting one.
AI agents: `gh pr create --body` and `--fill` do NOT apply this template.
Copy it, fill it in, and pass it with `gh pr create --body-file <file>`.
-->

## Summary

<!-- What changed and why, in 1-3 bullets. Name the business rule (BR-xxx) or gap (G-xx) it addresses. -->

-

## Changes

- **Backend:**
- **Frontend:**
- **Database (migrations):**
- **Docs:**

## Verification

<!-- Tick only what you actually ran. Say what you did not check and why. -->

- [ ] Backend: `npm run typecheck` and `npm run build`
- [ ] Frontend: `npm run typecheck`, `npm run lint`, and `npm run build`
- [ ] Write flows tested against a separate test database, not the shared one
- [ ] Postman collection or manual API checks:
- [ ] Checked in the browser:

Not checked:

## Database and deployment

- [ ] New migrations are new files named `YYYYMMDD_description.sql`; applied migrations were not edited
- [ ] Environment variable changes for Render or Vercel: None

## Checklist

- [ ] Commits follow Conventional Commits (`type(scope): description`)
- [ ] New mutations keep role checks (BR-005) and write audit rows (BR-067)
- [ ] Docs updated where behavior changed (`docs/development-progress.md`, README "Known Limitations", module `API_CONTRACT.md`, `docs/business_rules.md`)
- [ ] No secrets, credentials, or `.env` files committed
