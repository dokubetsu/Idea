import { z } from "zod";

/** Registration password policy shared by forms and unit tests. */
export const passwordSchema = z
  .string()
  .min(10, "Min 10 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a special character");

export const registerFormSchema = z.object({
  full_name: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
  password: passwordSchema,
  city: z.string().optional(),
  state: z.string().optional(),
});

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
