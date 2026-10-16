import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ok = { success: true, message: "Request successful." };
const invalid = { success: false, message: "Invalid or expired", error: { code: "INVALID_OR_EXPIRED_RESET_TOKEN" } };
const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
};
const fillPasswords = async (page: Page, password = "a-new-password") => {
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
};

test("login recovery link, generic confirmation and email validation", async ({ page }, info) => {
  const emails: string[] = [];
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    emails.push(route.request().postDataJSON().email);
    await route.fulfill({ json: ok });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  await audit(page);
  await page.screenshot({ path: info.outputPath("forgot-password.png"), fullPage: true });
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveAccessibleDescription("Enter a valid email address");
  await audit(page);
  for (const email of ["known@example.test", "unknown@example.test"]) {
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeFocused();
    await expect(page.getByText(/If an account exists/)).toBeVisible();
    await audit(page);
    await page.getByRole("link", { name: "Try another email" }).click();
  }
  expect(emails).toEqual(["known@example.test", "unknown@example.test"]);
});

test("reset validates confirmation, submits query token and clears it on success", async ({ page }, info) => {
  const submissions: unknown[] = [];
  await page.route("**/api/v1/auth/reset-password", async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ json: ok });
  });
  await page.goto("/reset-password?token=fixture%2Btoken");
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await audit(page);
  await page.screenshot({ path: info.outputPath("reset-password.png"), fullPage: true });
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByLabel("New password", { exact: true })).toBeFocused();
  await audit(page);
  await page.getByLabel("New password", { exact: true }).fill("a-new-password");
  await page.getByLabel("Confirm password", { exact: true }).fill("does-not-match");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();
  expect(submissions).toEqual([]);
  await page.getByRole("button", { name: "Show new password", exact: true }).click();
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute("type", "text");
  await fillPasswords(page);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeFocused();
  expect(submissions).toEqual([{ token: "fixture+token", newPassword: "a-new-password" }]);
  await expect(page).toHaveURL(/\/reset-password$/);
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token") === null)).toBe(true);
  await audit(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("missing, used and expired links offer a fresh recovery request", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Reset link required" })).toBeFocused();
  await audit(page);
  await page.route("**/api/v1/auth/reset-password", (route) => route.fulfill({ status: 400, json: invalid }));
  await page.goto("/reset-password?token=expired-fixture");
  await fillPasswords(page);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This reset link is no longer valid" })).toBeFocused();
  await audit(page);
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
});

test("pending requests prevent double submission and failures allow retry", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route("**/api/v1/auth/reset-password", async (route) => {
    calls++;
    if (calls === 1) {
      await pending;
      await route.fulfill({ status: 503, json: { success: false, error: { code: "UNAVAILABLE", message: "Unavailable" } } });
    } else await route.fulfill({ json: ok });
  });
  await page.goto("/reset-password?token=fixture-token");
  await fillPasswords(page);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resetting password..." })).toBeDisabled();
  await expect(page.getByLabel("New password", { exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("We could not reset your password");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
  expect(calls).toBe(2);
});

test("reset remains accessible while a stored session cannot be restored", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("clouddrop.access-token", "fixture-session"));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 503, json: { success: false, error: { code: "UNAVAILABLE", message: "Unavailable" } } }));
  await page.goto("/reset-password?token=fixture-token");
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toBeEnabled();
});
