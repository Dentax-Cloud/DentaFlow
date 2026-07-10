"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
  APPOINTMENT_CONFIRMED: "✅",
  APPOINTMENT_CANCELLED: "❌",
  APPOINTMENT_RESCHEDULED: "📅",
  PATIENT_ARRIVED: "🔔",
  PATIENT_IN_CHAIR: "🪑",
  APPOINTMENT_COMPLETED: "✓",
  CHAIR_READY: "🏥",
  CHAIR_LOW_STOCK: "⚠️",
  NEW_BOOKING_REQUEST: "📋",
  BOOKING_CONFIRMED: "✅",
  BOOKING_DECLINED: "❌",
  LAB_RESULT_READY: "🔬",
  INVOICE_PAID: "💰",
  CLAIM_SUGGESTED: "📑",
  RECALL_DUE: "📞",
  STALLED_PROCEDURE_LINE_WARN: "⏱️",
  STALLED_PROCEDURE_LINE_ESCALATED: "🚨",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: Notification[];
        unreadCount?: number;
      };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function handleMarkAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function handleClick(notif: Notification) {
    if (!notif.isRead) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notif.id }),
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
    }
    if (notif.link) {
      router.push(notif.link);
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          if (!isOpen) void fetchNotifications();
        }}
        className="relative rounded-lg p-2 transition-colors hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                    {unreadCount}
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => void handleClick(notif)}
                    className={`flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                      !notif.isRead ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-xl">
                      {TYPE_ICONS[notif.type] ?? "🔔"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`truncate text-sm font-medium ${
                            !notif.isRead ? "text-blue-900" : ""
                          }`}
                        >
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {notif.body}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
