import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_SIZE, uploadFileHttp, validateUploadFile } from "./upload-service";
import { sessionToken } from "../../lib/runtime";
import { SESSION_EXPIRED_EVENT } from "../../lib/api";

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
    expect(validateUploadFile(oversized)).toMatch(/2 GB/);
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
    expect(request.url).toBe("/api/v1/files/upload");
    expect(request.headers.get("Authorization")).toBe("Bearer secret-token");
    expect(request.headers.has("Content-Type")).toBe(false);
    expect((request.body as FormData).get("file")).toBe(file);
    expect((request.body as FormData).get("category")).toBe("Documents");
    request.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent);
    expect(onProgress).toHaveBeenCalledWith(50);
    request.respond(201, JSON.stringify({ success: true, message: "Uploaded", data: { file: { id: "file-1" } } }));
    await expect(pending).resolves.toMatchObject({ id: "file-1" });
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

  it("marks server failures retryable and handles network errors", async () => {
    sessionToken.set("token");
    const failure = uploadFileHttp(file, "Documents");
    FakeRequest.current.respond(503, JSON.stringify({ success: false, message: "Service unavailable", error: { code: "SERVICE_UNAVAILABLE" } }));
    await expect(failure).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503, retryable: true });
    const network = uploadFileHttp(file, "Documents");
    FakeRequest.current.onerror?.();
    await expect(network).rejects.toMatchObject({ code: "NETWORK_ERROR", retryable: true });
  });
});
