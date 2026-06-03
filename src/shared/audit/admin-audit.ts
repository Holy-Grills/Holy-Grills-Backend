import { prisma } from "../database/prisma.js";

type WriteAdminAuditLogInput = {
  adminId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
};

export async function writeAdminAuditLog(input: WriteAdminAuditLogInput): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
}

