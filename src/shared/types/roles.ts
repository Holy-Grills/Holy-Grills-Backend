export const userRoles = ["student", "kitchen", "rider", "admin"] as const;

export type UserRole = (typeof userRoles)[number];

