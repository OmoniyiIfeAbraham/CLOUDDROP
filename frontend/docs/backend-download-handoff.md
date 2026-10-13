# Direct download handoff

Updated October 13, 2026. Owner action: backend download endpoint, then Samuel's backend deployment.

The frontend now offers separate **View** and **Download** actions on the dashboard, file library and file details page. View opens a preview dialog for supported images, video, audio, PDF and text. Download prepares a fresh link and automatically initiates saving from the first click when the link signs attachment and binary delivery. Save file remains a manual fallback if the browser blocks an automatic download. Inline links returned to Download are rejected with clear feedback; they never silently become a viewing tab.

The frontend sends `GET /api/v1/files/:id/download?disposition=attachment` for Download and `?disposition=inline` for View. Both requests use the existing response shape (`file`, `downloadUrl`, `expiresIn`). The merged main backend signs attachment/binary delivery with the stored original filename, but still ignores this query. It needs inline delivery support for View. Production checked on October 13 still returns plain inline links without these overrides, so deploying the merged download fix also remains necessary. Source implementation and deployment acceptance are separate gates.

The production response observed on October 13 signs a plain `GetObjectCommand`. Browser-displayable files open inline. The S3 bucket returned `CORSResponse: CORS is not enabled for this bucket` during the October 12 check. An HTML `download` attribute cannot force saving from a cross-origin S3 URL. [MDN documents that restriction](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#download).

## Backend change to implement

Validate optional `disposition` as `attachment` or `inline` in the mounted download handler in `backend/src/controllers/files.controller.ts`. Reject unsupported values with a 400 error; default to attachment for existing callers. Pass the requested disposition, original filename and stored MIME type into `generateDownloadUrl` in `backend/src/services/s3-download.service.ts`. Check the legacy handler in `backend/src/controllers/download.controller.ts` if its router is still used.

Before signing the `GetObjectCommand`, set:

| Action | ResponseContentDisposition | ResponseContentType |
| --- | --- | --- |
| Download | attachment with the original filename | application/octet-stream |
| View | inline with the original filename | The stored file MIME type |

Build the disposition header with a standards-compliant library that handles quotes, spaces and Unicode filenames. Do not interpolate raw upload names into a response header. Keep the existing ownership check, expiry, response envelope, stored MIME type and sharing behavior. The named header-building API previously considered is documented in [content-disposition](https://github.com/jshttp/content-disposition); verify the installed version and its TypeScript definitions.

Set the override **before signing**. Appending it to an existing URL invalidates the signature. S3 includes `response-content-disposition=attachment...` in the signed URL and sends the corresponding response header. [AWS documents the authenticated header override](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html).

Keep the existing ownership check, 600-second expiry, and response envelope. Binary delivery avoids inline previews in WebKit as well as Chromium. The stored file MIME type and API metadata remain unchanged: this override applies only to the signed download response. This navigation approach does not require bucket CORS or JavaScript access to the bytes. Sharing retains its current behavior.

## Confirmed Unicode upload issue

A real production upload on October 13 stored `Résumé notes (final).txt` as `RÃ©sumÃ© notes (final).txt`. This is a multipart filename decoding/metadata issue before download, independent of the Windows WebKit fallback reported in the audit. Eunice should preserve UTF-8 upload names before storage-key and metadata creation, and verify actual browser multipart uploads. Correct attachment headers cannot recover an already corrupted name. The frontend should continue using the server's canonical original name; it must not silently rewrite metadata in the UI.

## Acceptance after deployment

1. The signed URL includes the attachment disposition/original name and `response-content-type=application/octet-stream`; S3 returns both corresponding headers. Cover ASCII, spaces, quotes, and Unicode.
2. One **Download** click produces a browser download with the original name and uploaded bytes in desktop/mobile Chromium and WebKit. No viewing tab opens and the workspace stays open.
3. **View** requests inline delivery and shows supported files in the preview dialog without starting a download. Unsupported types show an explanation.
4. No API authentication header is sent to S3. Other users' file IDs remain inaccessible. Sharing and deletion still work.

`npm run test:downloads` in `frontend/` verifies the frontend against local HTTP fixtures, including saved bytes and a Unicode filename. After both images are deployed, run:

```bash
E2E_BASE_URL=https://clouddrop-c8.duckdns.org VITE_USE_MOCK_API=false npm run test:e2e -- e2e/live-flow.spec.ts
```

The live flow checks separate inline viewing and a browser download from the first Download click. It is an acceptance gate after the backend supports the disposition contract. It creates unique test accounts and removes its uploaded file during the successful delete step.

## Owner summary

Frontend implementation is ready for review. The backend must honor `disposition=attachment` and `disposition=inline`, signing the original filename and correct response type before producing the URL. Deploy both changes, then repeat the byte/filename checks and confirm View never starts a download. No S3 CORS workaround is required. Sharing and stored MIME metadata stay unchanged.
