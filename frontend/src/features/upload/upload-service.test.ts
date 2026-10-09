import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_SIZE, suggestCategory, uploadFileHttp, validateUploadFile } from "./upload-service";
import { sessionToken } from "../../lib/runtime";
import { SESSION_EXPIRED_EVENT } from "../../lib/api";
import { normalFileFixtures } from "../files/api/files.fixtures";

class FakeRequest {
  static current: FakeRequest;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  method = "";
  url = "";
  body: Document | XMLHttpRequestBodyInit | null | undefined;
  headers = new Map<string, string>();

  constructor() {
    FakeRequest.current = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    this.body = body;
  }

  respond(status: number, payload: string) {
    this.status = status;
    this.responseText = payload;
    this.onload?.();
  }

  aborted = false;

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeRequest);
  sessionToken.clear();
});

afterEach(() => {
  sessionToken.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("upload validation", () => {
  it("accepts supported file types", () => {
    expect(validateUploadFile(new File(["note"], "note.txt", { type: "text/plain" }))).toBeNull();
  });

  it("rejects unsupported types and oversized files", () => {
    expect(validateUploadFile(new File(["x"], "run.exe", { type: "application/x-msdownload" }))).toMatch(/not supported/);
    const oversized = new File(["x"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_FILE_SIZE + 1 });
    expect(validateUploadFile(oversized)).toBe("File exceeds the 25 MB upload limit.");
  });

  it("accepts files up to exactly 25 MB, like the backend", () => {
    const atLimit = new File(["x"], "limit.pdf", { type: "application/pdf" });
    Object.defineProperty(atLimit, "size", { value: 26_214_400 });
    expect(validateUploadFile(atLimit)).toBeNull();
    const overLimit = new File(["x"], "over.pdf", { type: "application/pdf" });
    Object.defineProperty(overLimit, "size", { value: 26_214_401 });
    expect(validateUploadFile(overLimit)).toMatch(/25 MB/);
  });

  it("suggests the same category the backend would assign", () => {
    expect(suggestCategory("application/pdf")).toBe("Documents");
    expect(suggestCategory("text/csv")).toBe("Documents");
    expect(suggestCategory("IMAGE/PNG")).toBe("Images");
    expect(suggestCategory("video/webm")).toBe("Videos");
    expect(suggestCategory("audio/ogg")).toBe("Audio");
    expect(suggestCategory("application/x-7z-compressed")).toBe("Archives");
    expect(suggestCategory("application/octet-stream")).toBe("Other");
    expect(suggestCategory("")).toBe("Other");
  });
});

describe("HTTP upload", () => {
  const file = new File(["notes"], "notes.txt", { type: "text/plain" });

  it("requires a token before creating a request", async () => {
    await expect(uploadFileHttp(file, "Documents")).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("sends multipart fields and reports progress", async () => {
    sessionToken.set("secret-token");
    const onProgress = vi.fn();
    const pending = uploadFileHttp(file, "Documents", onProgress);
    const request = FakeRequest.current;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/v1/files");
    expect(request.headers.get("Authorization")).toBe("Bearer secret-token");
    expect(request.headers.has("Content-Type")).toBe(false);
    expect((request.body as FormData).get("file")).toBe(file);
    expect((request.body as FormData).get("category")).toBe("Documents");
    request.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent);
    expect(onProgress).toHaveBeenCalledWith(50);
    request.respond(201, JSON.stringify({ success: true, message: "Uploaded", data: { file: { ...normalFileFixtures[0], s3Key: "private/key" } } }));
    await expect(pending).resolves.toEqual(normalFileFixtures[0]);
  });

  it("normalizes a non-JSON 401 and expires the session", async () => {
    sessionToken.set("expired-token");
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    const pending = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(401, "<html>Unauthorized</html>");
    await expect(pending).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(sessionToken.get()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it("does not expire a replacement session when an old upload gets a 401", async () => {
    sessionToken.set("old-token");
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    const pending = uploadFileHttp(file, "Documents");
    sessionToken.set("new-token");
    FakeRequest.current.respond(401, "Unauthorized");
    await expect(pending).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(sessionToken.get()).toBe("new-token");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it("marks server failures retryable and handles network errors", async () => {
    sessionToken.set("token");
    const failure = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(503, JSON.stringify({ success: false, message: "Service unavailable", error: { code: "SERVICE_UNAVAILABLE" } }));
    await expect(failure).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503, retryable: true });
    const network = uploadFileHttp(file, "Documents");
    FakeRequest.current.onerror?.();
    await expect(network).rejects.toMatchObject({ code: "NETWORK_ERROR", retryable: true });
  });

  it("rejects malformed responses and non-retryable client errors", async () => {
    sessionToken.set("token");
    const gateway = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(502, "<html>Bad gateway</html>");
    await expect(gateway).rejects.toMatchObject({ code: "HTTP_ERROR", status: 502, retryable: true });

    const tooLarge = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(413, "<html>413 Request Entity Too Large</html>");
    await expect(tooLarge).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE", status: 413, retryable: false });

    const malformed = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(200, "<html>not json</html>");
    await expect(malformed).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 200 });

    const missingFile = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(201, JSON.stringify({ success: true, message: "Uploaded", data: {} }));
    await expect(missingFile).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 201 });

    const malformedFile = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(201, JSON.stringify({ success: true, message: "Uploaded", data: { file: { id: "file-1" } } }));
    await expect(malformedFile).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    const invalid = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(400, JSON.stringify({ success: false, message: "Invalid upload", error: { code: "INVALID_UPLOAD" } }));
    await expect(invalid).rejects.toMatchObject({ code: "INVALID_UPLOAD", status: 400, retryable: false });
  });

  it("aborts the request when the upload is cancelled", async () => {
    sessionToken.set("token");
    const controller = new AbortController();
    const pending = uploadFileHttp(file, "Documents", undefined, controller.signal);
    const request = FakeRequest.current;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "UPLOAD_CANCELLED" });
    expect(request.aborted).toBe(true);

    const before = FakeRequest.current;
    await expect(uploadFileHttp(file, "Documents", undefined, controller.signal)).rejects.toMatchObject({ code: "UPLOAD_CANCELLED" });
    expect(FakeRequest.current).toBe(before);
  });
});
