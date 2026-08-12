import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or phone is required')
    .refine(
      (value) => value.includes('@') || /^\+?[0-9]{7,15}$/.test(value),
      'Must be a valid email or phone number',
    ),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createCustomerSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY', 'SHOWROOM']),
  legalName: z.string().min(1).max(200),
  tradeName: z.string().max(200).optional(),
  taxNumber: z.string().max(50).optional(),
  creditLimit: z.number().nonnegative().optional(),
  paymentTermsDays: z.number().int().positive().max(365).optional(),
  preferredLocale: z.enum(['ar', 'en', 'he']).default('ar'),
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number')
    .optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const furnitureDimensionsSchema = z.object({
  widthCm: z.number().positive('Width must be greater than zero'),
  depthCm: z.number().positive('Depth must be greater than zero'),
  heightCm: z.number().positive('Height must be greater than zero'),
});

export const createQuotationLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().nonnegative().optional(),
  dimensions: furnitureDimensionsSchema.optional(),
  materialNotes: z.string().max(1000).optional(),
  fabricNotes: z.string().max(1000).optional(),
});

export type CreateQuotationLineInput = z.infer<typeof createQuotationLineSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().optional(),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;

const workflowCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be UPPER_SNAKE_CASE');

export const createWorkflowSchema = z.object({
  code: workflowCodeSchema,
  nameAr: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  nameHe: z.string().max(200).optional(),
  descriptionAr: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  descriptionHe: z.string().max(2000).optional(),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

export const workflowNodeSchema = z.object({
  stageDefinitionId: z.string().uuid(),
  nodeKey: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Node key must be UPPER_SNAKE_CASE'),
  sortOrder: z.number().int().min(0).default(0),
  isRequiredByDefault: z.boolean().default(true),
  canBeSkipped: z.boolean().default(false),
  defaultEstimatedMinutes: z.number().int().positive().nullable().optional(),
  responsibleDepartmentId: z.string().uuid().nullable().optional(),
  requiresInspectionOverride: z.boolean().nullable().optional(),
  requiresPhotosOverride: z.boolean().nullable().optional(),
  displayX: z.number().nullable().optional(),
  displayY: z.number().nullable().optional(),
});

export type WorkflowNodeInput = z.infer<typeof workflowNodeSchema>;

export const workflowEdgeSchema = z.object({
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
  dependencyType: z.enum(['HARD']).default('HARD'),
});

export type WorkflowEdgeInput = z.infer<typeof workflowEdgeSchema>;

export const publishWorkflowVersionSchema = z.object({
  revision: z.number().int().positive(),
  changelog: z.string().max(2000).optional(),
});

export type PublishWorkflowVersionInput = z.infer<typeof publishWorkflowVersionSchema>;
