# GRC Control Center v1.5 — Operations Follow-up Patch

This patch adds the operational follow-up layer that helps managers and executives chase work without relying on manual WhatsApp/email follow-up.

## Added

- Operations & Notifications Center page.
- Manager inbox combining due items, overdue items, OVR follow-ups and pending approvals.
- Due reminder queue for projects, milestones, tasks, OVR reports and approvals.
- Notification digest view by user.
- Unified activity timeline from audit logs, follow-up notes and notifications.
- Manual reminder generation function for in-app reminders.
- Notification preferences table.
- Follow-up notes table.
- Bilingual Arabic/English labels for the new page and navigation.
- Modern operational UI cards, segmented tabs and timeline design.

## Database migration

Run:

```sql
supabase/migrations/017_notifications_activity_timelines.sql
```

## Notes

- This is still in-app reminders, not external email/SMS sending.
- The `generate_due_reminders()` function can later be called by a scheduled Edge Function or server job.
- This patch does not export Storage binaries and does not change auth secrets.
