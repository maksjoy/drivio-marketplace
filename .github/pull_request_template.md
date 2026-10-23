## Alberta-Cars production change

### What changed
Describe the user-visible or infrastructure change.

### Risk
- [ ] No database/auth/storage change
- [ ] Database/RLS migration reviewed
- [ ] Authentication or recovery flow affected
- [ ] Photo upload/storage affected
- [ ] Deployment/security headers affected

### Required checks
- [ ] `npm run typecheck`, `npm run build`, and `npm run test:security-live` (the two photo/owner tests stay red until the pending listing-photo migrations are applied)
- [ ] Typecheck/build CI is green
- [ ] Read-only load smoke is green when the catalog/query path changed
- [ ] Supabase security/performance advisors reviewed after database changes
- [ ] Web bundle does not include Telegram runtime assets
- [ ] Legal/privacy text reviewed if data collection or providers changed

### Release verification
- [ ] Vercel preview/build succeeded
- [ ] Critical flows were smoke-tested
- [ ] Rollback path is known
