import { z } from 'zod';

export const emptySchema = z.object({});

export const SignInSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const SignUpStep1Schema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name too long'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,20}$/, 'Invalid phone number format'),
  roll_number: z.string().trim().min(2, 'Roll number too short').max(40, 'Roll number too long'),
});

export const SignUpStep2Schema = z
  .object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const SignUpSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,20}$/),
  roll_number: z.string().trim().min(2).max(40),
  email: z.string().trim().email(),
  password: z.string().min(8),
  college_id: z.string().uuid(),
  id_check_consent: z.boolean().default(false),
  rules_accepted: z.literal(true),
});

export const UpdateApplicationSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,20}$/),
  roll_number: z.string().trim().min(2).max(40),
  college_id: z.string().uuid(),
});

export const IssueTypeEnum = z.enum([
  'flat_tyre',
  'brakes',
  'chain',
  'damaged_qr',
  'bike_missing',
  'accident',
  'ride_close_request',
  'other',
]);

export const ReportIssueSchema = z.object({
  type: IssueTypeEnum,
  note: z.string().max(1000).optional().nullable(),
  bike_code: z.string().optional().nullable(),
  ride_id: z.string().uuid().optional().nullable(),
  stand_id: z.string().uuid().optional().nullable(),
  photo_path: z.string().optional().nullable(),
  ai_suggested_type: IssueTypeEnum.optional().nullable(),
});

export const CollegeSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  max_ride_minutes: z.number().int().min(15).max(1440),
  strike_limit: z.number().int().min(1).max(10),
  default_geofence_m: z.number().int().min(10).max(300),
  email_domains: z.array(
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  ),
  center_lat: z.number().nullable().optional(),
  center_lng: z.number().nullable().optional(),
  rules_text: z.string().max(8000).optional().nullable(),
});

export const UpsertStandSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  college_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  lat: z.number(),
  lng: z.number(),
  radius_m: z.number().int().min(10).max(300),
  capacity: z.number().int().min(1).max(200),
  active: z.boolean().default(true),
});

export const ModelRoutesSchema = z.object({
  router: z.array(z.string().min(3)).min(1).max(5),
  chat: z.array(z.string().min(3)).min(1).max(5),
  vision: z.array(z.string().min(3)).min(1).max(5),
  summary: z.array(z.string().min(3)).min(1).max(5),
});

export const AiSettingsSchema = z.object({
  monthly_cap_usd: z.number().min(0).max(5).optional(),
  daily_steps: z.number().int().positive().optional(),
  free_only: z.boolean().optional(),
  model_routes: ModelRoutesSchema.optional().nullable(),
});
