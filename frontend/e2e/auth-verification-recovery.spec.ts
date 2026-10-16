import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const user = { id: "fixture-user", firstName: "Ada", lastName: "Review", email: "ada@example.test" };
const failure = (code: string) => ({ success: false, message: "Fixture error", error: { code } });
const success = { success: true, message: "Request accepted" };
const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
};
const register = async (page: Page) => {
  await page.goto("/register");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Review");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
};
const verify = async (page: Page) => {
  await page.getByLabel("Verification code", { exact: true }).fill("654321");
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  // Every API request stays in this fixture; never fall through to a real backend.
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 503, json: failure("UNAVAILABLE") }));
});

test("created account survives email delivery failure and resend retry", async ({ page }, info) => {
  let resends = 0;
  await page.route("**/auth/register", (route) => route.fulfill({ status: 503, json: failure("VERIFICATION_EMAIL_FAILED") }));
  await page.route("**/auth/resend-verification", (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: user.email });
    resends++;
    return route.fulfill({ status: resends === 1 ? 503 : 200, json: resends === 1 ? failure("VERIFICATION_EMAIL_FAILED") : success });
  });
  await page.route("**/auth/verify-email", (route) => route.fulfill({ json: { ...success, data: { user, token: "fixture-session" } } }));
  await register(page);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Your account was created");
  await expect(page.getByRole("alert")).toContainText("We could not send the verification email");
  await expect(page.getByLabel("Verification code")).toHaveAttribute("aria-invalid", "false");
  expect(resends).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token") === null)).toBe(true);
  await audit(page);
  await page.screenshot({ path: info.outputPath("created-email-delivery-failed.png"), fullPage: true, mask: [page.getByLabel("Verification code")] });
  await page.getByRole("button", { name: "Resend verification code" }).click();
  await expect(page.getByRole("alert")).toContainText("We could not send the verification email");
  await page.getByRole("button", { name: "Resend verification code" }).click();
  await expect(page.getByRole("status")).toContainText("If the account is eligible");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await audit(page);
  await verify(page);
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => !!sessionStorage.getItem("clouddrop.access-token"))).toBe(true);
});

test("duplicate registration and unverified login both offer verification recovery", async ({ page }, info) => {
  await page.route("**/auth/register", (route) => route.fulfill({ status: 409, json: failure("EMAIL_ALREADY_REGISTERED") }));
  await page.route("**/auth/login", (route) => route.fulfill({ status: 403, json: failure("EMAIL_NOT_VERIFIED") }));
  await register(page);
  await expect(page.getByRole("button", { name: "Finish email verification" })).toBeVisible();
  await audit(page);
  await page.getByRole("link", { name: "Sign in instead" }).click();
  // The register form has the same fields, so wait for sign-in before typing.
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Verify your email before signing in");
  await expect(page.getByRole("button", { name: "Resend verification code" })).toBeEnabled();
  await audit(page);
  await page.screenshot({ path: info.outputPath("unverified-login-recovery.png"), fullPage: true, mask: [page.getByLabel("Verification code")] });
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});

test("invalid credentials stay on sign-in without claiming verification is required", async ({ page }) => {
  await page.route("**/auth/login", (route) => route.fulfill({ status: 401, json: failure("INVALID_CREDENTIALS") }));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Wrong-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Incorrect email or password.");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend verification code" })).toHaveCount(0);
  await audit(page);
});

test("invalid codes, attempt limits and verification in another tab have clear actions", async ({ page }) => {
  let attempts = 0;
  await page.route("**/auth/register", (route) => route.fulfill({ status: 201, json: { ...success, data: { user } } }));
  await page.route("**/auth/verify-email", (route) => {
    attempts++;
    const code = attempts === 1 ? "INVALID_VERIFICATION_CODE" : attempts === 2 ? "VERIFICATION_ATTEMPTS_EXCEEDED" : "EMAIL_ALREADY_VERIFIED";
    return route.fulfill({ status: attempts === 2 ? 429 : attempts === 3 ? 409 : 400, json: failure(code) });
  });
  await register(page);
  await verify(page);
  await expect(page.getByRole("alert")).toContainText("incorrect or has expired");
  await expect(page.getByLabel("Verification code")).toBeFocused();
  await audit(page);
  await verify(page);
  await expect(page.getByRole("alert")).toContainText("Too many incorrect codes");
  await expect(page.getByRole("button", { name: "Resend verification code" })).toBeEnabled();
  await verify(page);
  await expect(page.getByRole("heading", { name: "Email already verified" })).toBeFocused();
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token") === null)).toBe(true);
  await audit(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(user.email);
});

test("an ambiguous registration failure offers recovery without claiming account creation", async ({ page }) => {
  await page.route("**/auth/register", (route) => route.fulfill({ status: 502, json: failure("UNAVAILABLE") }));
  await register(page);
  await expect(page.getByRole("alert")).toContainText("We could not confirm account creation");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Finish email verification" }).click();
  await expect(page.getByRole("status")).toContainText("If this account still needs verification");
  await expect(page.getByRole("status")).not.toContainText("Your account was created");
  await audit(page);
});
