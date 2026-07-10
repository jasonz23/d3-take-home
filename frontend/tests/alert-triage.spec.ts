import { expect, test } from "@playwright/test";

const alerts = [
  {
    id: "alert-001",
    title: "Suspicious PowerShell execution",
    severity: "Critical",
    status: "New",
    source: "CrowdStrike",
    createdAt: "2026-07-09T18:00:00.000Z",
    assignee: null,
    updatedAt: "2026-07-09T18:00:00.000Z",
    version: 1,
    statusHistory: [],
  },
  {
    id: "alert-002",
    title: "Impossible travel sign-in detected",
    severity: "High",
    status: "InProgress",
    source: "Okta",
    createdAt: "2026-07-09T17:53:00.000Z",
    assignee: "Jason Zhao",
    updatedAt: "2026-07-09T17:53:00.000Z",
    version: 1,
    statusHistory: [],
  },
];

const listMeta = {
  total: 2,
  filtered: 2,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  sources: ["CrowdStrike", "Okta"],
};

const alertSummary = {
  data: {
    total: 2,
    unresolved: 2,
    critical: 1,
    unassigned: 1,
    lastUpdatedAt: "2026-07-09T18:06:00.000Z",
    bySeverity: [
      { label: "Critical", count: 1 },
      { label: "High", count: 1 },
      { label: "Medium", count: 0 },
      { label: "Low", count: 0 },
    ],
    byStatus: [
      { label: "New", count: 1 },
      { label: "InProgress", count: 1 },
      { label: "Escalated", count: 0 },
      { label: "Resolved", count: 0 },
      { label: "FalsePositive", count: 0 },
    ],
    bySource: [
      { label: "CrowdStrike", count: 1 },
      { label: "Okta", count: 1 },
    ],
    byAssignee: [
      { label: "Unassigned", count: 1 },
      { label: "Jason Zhao", count: 1 },
    ],
    createdByDay: [
      { label: "2026-07-09", count: 2 },
    ],
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/alerts/summary", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(alertSummary),
    });
  });

  await page.route("**/api/alerts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: alerts,
        meta: listMeta,
      }),
    });
  });

  await page.route("**/api/alerts?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: alerts,
        meta: listMeta,
      }),
    });
  });

  await page.route("**/api/alerts/alert-001", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: alerts[0] }),
    });
  });

  await page.route("**/api/alerts/alert-002", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: alerts[1] }),
    });
  });
});

test("loads alerts and opens shortcut help", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("table").getByText("Suspicious PowerShell execution"),
  ).toBeVisible();
  await expect(page.getByText("2 of 2 alerts")).toBeVisible();

  await page.keyboard.press("?");
  await expect(page.getByText("Keyboard shortcuts")).toBeVisible();
  await expect(page.getByText("Select next alert")).toBeVisible();
});

test("renders alert analytics charts from the API summary", async ({ page }) => {
  await page.goto("/charts");

  await expect(
    page.getByRole("heading", { name: "Alert Analytics" }),
  ).toBeVisible();
  await expect(page.getByText("Total alerts")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Status Distribution" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Status distribution chart" }))
    .toBeVisible();
  await expect(page.getByRole("img", { name: "Created over time chart" }))
    .toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(5);
});

test("updates selected alert status through the API", async ({ page }) => {
  let requestBody: unknown;

  await page.route("**/api/alerts/alert-001/status", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...alerts[0],
          status: "InProgress",
          updatedAt: "2026-07-09T18:05:00.000Z",
          version: 2,
          statusHistory: [
            {
              previousStatus: "New",
              newStatus: "InProgress",
              changedAt: "2026-07-09T18:05:00.000Z",
              changedBy: "demo-analyst",
            },
          ],
        },
      }),
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("table").getByText("Suspicious PowerShell execution"),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: alerts[0].title })).toBeVisible();

  await page.keyboard.press("2");

  await expect.poll(() => requestBody).toEqual({
    status: "InProgress",
    version: 1,
  });
  await expect(page.locator("aside").getByRole("combobox")).toHaveValue(
    "InProgress",
  );
});

test("updates selected alert assignee through the API", async ({ page }) => {
  let requestBody: unknown;

  await page.route("**/api/alerts/alert-001/assignee", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...alerts[0],
          assignee: "Maya Chen",
          updatedAt: "2026-07-09T18:06:00.000Z",
          version: 2,
          statusHistory: [],
        },
      }),
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("table").getByText("Suspicious PowerShell execution"),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: alerts[0].title })).toBeVisible();

  await page.getByLabel("Edit assignee").fill("Maya Chen");
  await page.getByRole("button", { name: "Save" }).click();

  await expect.poll(() => requestBody).toEqual({
    assignee: "Maya Chen",
    version: 1,
  });
  await expect(page.getByLabel("Edit assignee")).toHaveValue("Maya Chen");
  await expect(page.locator('[data-alert-row="alert-001"]')).toContainText(
    "Maya Chen",
  );
});

test("supports arrow-key row navigation and restores focus after closing drawer", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("table").getByText("Suspicious PowerShell execution"),
  ).toBeVisible();

  const firstRow = page.locator('[data-alert-row="alert-001"]');
  const secondRow = page.locator('[data-alert-row="alert-002"]');

  await firstRow.focus();
  await expect(firstRow).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(secondRow).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: alerts[1].title }),
  ).toBeVisible();
  await expect(page.locator("aside")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(secondRow).toBeFocused();
});

test("hydrates filters from the URL", async ({ page }) => {
  await page.goto("/?search=power&severity=Critical&status=New&source=Okta");

  await expect(page.getByLabel("Search alerts")).toHaveValue("power");
  await expect(page.getByLabel("Filter by severity")).toHaveValue("Critical");
  await expect(page.getByLabel("Filter by status")).toHaveValue("New");
  await expect(page.getByLabel("Filter by source")).toHaveValue("Okta");
});

test("keeps pagination and filters in the URL and API query", async ({ page }) => {
  await page.unroute("**/api/alerts");
  await page.unroute("**/api/alerts?**");

  const requestedSearches: string[] = [];

  await page.route("**/api/alerts**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname !== "/api/alerts") {
      await route.fulfill({ status: 404, body: "{}" });
      return;
    }

    requestedSearches.push(url.search);

    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const requestedPageSize = Number(url.searchParams.get("pageSize") ?? "25");

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: alerts,
        meta: {
          total: 50,
          filtered: 50,
          page: requestedPage,
          pageSize: requestedPageSize,
          totalPages: Math.ceil(50 / requestedPageSize),
          sources: ["CrowdStrike", "Okta"],
        },
      }),
    });
  });

  await page.goto("/?severity=Critical&page=2&pageSize=10");

  await expect(page.getByLabel("Filter by severity")).toHaveValue("Critical");
  await expect(page.getByLabel("Rows per page")).toHaveValue("10");
  await expect(page.getByText("Page 2 of 5")).toBeVisible();

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=3/);

  expect(
    requestedSearches.some((search) => {
      const params = new URLSearchParams(search);
      return (
        params.get("severity") === "Critical" &&
        params.get("page") === "2" &&
        params.get("pageSize") === "10"
      );
    }),
  ).toBe(true);
});

test("uploads an alerts JSON file through the API and refreshes the table", async ({
  page,
}) => {
  let importCalled = false;

  await page.route("**/api/alerts/import", async (route) => {
    importCalled = true;
    expect(route.request().method()).toBe("POST");

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        imported: 1,
        message: "Imported 1 alerts.",
      }),
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("table").getByText("Suspicious PowerShell execution"),
  ).toBeVisible();

  await page.getByLabel("Import alerts JSON").setInputFiles({
    name: "alerts.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          id: "alert-upload-001",
          title: "Uploaded suspicious PowerShell execution",
          severity: "Critical",
          status: "New",
          source: "CrowdStrike",
          createdAt: "2026-07-09T18:00:00.000Z",
          assignee: null,
        },
      ]),
    ),
  });

  await expect.poll(() => importCalled).toBe(true);
  await expect(page.getByRole("status")).toContainText("Imported 1 alerts");
});
