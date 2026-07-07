# Property Video Tour Implementation Plan

## Product Goal

Turn a property's existing image gallery into a premium video asset that agencies can generate, preview, download, and reuse in marketing flows. The feature should feel native to the property page and produce a practical social-ready video without requiring a separate editing tool.

## UX Placement

- Primary entry point: the property action column as `Video tur proprietate`, next to Meta Ads, Facebook promotion, and social publishing.
- Mobile entry point: the same action card inside the mobile property action list.
- Future secondary entry point: a quick `Genereaza video` control over the gallery, next to `Distribuie` and `Vezi Fotografiile`.

## Version 1 Scope

- Generate a cinematic Ken Burns video from `property.images`.
- Support landscape, portrait, and square formats.
- Support cinematic, luxury, and social pacing presets.
- Support standard and premium quality presets.
- Support auto, 15s, 30s, 45s, and 60s target durations.
- Add property title, price, location, rooms, and surface as optional text overlay.
- Add optional agency branding with agency logo/name when available.
- Add optional ambient music track generated locally during render.
- Show generation progress.
- Preview the generated video in the dialog.
- Generate and upload a thumbnail image for video reuse.
- Upload the generated video to Firebase Storage under the property.
- Save video metadata on the property as `videoTour`.
- Allow re-generation and download.
- Expose the generated video as selectable creative media in Meta Ads.
- Provide a quick gallery entry point next to share/photo controls.

## Technical Architecture

- Rendering runs in the browser through Canvas and `MediaRecorder`.
- Production rendering can run through the cloud video job queue.
- Cloud rendering creates `propertyVideoTourJobs` under each property.
- The cloud worker drains queued jobs through `/api/property-video-tours/drain`.
- Manual premium render can run `/api/properties/{propertyId}/video-tour-jobs/{jobId}/run`.
- FFmpeg rendering outputs deterministic MP4/H.264 with `yuv420p` and `+faststart`.
- The app bundles `ffmpeg-static`, so the renderer does not depend on a system-level FFmpeg binary.
- Scheduled draining uses `PROPERTY_VIDEO_TOUR_CRON_SECRET`.
- Images are loaded through `fetch` to Blob URLs where possible to reduce canvas/CORS issues.
- Output uses the best MIME type supported by the user's browser: MP4 when available, WebM fallback otherwise.
- Files are stored at `agencies/{agencyId}/properties/{propertyId}/video-tours/{fileName}`.
- Firestore stores status, URL, thumbnail URL, format, style, quality, duration, image count, MIME type, generator user, engine, and timestamp.

## Market-Leader Roadmap

- Add a dedicated Cloud Run image with FFmpeg preinstalled for higher throughput and predictable runtime.
- Add richer real-time progress updates from FFmpeg frame parsing.
- Add thumbnails and first-frame preview images.
- Add music bed selection with licensed tracks.
- Add agency logo support instead of generic ImoDeus branding.
- Add automatic image ordering by room type and quality.
- Add optional depth/parallax for images that pass quality checks.
- Add direct handoff to Meta Ads creative media and Facebook/Instagram posts.
- Add monthly generation limits and plan-based entitlements.
- Add batch generation for multiple properties.

## Operational Notes

- Browser generation is good for immediate availability and avoids new backend infrastructure.
- Cloud rendering should become the production-grade path for exact MP4 output, heavy workloads, and predictable performance across agencies.
- The UI and data model added in V1 are compatible with that future worker path.
