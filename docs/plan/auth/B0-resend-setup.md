# Step B0 — Resend as SMTP

**Who:** the owner · **Size:** S · **Depends on:** Checkpoint A · **Unlocks:** B1 · **Commit:** none

This step has no code. The main session walks the owner through it and records the result in
`docs/plan/auth/PROGRESS.md`, "Dashboard state". It never types a secret into a file or a chat.

## Goal

Supabase sends its auth emails through Resend, and the "Confirm signup" email carries a 6-digit code.

## Do

1. **Resend account.** Sign up at resend.com. Add a domain that you own (Domains → Add).
2. **DNS.** Add the SPF, DKIM and MX records that Resend shows, at your domain host. Wait until
   Resend says "Verified".
3. **API key.** Resend → API Keys → Create, permission "Sending access", limited to that domain.
   Copy it once. Do not save it in the repository.
4. **Supabase SMTP.** Dashboard → Authentication → Emails → SMTP Settings → Enable custom SMTP:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = the API key.
   - Sender email `no-reply@<your domain>`, sender name `Gym Tracker`.
5. **Rate limit.** Authentication → Rate Limits → "Rate limit for sending emails": 30 an hour.
6. **Template.** Authentication → Emails → Templates → "Confirm signup":
   - Subject: `Your Gym Tracker code`
   - Body:
     ```html
     <h2>Your Gym Tracker code</h2>
     <p>Type this code in the app:</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
     <p>The code works for 1 hour. If you did not ask for it, ignore this email.</p>
     ```
   - No `{{ .ConfirmationURL }}`. A link opens Safari, not the installed app.
7. **Do not turn on "Confirm email" yet.** See the dashboard schedule in `index.md`.
8. **Test the sender.** Authentication → Users → Invite user, or "Send magic link" to your own
   address. The email must arrive from your domain within 1 minute. Delete the test user after.

## Acceptance criteria

- [ ] Resend shows the domain as Verified.
- [ ] Supabase SMTP settings saved, a test email arrived from the new sender.
- [ ] The "Confirm signup" template shows `{{ .Token }}` and no link.
- [ ] "Confirm email" is still off.
- [ ] The dashboard table in `docs/plan/auth/PROGRESS.md` is updated.

## Note for B2

B2 writes the same template to `supabase/templates/confirmation.html` and points
`config.toml` at it, so the local stack and the dashboard match.
