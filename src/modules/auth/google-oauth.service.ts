import { env } from "../../shared/config/env.js";
import { prisma } from "../../shared/database/prisma.js";
import { appErrors } from "../../shared/errors/app-error.js";
import { getRedisClient } from "../../shared/redis/redis-client.js";
import { createOpaqueToken } from "../../shared/security/tokens.js";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
};

type OAuthUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "kitchen" | "rider" | "admin";
  createdAt: Date;
};

const statePrefix = "oauth:google:state:";
const stateTtlSeconds = 10 * 60;

function assertGoogleOAuthConfigured() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URL) {
    throw appErrors.badRequest("Google OAuth is not configured.", "GOOGLE_OAUTH_NOT_CONFIGURED");
  }
}

function safeRedirectTarget(redirectTo?: string): string {
  const fallback = `${env.APP_BASE_URL}/auth/oauth/callback`;

  if (!redirectTo) {
    return fallback;
  }

  try {
    const target = new URL(redirectTo);
    const allowedOrigins = new Set([
      new URL(env.APP_BASE_URL).origin,
      new URL(env.ADMIN_BASE_URL).origin,
      new URL(env.KITCHEN_BASE_URL).origin,
      new URL(env.RIDER_BASE_URL).origin
    ]);

    return allowedOrigins.has(target.origin) ? target.toString() : fallback;
  } catch {
    return fallback;
  }
}

async function exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URL
    })
  });

  if (!response.ok) {
    throw appErrors.unauthorized("Google OAuth code exchange failed.", "GOOGLE_CODE_EXCHANGE_FAILED");
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw appErrors.unauthorized("Google profile lookup failed.", "GOOGLE_PROFILE_LOOKUP_FAILED");
  }

  return (await response.json()) as GoogleProfile;
}

async function upsertGoogleUser(profile: GoogleProfile): Promise<OAuthUser> {
  if (!profile.email_verified) {
    throw appErrors.unauthorized("Google account email is not verified.", "GOOGLE_EMAIL_NOT_VERIFIED");
  }

  const existingByGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });

  if (existingByGoogleId) {
    return existingByGoogleId;
  }

  const email = profile.email.toLowerCase();
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true
    }
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        googleId: profile.sub,
        emailVerifiedAt: new Date(),
        photoUrl: profile.picture
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  }

  return prisma.user.create({
    data: {
      name: profile.name,
      email,
      googleId: profile.sub,
      emailVerifiedAt: new Date(),
      photoUrl: profile.picture,
      role: "student"
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });
}

export const googleOAuthService = {
  async createAuthorizationUrl(redirectTo?: string) {
    assertGoogleOAuthConfigured();

    const state = createOpaqueToken();
    const redis = getRedisClient();

    if (redis.status === "end" || redis.status === "close") {
      await redis.connect();
    }

    await redis.set(`${statePrefix}${state}`, safeRedirectTarget(redirectTo), "EX", stateTtlSeconds);

    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    authorizationUrl.searchParams.set("redirect_uri", env.GOOGLE_OAUTH_REDIRECT_URL);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "openid email profile");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("prompt", "select_account");

    return authorizationUrl.toString();
  },

  async completeCallback(code: string, state: string) {
    assertGoogleOAuthConfigured();

    const redis = getRedisClient();

    if (redis.status === "end" || redis.status === "close") {
      await redis.connect();
    }

    const stateKey = `${statePrefix}${state}`;
    const redirectTo = await redis.get(stateKey);
    await redis.del(stateKey);

    if (!redirectTo) {
      throw appErrors.unauthorized("Google OAuth state is invalid or expired.", "GOOGLE_OAUTH_STATE_INVALID");
    }

    const token = await exchangeCodeForToken(code);
    const profile = await fetchGoogleProfile(token.access_token);
    const user = await upsertGoogleUser(profile);

    return { user, redirectTo };
  }
};

