import { expect, test } from "@playwright/test";

test("authenticated core surfaces load and security is populated", async ({ page }) => {
  const apiBaseUrl = process.env.RAGPILOT_E2E_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const email = process.env.RAGPILOT_E2E_EMAIL ?? "admin@ragpilot.local";
  const password = process.env.RAGPILOT_E2E_PASSWORD;
  expect(password, "RAGPILOT_E2E_PASSWORD must be configured for password_local acceptance").toBeTruthy();

  const bootstrapStatusResponse = await page.request.get(`${apiBaseUrl}/users/bootstrap/status`);
  expect(bootstrapStatusResponse.ok()).toBeTruthy();
  const bootstrapStatus = await bootstrapStatusResponse.json();
  if (!bootstrapStatus.has_users) {
    const bootstrapResponse = await page.request.post(`${apiBaseUrl}/users/bootstrap`, {
      data: { email, display_name: "RAGPilot E2E Admin", password },
    });
    expect(bootstrapResponse.ok()).toBeTruthy();
  }

  const loginResponse = await page.request.post(`${apiBaseUrl}/users/login`, {
    data: { email, display_name: "RAGPilot E2E Admin", password },
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

  const authorizationHeaders = { Authorization: `Bearer ${authenticated.session.session_token}` };
  const modelResponse = await page.request.get(`${apiBaseUrl}/model-endpoints`, {
    headers: authorizationHeaders,
  });
  expect(modelResponse.ok()).toBeTruthy();
  const models = await modelResponse.json();
  let model = models.find((candidate: { slug: string }) => candidate.slug === "ragpilot-e2e-deterministic");
  if (!model) {
    const createModelResponse = await page.request.post(`${apiBaseUrl}/model-endpoints`, {
      headers: authorizationHeaders,
      data: {
        name: "RAGPilot E2E Deterministic",
        slug: "ragpilot-e2e-deterministic",
        provider_type: "deterministic",
        model_name: "ragpilot-e2e-deterministic",
        base_url: null,
        credential_mode: "none",
        credential_key_hint: null,
        capabilities: ["chat"],
        is_enabled: true,
        is_default: false,
        notes: "Created by the isolated authenticated E2E release gate.",
      },
    });
    expect(createModelResponse.ok()).toBeTruthy();
    model = await createModelResponse.json();
  }
  expect(model).toBeTruthy();
  await page.goto(`/admin?section=runtime&runtime_resource=model_endpoint&model_endpoint_id=${model.id}`);
  await expect(page.getByRole("main").getByText("AI runtime configuration", { exact: true })).toBeVisible();
  await expect(page.getByText("Edit runtime resource", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Runtime resource saved.", { exact: true })).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await expect(page.getByText("Account status", { exact: true })).toBeVisible();
  await expect(page.getByText("Active sessions", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Security" }).click();
  await expect(page.getByRole("button", { name: "Update Password" })).toHaveCount(1);

  await page.evaluate(() => window.localStorage.setItem("ragpilot-language", "zh-CN"));
  await page.reload();
  await page.getByRole("button", { name: "会话管理" }).click();
  await expect(page.getByText("账号状态", { exact: true })).toBeVisible();
  await expect(page.getByText("活跃会话", { exact: true })).toBeVisible();

  await page.goto("/documents");
  await expect(page.getByPlaceholder("搜索文档")).toBeVisible();
  await page.getByRole("button", { name: "添加文档" }).click();
  await expect(page.getByRole("button", { name: "导入网页" })).toBeVisible();
});
