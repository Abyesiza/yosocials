import { z } from "zod";

// Empty optional inputs mean "not provided"; the API rejects "".
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer`)
    .transform((v) => v || undefined)
    .optional();

const name = z.string().trim().min(1, "Enter a name").max(120, "Use 120 characters or fewer");
const email = z.email("Enter an email address, like name@example.com").max(320, "Use 320 characters or fewer");
const newPassword = z.string().min(8, "Use at least 8 characters").max(128, "Use 128 characters or fewer");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128, "Use 128 characters or fewer"),
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
  currentPassword: z.string().min(1, "Enter your current password").max(128, "Use 128 characters or fewer"),
  newPassword,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm").max(128, "Use 128 characters or fewer"),
  confirm: z.boolean().refine((v) => v, "Tick the box to confirm"),
});

export const memberSchema = z.object({
  email,
  role: z.enum(["viewer", "editor", "admin", "owner"]),
});

export const planSchema = z.object({
  brief: z.string().trim().min(10, "Describe the goal in at least 10 characters").max(4000, "Use 4000 characters or fewer"),
  startDate: z.string().min(1, "Pick a start date"),
  days: z.coerce.number().int("Enter a whole number of days").min(1, "Plan at least 1 day").max(31, "Plan up to 31 days at a time"),
  postsPerWeekPerAccount: z.coerce.number().int("Enter a whole number of posts").min(1, "Choose at least 1 post a week").max(21, "Choose up to 21 posts a week"),
});

export const connectSchema = z.object({
  credentials: z.record(z.string(), z.string().trim().min(1, "Fill in this field")),
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
