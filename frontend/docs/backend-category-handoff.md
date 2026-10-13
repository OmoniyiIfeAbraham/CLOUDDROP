# Automatic upload category handoff

Prepared October 13, 2026. Frontend change is implemented; backend enforcement and deployment belong to their owners.

The upload queue now shows a read-only category derived from each file's MIME type. The frontend repository and transport no longer accept a category override. Both HTTP and demo uploads derive the category directly from the file. Multipart requests still include `file` and the derived `category`, so they remain compatible with the current API.

## Backend change

The mounted `POST /api/v1/files` handler in `backend/src/controllers/files.controller.ts` currently validates a category name supplied by the caller and saves it. It therefore accepts a PDF labelled Videos even after the dropdown is removed. The separate legacy handler in `backend/src/controllers/upload.controller.ts` has the same behavior.

After existing upload validation, assign `categorizeByMimeType(req.file.mimetype)` from `backend/src/lib/category.ts` and pass that result to `createFile`. Do not trust `req.body.category` as the classification. Either ignore it for backwards compatibility or reject conflicting values with a clear 400 error; derive the persisted category on the server in either case. Check whether the legacy handler is deployed before changing it.

MIME-derived categories are Documents for PDF/Office/text files, Images, Videos, Audio and Archives. Existing unsupported-type and 25 MB size validation must still apply. This change does not inspect file signatures: if stronger content verification is required, implement it separately rather than assuming a caller-provided MIME type proves the bytes' format.

## Acceptance

- A supported PDF sent with `category=Videos` cannot be stored as Videos.
- Valid image, video, audio, document and archive uploads receive their corresponding category.
- Unsupported/oversized files and unauthenticated requests retain their existing rejection behavior.
- Upload retries and cancellation still work, and the response, library and dashboard all show the persisted derived category.
- Agree how to repair previously misclassified records; this frontend fix does not reclassify stored files.

## Deployment

Deploy the frontend image containing the read-only labels. The backend owner implements and tests enforcement, then the deployment owner deploys it and checks uploads with deliberately conflicting category fields against a disposable account.
