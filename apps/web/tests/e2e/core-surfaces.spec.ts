import { expect, test } from "@playwright/test";

test("authenticated product loop runs through UI, Temporal, retrieval, Chat, and feedback", async ({ page }) => {
  test.setTimeout(120_000);

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

  await page.goto("/login");
  await page.getByPlaceholder("Enter your email address").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Welcome back, RAGPilot E2E Admin", { exact: false })).toBeVisible();

  const currentUserResponse = await page.request.get(`${apiBaseUrl}/users/me`);
  expect(currentUserResponse.ok()).toBeTruthy();
  const currentUser = await currentUserResponse.json();

  const tenantResponse = await page.request.post(`${apiBaseUrl}/tenants`, {
    data: { name: "RAGPilot E2E Tenant", slug: "ragpilot-e2e" },
  });
  expect(tenantResponse.status()).toBe(201);
  const tenant = await tenantResponse.json();
  const tenantId = tenant.id;

  const membershipResponse = await page.request.post(`${apiBaseUrl}/users/${currentUser.id}/memberships`, {
    data: { tenant_id: tenantId, membership_status: "active" },
  });
  expect(membershipResponse.status()).toBe(201);

  const workspaceResponse = await page.request.post(`${apiBaseUrl}/workspaces`, {
    data: {
      tenant_id: tenantId,
      name: "RAGPilot E2E Workspace",
      slug: "ragpilot-e2e-workspace",
      description: "Isolated browser release gate.",
    },
  });
  expect(workspaceResponse.status()).toBe(201);
  const workspace = await workspaceResponse.json();

  const knowledgeBaseResponse = await page.request.post(`${apiBaseUrl}/knowledge-bases`, {
    data: {
      tenant_id: tenantId,
      workspace_id: workspace.id,
      name: "RAGPilot E2E Knowledge Base",
      slug: "ragpilot-e2e-knowledge-base",
      description: "Isolated browser release gate.",
    },
  });
  expect(knowledgeBaseResponse.status()).toBe(201);

  const signOutResponse = await page.request.post(`${apiBaseUrl}/users/me/sign-out`, {
    data: { reason: "Refresh the E2E session after assigning tenant membership." },
  });
  expect(signOutResponse.status()).toBe(204);
  await page.evaluate(() => window.localStorage.removeItem("ragpilot-auth-session"));
  await page.goto("/login");
  await page.getByPlaceholder("Enter your email address").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Welcome back, RAGPilot E2E Admin", { exact: false })).toBeVisible();

  const modelResponse = await page.request.get(`${apiBaseUrl}/model-endpoints`);
  expect(modelResponse.ok()).toBeTruthy();
  const models = await modelResponse.json();
  let model = models.find((candidate: { slug: string }) => candidate.slug === "ragpilot-e2e-deterministic");
  if (!model) {
    const createModelResponse = await page.request.post(`${apiBaseUrl}/model-endpoints`, {
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

  await page.goto("/documents");
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "ragpilot-temporal-contract-e2e.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# RAGPilot Temporal Contract E2E\n\nThe release verification code is cobalt-heron-742.\n",
    ),
  });

  const uploadResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/documents/upload") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Upload 1/ }).click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(201);
  const uploaded = await uploadResponse.json();
  expect(uploaded.workflow_run_id).toBeTruthy();

  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${apiBaseUrl}/workflow-runs/${uploaded.workflow_run_id}?tenant_id=${tenantId}`,
        );
        if (!response.ok()) {
          return `http-${response.status()}`;
        }
        const workflow = await response.json();
        return workflow.workflow_status;
      },
      { timeout: 90_000, intervals: [500, 1_000, 2_000] },
    )
    .toBe("completed");

  await page.goto("/chat");
  const question = "What is the release verification code?";
  await page.getByPlaceholder(/Ask a question|Ask a grounded question/).fill(question);
  await page.getByRole("button", { name: "Send Question", exact: true }).click();
  await expect(page.getByText("cobalt-heron-742", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("RAGPilot Temporal Contract E2E", { exact: false }).first()).toBeVisible();
  const feedbackResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/feedback?tenant_id=") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Mark helpful", exact: true }).click();
  const feedbackResponse = await feedbackResponsePromise;
  expect(feedbackResponse.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Helpful", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /release verification code/i }).first().click();
  await expect(page.getByRole("button", { name: "Helpful", exact: true })).toBeVisible();

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
