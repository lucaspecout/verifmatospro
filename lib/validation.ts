import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(4)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(4),
  newPassword: z.string().min(8)
});

export const userSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'CHEF', 'MATERIEL']),
  isActive: z.boolean().optional()
});

export const catalogSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  unit: z.string().optional(),
  description: z.string().optional(),
  isConsumable: z.boolean(),
  isElectronic: z.boolean(),
  defaultRequiresExpiryCheck: z.boolean(),
  defaultRequiresFunctionalCheck: z.boolean()
});

export const vehicleSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  identifier: z.string().min(1),
  isActive: z.boolean().optional()
});

export const bagSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  vehicleId: z.string().uuid().nullable().optional(),
  locationType: z.enum(['VEHICLE', 'WAREHOUSE'])
});

export const compartmentSchema = z.object({
  bagId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().min(0)
});

export const stockSchema = z.object({
  itemCatalogId: z.string().uuid(),
  locationType: z.enum(['WAREHOUSE', 'VEHICLE', 'BAG', 'COMPARTMENT']),
  vehicleId: z.string().uuid().nullable().optional(),
  bagId: z.string().uuid().nullable().optional(),
  compartmentId: z.string().uuid().nullable().optional(),
  theoreticalQty: z.number().int().min(0)
});

export const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  versionDate: z.string().min(1)
});

export const templateSectionSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().min(0),
  visualHint: z.string().optional().nullable()
});

export const templateItemSchema = z.object({
  sectionId: z.string().uuid(),
  label: z.string().min(1),
  expectedQuantity: z.number().int().min(1),
  unit: z.string().optional().nullable(),
  requiresExpiryCheck: z.boolean(),
  requiresFunctionalCheck: z.boolean(),
  isElectronic: z.boolean(),
  isConsumable: z.boolean()
});

export const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'DONE']).optional(),
  templateId: z.string().uuid().optional().nullable()
});

export const eventChecklistSectionSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().min(0)
});

export const eventChecklistItemSchema = z.object({
  sectionId: z.string().uuid(),
  itemCatalogId: z.string().uuid().optional().nullable(),
  label: z.string().min(1),
  expectedQuantity: z.number().int().min(1),
  unit: z.string().optional().nullable(),
  order: z.number().int().min(0),
  requiresExpiryCheck: z.boolean(),
  requiresFunctionalCheck: z.boolean()
});

export const publicLineSchema = z.object({
  lineId: z.string().uuid(),
  status: z.enum(['OK', 'MISSING']),
  comment: z.string().optional().nullable(),
  checkedByLabel: z.string().optional().nullable()
});
