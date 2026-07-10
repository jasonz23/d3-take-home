import {
  alertDetailResponseSchema,
  alertSummaryResponseSchema,
  importAlertsResponseSchema,
  alertListResponseSchema,
  type ImportAlertsResponse,
  type AlertListResponse,
  type AlertSummaryResponse,
  type AlertStatus,
  type UpdateAlertAssigneeResponse,
  type UpdateAlertStatusResponse,
  updateAlertAssigneeResponseSchema,
  updateAlertStatusResponseSchema,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8182";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    message = "API request failed",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getAlerts(
  queryString = "",
): Promise<AlertListResponse> {
  const response = await fetch(`${API_URL}/api/alerts${queryString}`, {
    cache: "no-store",
  });

  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload, "Unable to load alerts");
  }

  return alertListResponseSchema.parse(payload);
}

export async function getAlert(id: string) {
  const response = await fetch(
    `${API_URL}/api/alerts/${encodeURIComponent(id)}`,
    {
      cache: "no-store",
    },
  );

  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload, "Unable to load alert details");
  }

  return alertDetailResponseSchema.parse(payload);
}

export async function getAlertSummary(): Promise<AlertSummaryResponse> {
  const response = await fetch(`${API_URL}/api/alerts/summary`, {
    cache: "no-store",
  });

  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload, "Unable to load alert analytics");
  }

  return alertSummaryResponseSchema.parse(payload);
}

export async function updateAlertStatus(
  id: string,
  status: AlertStatus,
  version: number,
): Promise<UpdateAlertStatusResponse> {
  const response = await fetch(
    `${API_URL}/api/alerts/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        version,
      }),
    },
  );

  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload, "Unable to update alert status");
  }

  return updateAlertStatusResponseSchema.parse(payload);
}

export async function updateAlertAssignee(
  id: string,
  assignee: string | null,
  version: number,
): Promise<UpdateAlertAssigneeResponse> {
  const response = await fetch(
    `${API_URL}/api/alerts/${encodeURIComponent(id)}/assignee`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignee,
        version,
      }),
    },
  );

  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload, "Unable to update alert assignee");
  }

  return updateAlertAssigneeResponseSchema.parse(payload);
}

export async function importAlerts(file: File): Promise<ImportAlertsResponse> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`${API_URL}/api/alerts/import`, {
    method: "POST",
    body: formData,
  });

  const payload: unknown = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload, "Unable to import alerts");
  }

  return importAlertsResponseSchema.parse(payload);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function toApiError(
  response: Response,
  payload: unknown,
  fallbackMessage: string,
) {
  const error =
    typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error?: { code?: string; message?: string } }).error
      : undefined;

  return new ApiError(
    response.status,
    error?.code,
    error?.message ?? fallbackMessage,
  );
}
