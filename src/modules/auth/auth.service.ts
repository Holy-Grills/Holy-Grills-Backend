import argon2 from "argon2";
import { env } from "../../shared/config/env.js";
import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";
import { createOpaqueToken, durationToDate, hashToken } from "../../shared/security/tokens.js";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  dob?: string;
  faculty?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type BootstrapAdminInput = {
  name: string;
  email: string;
  password: string;
  bootstrapToken: string;
};

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true
} as const;

async function createRefreshToken(userId: string): Promise<string> {
  const refreshToken = createOpaqueToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: durationToDate(env.JWT_REFRESH_EXPIRES_IN)
    }
  });

  return refreshToken;
}

export const authService = {
  async createSessionForUser(userId: string) {
    const refreshToken = await createRefreshToken(userId);

    return { refreshToken };
  },

  async bootstrapAdmin(input: BootstrapAdminInput) {
    if (!env.ADMIN_BOOTSTRAP_TOKEN || input.bootstrapToken !== env.ADMIN_BOOTSTRAP_TOKEN) {
      throw appErrors.forbidden("Admin bootstrap token is invalid.", "INVALID_BOOTSTRAP_TOKEN");
    }

    const existingAdmin = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true }
    });

    if (existingAdmin) {
      throw appErrors.conflict("An admin account already exists.", "ADMIN_ALREADY_EXISTS");
    }

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
        role: "admin",
        emailVerifiedAt: new Date()
      },
      select: safeUserSelect
    });
    const refreshToken = await createRefreshToken(user.id);

    return { user, refreshToken };
  },

  async register(input: RegisterInput) {
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
        dob: input.dob ? new Date(input.dob) : null,
        faculty: input.faculty,
        role: "student"
      },
      select: safeUserSelect
    });

    const refreshToken = await createRefreshToken(user.id);

    return { user, refreshToken };
  },

  async login(rawInput: LoginInput) {
    const input = {
      ...rawInput,
      email: rawInput.email.toLowerCase()
    };

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...safeUserSelect,
        passwordHash: true
      }
    });

    if (!user?.passwordHash) {
      throw appErrors.unauthorized("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const passwordIsValid = await argon2.verify(user.passwordHash, input.password);

    if (!passwordIsValid) {
      throw appErrors.unauthorized("Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    const refreshToken = await createRefreshToken(safeUser.id);

    return { user: safeUser, refreshToken };
  },

  async refreshSession(refreshToken: string) {
    const existingToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          select: safeUserSelect
        }
      }
    });

    if (!existingToken) {
      throw appErrors.unauthorized("Refresh token is invalid or expired.", "INVALID_REFRESH_TOKEN");
    }

    const nextRefreshToken = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existingToken.id },
        data: { revokedAt: new Date() }
      });

      const token = createOpaqueToken();

      await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: hashToken(token),
          expiresAt: durationToDate(env.JWT_REFRESH_EXPIRES_IN)
        }
      });

      return token;
    });

    return { user: existingToken.user, refreshToken: nextRefreshToken };
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { success: true };
  }
};
