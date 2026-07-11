import { expect, test } from "@playwright/test";

test.describe("public launch surfaces", () => {
  test("landing explains the product and links to signup", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /serious roadmap for your next role/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /create free account/i })).toBeVisible();
    await expect(page.locator("#sample")).toBeVisible();
  });

  test("login page renders email/password form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();
  });

  test("legal pages are reachable", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /terms/i })).toBeVisible();
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
  });

  test("credits page shows free testing copy and help affordance", async ({ page }) => {
    await page.goto("/credits");
    await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
    await expect(page.getByRole("button", { name: "How credits work" })).toBeVisible();
    await expect(page.getByText(/free while we.re in testing/i)).toBeVisible();
  });
});

test.describe("authenticated happy path", () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "Set E2E_USER_EMAIL and E2E_USER_PASSWORD for the full signup→roadmap→profile flow.",
  );

  test("user can generate a roadmap and open profile", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.getByPlaceholder("Password").fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/app/);

    await page.getByRole("button", { name: "Frontend Engineer" }).click();
    await page.getByLabel("Send").click();
    await expect(page.getByText("Roadmap")).toBeVisible({ timeout: 120_000 });

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible();
  });
});
