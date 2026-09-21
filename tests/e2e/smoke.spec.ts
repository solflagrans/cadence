import { expect, test } from "@playwright/test";

test("blank page loads without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Priority");
  await expect(page.locator("body")).toHaveText("");
  expect(errors).toEqual([]);
});

test("unconfigured authentication fails explicitly without leaking secrets", async ({ request }) => {
  const response = await request.get("/api/auth/get-session");
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Authentication is not configured" });
});
