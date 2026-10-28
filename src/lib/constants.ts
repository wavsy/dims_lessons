export const SUBJECTS = ["math", "english", "informatics", "conditioning"] as const;
export const PLATFORMS = ["paper", "notes", "physical", "whiteboard", "tablet", "other_digital", "mixed"] as const;
export const LOCATIONS = ["in_person", "online"] as const;
export const BILLING_MODES = ["per_lesson", "per_hour", "prepaid"] as const;
export const KINDS = ["student", "parent"] as const;

export type Subject = (typeof SUBJECTS)[number];
export type Platform = (typeof PLATFORMS)[number];
export type Location = (typeof LOCATIONS)[number];
export type BillingMode = (typeof BILLING_MODES)[number];
export type Kind = (typeof KINDS)[number];

export function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}
