# Direct download handoff

Prepared October 12, 2026. Owner action: backend download endpoint, then Samuel's backend deployment.

The frontend prepares a fresh link in an accessible download dialog. Signed S3 links with attachment disposition and binary delivery offer **Save file**. Other links offer **Open file** with browser saving instructions. Preparation can be cancelled, failures can be retried, and expired links are removed.

Production currently signs a plain `GetObjectCommand`. Browser-displayable files open inline. The S3 bucket returned `CORSResponse: CORS is not enabled for this bucket` during the October 12 check. An HTML `download` attribute cannot force saving from a cross-origin S3 URL. [MDN documents that restriction](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#download).

## Backend change to implement

In `backend/src/services/s3-download.service.ts`, sign the `GetObjectCommand` with `ResponseContentDisposition` set to an attachment header built from the original filename and `ResponseContentType` set to `application/octet-stream`. Pass `file.originalName` from the active `downloadFile` handler in `backend/src/controllers/files.controller.ts`. Check the legacy handler in `backend/src/controllers/download.controller.ts` if its router is still used.

For example, after adding a direct dependency on a standards-compliant header builder:

```ts
import { create as createContentDisposition } from "content-disposition";

export const generateDownloadUrl = async (
  s3Key: string,
  expiresIn = 600,
  originalName?: string,
) => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    ...(originalName ? {
      ResponseContentDisposition: createContentDisposition(originalName, { type: "attachment" }),
      ResponseContentType: "application/octet-stream",
    } : {}),
  });
  return getSignedUrl(s3Client, command, { expiresIn });
};

// Active download controller:
const downloadUrl = await generateDownloadUrl(file.s3Key, expiresIn, file.originalName);
```

The named `create` API is described in the [current content-disposition documentation](https://github.com/jshttp/content-disposition). Check the API of the version the backend owner selects and its TypeScript definitions. Use a header builder that handles quotes, paths, and Unicode rather than interpolating a raw upload name into a header.

Set the override **before signing**. Appending it to an existing URL invalidates the signature. S3 includes `response-content-disposition=attachment...` in the signed URL and sends the corresponding response header. [AWS documents the authenticated header override](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html).

Keep the existing ownership check, 600-second expiry, and response envelope. Binary delivery avoids inline previews in WebKit as well as Chromium. The stored file MIME type and API metadata remain unchanged: this override applies only to the signed download response. This navigation approach does not require bucket CORS or JavaScript access to the bytes. Sharing retains its current behavior.

## Acceptance after deployment

1. The signed URL includes the attachment disposition/original name and `response-content-type=application/octet-stream`; S3 returns both corresponding headers. Cover ASCII, spaces, quotes, and Unicode.
2. **Save file** produces a browser download with the original name and uploaded bytes in desktop/mobile Chromium and WebKit. The workspace stays open.
3. No API authentication header is sent to S3. Other users' file IDs remain inaccessible. Sharing and deletion still work.

`npm run test:downloads` in `frontend/` verifies the frontend against local HTTP fixtures, including saved bytes and a Unicode filename. After both images are deployed, run:

```bash
E2E_BASE_URL=https://clouddrop-c8.duckdns.org VITE_USE_MOCK_API=false npm run test:e2e -- e2e/live-flow.spec.ts
```

The live flow checks a browser download when attachment links are present and the explicit fallback otherwise. It creates unique test accounts and removes its uploaded file during the successful delete step.

## Message for the team

> Frontend download UX is ready: preparation, cancellation, retry, expiry, and a safe fallback are covered. Please sign the download GetObject request with ResponseContentDisposition: attachment (original filename) and ResponseContentType: application/octet-stream. Pass file.originalName from the active controller. The frontend will then offer Save file. No S3 CORS change is needed; sharing and stored MIME types stay unchanged.
