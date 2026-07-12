import { expect, test } from "@playwright/test";

test("authenticated core surfaces load and security is populated", async ({ page, request }) => {
  const apiBaseUrl = process.env.RAGPILOT_E2E_API_BASE_URL ?? "http://localhost:18000/api/v1";
  const password = process.env.RAGPILOT_E2E_PASSWORD;
  expect(password, "RAGPILOT_E2E_PASSWORD must be configured for password_local acceptance").toBeTruthy();
  const loginResponse = await request.post(`${apiBaseUrl}/users/login`, {
    data: { email: "admin@ragpilot.local", display_name: "RagPilot Admin", password },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const authenticated = await loginResponse.json();

  await page.addInitScript((session) => {
    window.localStorage.setItem("ragpilot-auth-session", JSON.stringify(session));
  }, {
    userId: authenticated.user.id,
    displayName: authenticated.user.display_name,
    email: authenticated.user.email,
    role: authenticated.user.role,
    sessionToken: authenticated.session.session_token,
    sessionExpiresAt: authenticated.session.expires_at,
    lastSignedInAt: authenticated.user.last_signed_in_at,
    memberships: authenticated.user.memberships,
    permissions: authenticated.permissions,
  });

  for (const path of ["/", "/chat", "/documents", "/agents", "/operations", "/admin"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("Failed to fetch");
  }

  const modelResponse = await request.get(`${apiBaseUrl}/model-endpoints`, {
    headers: { Authorization: `Bearer ${authenticated.session.session_token}` },
  });
  expect(modelResponse.ok()).toBeTruthy();
  const [model] = await modelResponse.json();
  await page.goto(`/admin?section=runtime&runtime_resource=model_endpoint&model_endpoint_id=${model.id}`);
  await expect(page.getByRole("main").getByText("Runtime resources", { exact: true })).toBeVisible();
  await expect(page.getByText("Edit runtime resource", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Runtime resource saved.", { exact: true })).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Security" }).click();
  await expect(page.getByText("Account status", { exact: true })).toBeVisible();
  await expect(page.getByText("Active sessions", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change Password" })).toHaveCount(1);

  await page.evaluate(() => window.localStorage.setItem("ragpilot-language", "zh-CN"));
  await page.reload();
  await page.getByRole("button", { name: "安全中心" }).click();
  await expect(page.getByText("账号状态", { exact: true })).toBeVisible();
  await expect(page.getByText("活跃会话", { exact: true })).toBeVisible();

  await page.goto("/documents");
  await expect(page.getByPlaceholder("搜索文档")).toBeVisible();
  await expect(page.getByRole("button", { name: "导入网页" })).toBeVisible();
});
