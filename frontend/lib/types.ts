import { z } from "zod";

export const alertSeveritySchema = z.enum([
  "Low",
  "Medium",
  "High",
  "Critical",
]);

export const alertStatusSchema = z.enum([
  "New",
  "InProgress",
  "Escalated",
  "Resolved",
  "FalsePositive",
]);

export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type AlertStatus = z.infer<typeof alertStatusSchema>;

export const alertStatusEventSchema = z.object({
  previousStatus: alertStatusSchema,
  newStatus: alertStatusSchema,
  changedAt: z.string(),
  changedBy: z.string(),
});

export const alertSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: alertSeveritySchema,
  status: alertStatusSchema,
  source: z.string(),
  createdAt: z.string(),
  assignee: z.string().nullable(),
  updatedAt: z.string(),
  version: z.number().int().positive(),
  statusHistory: z.array(alertStatusEventSchema).nullish(),
});

export const alertListResponseSchema = z.object({
  data: z.array(alertSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    filtered: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    sources: z.array(z.string()),
  }),
});

export const alertDetailResponseSchema = z.object({
  data: alertSchema,
});

export const alertCountBucketSchema = z.object({
  label: z.string(),
  count: z.number().int().nonnegative(),
});

export const alertSummaryResponseSchema = z.object({
  data: z.object({
    total: z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
    unassigned: z.number().int().nonnegative(),
    lastUpdatedAt: z.string().nullable(),
    bySeverity: z.array(alertCountBucketSchema),
    byStatus: z.array(alertCountBucketSchema),
    bySource: z.array(alertCountBucketSchema),
    byAssignee: z.array(alertCountBucketSchema),
    createdByDay: z.array(alertCountBucketSchema),
  }),
});

export const updateAlertStatusResponseSchema = z.object({
  data: alertSchema,
});

export const updateAlertAssigneeResponseSchema = z.object({
  data: alertSchema,
});

export const importAlertsResponseSchema = z.object({
  imported: z.number().int().nonnegative(),
  message: z.string(),
});

export type Alert = z.infer<typeof alertSchema>;
export type AlertStatusEvent = z.infer<typeof alertStatusEventSchema>;
export type AlertListResponse = z.infer<typeof alertListResponseSchema>;
export type AlertDetailResponse = z.infer<typeof alertDetailResponseSchema>;
export type AlertCountBucket = z.infer<typeof alertCountBucketSchema>;
export type AlertSummaryResponse = z.infer<typeof alertSummaryResponseSchema>;
export type UpdateAlertStatusResponse = z.infer<
  typeof updateAlertStatusResponseSchema
>;
export type UpdateAlertAssigneeResponse = z.infer<
  typeof updateAlertAssigneeResponseSchema
>;
export type ImportAlertsResponse = z.infer<typeof importAlertsResponseSchema>;

export type SortDirection = "asc" | "desc";
export type AlertSortKey =
  | "id"
  | "title"
  | "severity"
  | "status"
  | "source"
  | "createdAt"
  | "assignee"
  | "updatedAt";
export type AlertSortTerm = {
  key: AlertSortKey;
  direction: SortDirection;
};

export const severityOptions = alertSeveritySchema.options;
export const statusOptions = alertStatusSchema.options;
