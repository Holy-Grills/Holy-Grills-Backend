import argon2 from "argon2";
import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";
import type { UserRole } from "../../shared/types/roles.js";

type ListUsersInput = {
  role?: UserRole;
  search?: string;
};

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  faculty?: string;
};

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  faculty: true,
  photoUrl: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

export const adminUsersService = {
  async listUsers(input: ListUsersInput) {
    const users = await prisma.user.findMany({
      where: {
        role: input.role,
        OR: input.search
          ? [
              { name: { contains: input.search, mode: "insensitive" } },
              { email: { contains: input.search, mode: "insensitive" } },
              { phone: { contains: input.search, mode: "insensitive" } }
            ]
          : undefined
      },
      select: adminUserSelect,
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return { users };
  },

  async createUser(input: CreateUserInput) {
    const email = input.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      throw appErrors.conflict("An account with this email already exists.", "EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        phone: input.phone,
        faculty: input.faculty,
        role: input.role,
        emailVerifiedAt: new Date()
      },
      select: adminUserSelect
    });

    return { user };
  }
};

