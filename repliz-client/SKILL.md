---
name: ReplizSocial
agent: claudia
description: Manage Threads social media presence using Repliz API — automated posting, engagement, and community management with foreign character filtering and AI accusation handling.
---

# ReplizSocial Skill

Social media automation for Threads platform using Repliz API.

## Configuration

Set in `repliz-client/config/.env`:
- `REPLIZ_ACCESS_KEY` — API access key
- `REPLIZ_SECRET_KEY` — API secret key
- `REPLIZ_API_BASE_URL` — Base API URL

## Commands

```bash
# Initialize client
cd repliz-client && node scripts/repliz-client.js

# Manual post
node scripts/repliz-client.js post "Your content here"

# Reply to comment
node scripts/repliz-client.js reply <commentId> "Your reply"

# Run scheduler (check for scheduled posts)
node scripts/post-scheduler.js

# Test character filters
node scripts/repliz-client.js test
```

## Content Management

### Templates
Location: `repliz-client/content/templates.md`
- Trade journal formats
- Educational posts
- Strategy updates
- AI accusation responses

### Scheduled Queue
Location: `repliz-client/content/scheduled/queue.json`
- Post schedule with timestamps
- Auto-publish via cron

### Archive
Location: `repliz-client/content/posted/`
- All published posts with metadata

## Safety Features

### Foreign Character Filter
Auto-blocks comments with:
- Chinese, Japanese, Korean
- Arabic, Hebrew, Hindi, Thai

### AI Accusation Handler
Auto-generates elegant deflection responses.

### Rate Limiting
- Max 3 posts/day
- Max 5 total interactions/day

## Cron Setup

```bash
# Check for posts every 15 minutes
*/15 * * * * cd /root/.openclaw/workspace/claudia && node repliz-client/scripts/post-scheduler.js

# Daily analytics report at 23:00
0 23 * * * cd /root/.openclaw/workspace/claudia && node repliz-client/scripts/analytics-tracker.js
```

## Documentation

- Full plan: `memory/threads-social-plan.md`
- Persona guidelines: See SOUL.md Social Media Mode
