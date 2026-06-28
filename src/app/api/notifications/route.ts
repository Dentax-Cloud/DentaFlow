export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

async function getStaffForSession() {
  const session = await getServerAuthSession();
  if (!session?.user?.id || !session.user.activeTenantId) {
    return null;
  }

  const staffMember = await db.staffMember.findFirst({
    where: {
      authUserId: session.user.id,
      tenantId: session.user.activeTenantId,
      deletedAt: null,
    },
    select: { id: true, tenantId: true },
  });

  return staffMember;
}

export async function GET() {
  const staffMember = await getStaffForSession();
  if (!staffMember) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const notifications = await db.notification.findMany({
    where: {
      tenantId: staffMember.tenantId,
      recipientId: staffMember.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const unreadCount = await db.notification.count({
    where: {
      tenantId: staffMember.tenantId,
      recipientId: staffMember.id,
      isRead: false,
    },
  });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const staffMember = await getStaffForSession();
  if (!staffMember) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    notificationId?: string;
    markAllRead?: boolean;
  };

  if (body.markAllRead) {
    await db.notification.updateMany({
      where: {
        tenantId: staffMember.tenantId,
        recipientId: staffMember.id,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  } else if (body.notificationId) {
    await db.notification.updateMany({
      where: {
        id: body.notificationId,
        tenantId: staffMember.tenantId,
        recipientId: staffMember.id,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
