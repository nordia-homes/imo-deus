# TikTok Studio Integration Plan

## Objective

Build TikTok Studio as a first-class marketing channel inside ImoDeus CRM, focused on organic video publishing for real estate video tours. The integration must keep three concepts separate:

- Video script: the voiceover text read by ElevenLabs.
- Burned subtitles: the text rendered inside the MP4.
- TikTok description: the editable post description published in TikTok's description field.

## Product Structure

Marketing becomes a parent navigation item with two destinations:

- Meta Advertising: the existing Meta ads workspace.
- TikTok Studio: a new studio for TikTok account connection, video tour drafts, AI-generated TikTok descriptions, publish controls, and status tracking.

Routes:

- `/marketing` remains the existing Meta dashboard for backward compatibility.
- `/marketing/meta-advertising` renders the existing Meta dashboard.
- `/marketing/tiktok-studio` renders the new TikTok Studio page.

Implementation note: the current code keeps `/marketing` as the existing Meta dashboard for backward compatibility and adds `/marketing/meta-advertising` as a clean alias. The sidebar exposes the two subpages under Marketing.

## TikTok Developer Requirements

The TikTok developer app must include:

- Login Kit for OAuth.
- Content Posting API.
- Direct Post enabled.
- Scopes: `user.info.basic`, `video.publish`.
- Redirect URI: `https://your-domain.com/auth/tiktok/callback`.

Testing limitation: TikTok restricts unaudited clients to private visibility. The UI must surface this clearly when needed.

## Environment Variables

Required:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`
- `TIKTOK_TOKEN_ENCRYPTION_KEY`

Optional:

- `TIKTOK_SCOPES`
- `TIKTOK_DISABLE_AUTO_AUTH`
- `TIKTOK_UNAUDITED_PRIVATE_ONLY`
- `TIKTOK_DEFAULT_PRIVACY_LEVEL`
- `TIKTOK_MAX_FILE_UPLOAD_CHUNK_BYTES`
- `OPENAI_TEXT_MODEL`

## Data Model

Private integration:

- Collection: `userPrivateIntegrations`
- Document id: `{uid}__tiktok`
- Stores encrypted access and refresh tokens.

Public integration:

- Collection: `users/{uid}/integrations/tiktok`
- Stores safe profile/status data for UI.

OAuth states:

- Collection: `tiktokOauthStates`
- Stores state, agency id, user id, expiry.

Post drafts:

- Collection: `agencies/{agencyId}/tiktokPostDrafts`
- Stores property id, video tour url, TikTok description, hashtags, privacy/options, publish id, status, logs.

Property status:

- Field: `property.tiktokMarketing`
- Stores last draft/status summary for quick scanning.

## Server API

Connection:

- `GET /api/marketing/tiktok/connect`
- `POST /api/marketing/tiktok/disconnect`
- `GET /api/marketing/tiktok/status`
- `GET /auth/tiktok/callback`

Studio:

- `GET /api/marketing/tiktok/dashboard`
- `POST /api/marketing/tiktok/descriptions`
- `GET /api/marketing/tiktok/creator-info`
- `POST /api/marketing/tiktok/post-drafts`
- `PATCH /api/marketing/tiktok/post-drafts/[draftId]`
- `POST /api/marketing/tiktok/post-drafts/[draftId]/publish`
- `GET /api/marketing/tiktok/post-drafts/[draftId]/status`

## Publishing Flow

1. User connects TikTok through OAuth.
2. TikTok Studio lists ready video tours.
3. User chooses a property/video tour.
4. AI generates the TikTok description and hashtags.
5. User edits description, privacy and interaction settings.
6. Backend calls creator info to get allowed privacy options and account limits.
7. Backend creates a draft if needed.
8. Backend calls TikTok Direct Post `/v2/post/publish/video/init/` with `FILE_UPLOAD`.
9. Backend downloads the generated MP4 from Firebase Storage URL.
10. Backend uploads the MP4 to TikTok's `upload_url` with PUT.
11. Backend stores `publish_id`.
12. Backend polls publish status and updates the draft/property summary.

## UX Requirements

TikTok Studio must show:

- Account connection state.
- Connected TikTok username/avatar.
- Warning if credentials are missing.
- Warning if app is in private-only/testing mode.
- Ready video tours.
- Drafts and publish statuses.
- A complete publish modal.

Publish modal must include:

- Vertical video preview.
- Property summary.
- TikTok description textarea.
- Hashtag editor.
- Privacy selector.
- Comments, duet, stitch toggles.
- AI-generated content disclosure toggle.
- Creator info status.
- Publish action and status errors translated into Romanian.

## Implementation Order

1. Add env placeholders.
2. Add complete plan document.
3. Add TikTok types.
4. Add `src/lib/tiktok-marketing.ts`.
5. Add OAuth and dashboard API routes.
6. Add draft/description/publish/status routes.
7. Update sidebar to expose Marketing dropdown.
8. Move current Meta page to `/marketing/meta-advertising`.
9. Add `/marketing/tiktok-studio`.
10. Run focused TypeScript verification.

## Notes

This implementation uses FILE_UPLOAD first because it avoids verified-domain constraints for Firebase Storage URLs. PULL_FROM_URL can be added later after URL prefix verification is complete.
