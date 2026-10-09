/**
 * Live CloudDrop flow. Requires a running API.
 * Usage: BASE_URL=http://localhost:5000 node scripts/live-flow.mjs
 */
const base = (process.env.BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const stamp = Date.now();

const log = (name, status, body) => {
  const ok = status >= 200 && status < 300;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} -> ${status}`);
  console.log(JSON.stringify(body, null, 2).slice(0, 800));
};

async function json(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const password = "LiveFlow-Test-Pass-1";
const emailA = `flow.a.${stamp}@example.com`;
const emailB = `flow.b.${stamp}@example.com`;

const regA = await json("/api/v1/auth/register", {
  method: "POST",
  body: {
    firstName: "Flow",
    lastName: "Alpha",
    email: emailA,
    password,
  },
});
log("register A", regA.status, regA.data);

const loginA = await json("/api/v1/auth/login", {
  method: "POST",
  body: { email: emailA, password },
});
log("login A", loginA.status, { success: loginA.data.success });
const tokenA = loginA.data?.data?.token;

const regB = await json("/api/v1/auth/register", {
  method: "POST",
  body: {
    firstName: "Flow",
    lastName: "Beta",
    email: emailB,
    password,
  },
});
log("register B", regB.status, regB.data);
const loginB = await json("/api/v1/auth/login", {
  method: "POST",
  body: { email: emailB, password },
});
const tokenB = loginB.data?.data?.token;

if (!tokenA || !tokenB) {
  console.error("STOP: could not obtain tokens. Expected data.token.");
  process.exit(1);
}

const form = new FormData();
form.append(
  "file",
  new Blob(["live flow"], { type: "text/plain" }),
  "live-flow.txt",
);
form.append("category", "Documents");
const uploadRes = await fetch(`${base}/api/v1/files`, {
  method: "POST",
  headers: { Authorization: `Bearer ${tokenA}` },
  body: form,
});
const uploadBody = await uploadRes.json();
log("upload A", uploadRes.status, uploadBody);
const fileId = uploadBody?.data?.file?.id;

if (!fileId) {
  console.error("STOP: upload did not return a file id.");
  process.exit(1);
}

const listed = await json("/api/v1/files?search=live-flow&page=1&limit=10", {
  token: tokenA,
});
log("list A", listed.status, listed.data);

const download = await json(`/api/v1/files/${fileId}/download`, {
  token: tokenA,
});
log("download A", download.status, {
  success: download.data.success,
  hasUrl: Boolean(download.data?.data?.downloadUrl),
});

const share = await json(`/api/v1/files/${fileId}/share`, {
  method: "POST",
  token: tokenA,
  body: { ttlHours: 1 },
});
log("share A", share.status, {
  success: share.data.success,
  hasUrl: Boolean(share.data?.data?.shareUrl),
  expiresAt: share.data?.data?.expiresAt,
});

const crossGet = await json(`/api/v1/files/${fileId}`, { token: tokenB });
log("cross get B (expect 404)", crossGet.status, crossGet.data);
const crossDl = await json(`/api/v1/files/${fileId}/download`, {
  token: tokenB,
});
log("cross download B (expect 404)", crossDl.status, crossDl.data);
const crossShare = await json(`/api/v1/files/${fileId}/share`, {
  method: "POST",
  token: tokenB,
  body: { ttlHours: 1 },
});
log("cross share B (expect 404)", crossShare.status, crossShare.data);
const crossDel = await json(`/api/v1/files/${fileId}`, {
  method: "DELETE",
  token: tokenB,
});
log("cross delete B (expect 404)", crossDel.status, crossDel.data);

const stats = await json("/api/v1/dashboard/stats", { token: tokenA });
log("dashboard A", stats.status, stats.data);

const deleted = await json(`/api/v1/files/${fileId}`, {
  method: "DELETE",
  token: tokenA,
});
log("delete A", deleted.status, deleted.data);
const gone = await json(`/api/v1/files/${fileId}`, { token: tokenA });
log("get after delete (expect 404)", gone.status, gone.data);
