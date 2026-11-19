import { z } from "zod";

// Empty optional inputs mean "not provided"; the API rejects "".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || undefined)
    .optional();

const name = z.string().trim().min(1, "Required").max(120, "Keep it under 120 characters");
const email = z.email("Enter a valid email address").max(320);
const newPassword = z.string().min(8, "Use at least 8 characters").max(128, "Keep it under 128 characters");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128),
});

export const signUpSchema = z.object({
  name,
  email,
  password: newPassword,
  workspaceName: optionalText(120),
});

export const workspaceSchema = z.object({ name });

export const profileSchema = z.object({ name });

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(128),
  newPassword,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm").max(128),
  confirm: z.boolean().refine((v) => v, "Tick the box to confirm"),
});

export const memberSchema = z.object({
  email,
  role: z.enum(["viewer", "editor", "admin", "owner"]),
});

export const planSchema = z.object({
  brief: z.string().trim().min(10, "Describe the goal in at least 10 characters").max(4000),
  startDate: z.string().min(1, "Pick a start date"),
  days: z.coerce.number().int().min(1).max(31),
  postsPerWeekPerAccount: z.coerce.number().int().min(1).max(21),
});

export const connectSchema = z.object({
  credentials: z.record(z.string(), z.string().trim().min(1, "Required")),
  persona: z.enum(["individual", "influencer", "company"]),
  voice: optionalText(2000),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type WorkspaceValues = z.infer<typeof workspaceSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
export type PasswordValues = z.infer<typeof passwordSchema>;
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;
export type MemberValues = z.infer<typeof memberSchema>;
export type PlanValues = z.infer<typeof planSchema>;
export type ConnectValues = z.infer<typeof connectSchema>;
