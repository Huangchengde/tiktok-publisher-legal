# KnowGrow Creator Studio

Public product website and creator workspace for KnowGrow Creator Studio.

## Public routes

- `/` — product website
- `/app/` — interactive local video preview and publication check
- `/support/` — user support and authorization guidance
- `/terms/` — Terms of Service
- `/privacy/` — Privacy Policy
- `/data-deletion/` — authorization revocation and deletion instructions
- `/demo/` — compatibility redirect to the live workspace

The TikTok verification files in the repository root must remain publicly accessible.

## Service integration

The workspace uses `https://tiktok-content-api.onrender.com` for:

- API health checks
- TikTok OAuth initiation
- non-publishing metadata validation through `/tiktok/publish/dry-run`

The selected video is previewed locally and is not transferred during the publication check.
