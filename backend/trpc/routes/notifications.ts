import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import type { DriveMeetup } from "@/types/meetup";

import { getDbConfig } from "../db";

const { endpoint: DB_ENDPOINT, namespace: DB_NAMESPACE, token: DB_TOKEN } = getDbConfig();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface UserWithToken {
  id: string;
  displayName: string;
  pushToken: string;
  country?: string;
  carBrand?: string;
  carModel?: string;
}

interface TripData {
  id: string;
  userId: string;
  startTime: number;
  distance: number;
  duration: number;
  topSpeed: number;
  avgSpeed: number;
  corners: number;
}

interface WeeklyStats {
  totalTrips: number;
  totalDistance: number;
  topSpeed: number;
  totalDuration: number;
  corners: number;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  data?: Record<string, unknown>;
  channelId?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function sendExpoPushNotification(message: ExpoPushMessage): Promise<boolean> {
  console.log("[PUSH] Sending notification to:", message.to.substring(0, 30) + "...");
  
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: message.to,
        title: message.title,
        body: message.body,
        sound: message.sound || "default",
        data: message.data || {},
        channelId: message.channelId || "default",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[PUSH] API error:", response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log("[PUSH] API response:", JSON.stringify(result));
    
    const ticket = result.data?.[0] as ExpoPushTicket | undefined;
    if (ticket?.status === "error") {
      console.error("[PUSH] Ticket error:", ticket.message, ticket.details);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("[PUSH] Network error:", error);
    return false;
  }
}

async function sendBatchNotifications(messages: ExpoPushMessage[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const chunks: ExpoPushMessage[][] = [];
  const chunkSize = 100;
  
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map(msg => ({
          to: msg.to,
          title: msg.title,
          body: msg.body,
          sound: msg.sound || "default",
          data: msg.data || {},
          channelId: msg.channelId || "default",
        }))),
      });

      if (response.ok) {
        const result = await response.json();
        const tickets = (result.data || []) as ExpoPushTicket[];
        sent += tickets.filter(t => t.status === "ok").length;
        failed += tickets.filter(t => t.status !== "ok").length;
      } else {
        failed += chunk.length;
      }
    } catch (error) {
      console.error("[PUSH] Batch error:", error);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

async function getUsersWithPushTokens(): Promise<UserWithToken[]> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    console.log("[PUSH] Database not configured");
    return [];
  }

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/users`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[PUSH] Failed to fetch users");
      return [];
    }

    const data = await response.json();
    const users = data.items || data || [];
    return users.filter((u: any) => u.pushToken);
  } catch (error) {
    console.error("[PUSH] Error fetching users:", error);
    return [];
  }
}

async function getAllMeetups(): Promise<DriveMeetup[]> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    return [];
  }

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/meetups`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.items || data || [];
  } catch (error) {
    console.error("[PUSH] Error fetching meetups:", error);
    return [];
  }
}

async function storeMeetup(meetup: DriveMeetup): Promise<boolean> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) return false;

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/meetups`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(meetup),
    });

    return response.ok;
  } catch (error) {
    console.error("[PUSH] Error storing meetup:", error);
    return false;
  }
}

async function updateMeetup(meetupId: string, updates: Partial<DriveMeetup>): Promise<boolean> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) return false;

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/meetups/${meetupId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    return response.ok;
  } catch (error) {
    console.error("[PUSH] Error updating meetup:", error);
    return false;
  }
}

async function getAllTrips(): Promise<TripData[]> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) return [];

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/trips`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.items || data || [];
  } catch (error) {
    console.error("[PUSH] Error fetching trips:", error);
    return [];
  }
}

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday - 7);
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  
  return { start: lastMonday, end: lastSunday };
}

function calculateUserWeeklyStats(trips: TripData[], userId: string, weekStart: Date, weekEnd: Date): WeeklyStats {
  const userTrips = trips.filter(trip => {
    const tripDate = new Date(trip.startTime);
    return trip.userId === userId && tripDate >= weekStart && tripDate <= weekEnd;
  });

  if (userTrips.length === 0) {
    return { totalTrips: 0, totalDistance: 0, topSpeed: 0, totalDuration: 0, corners: 0 };
  }

  return {
    totalTrips: userTrips.length,
    totalDistance: userTrips.reduce((sum, t) => sum + t.distance, 0),
    topSpeed: Math.max(...userTrips.map(t => t.topSpeed)),
    totalDuration: userTrips.reduce((sum, t) => sum + t.duration, 0),
    corners: userTrips.reduce((sum, t) => sum + t.corners, 0),
  };
}

function generateNotificationContent(displayName: string, stats: WeeklyStats): { title: string; body: string } {
  if (stats.totalTrips === 0) {
    return {
      title: "📊 Weekly Recap Ready",
      body: `Hey ${displayName}! No trips this week? Time to hit the road! 🛣️`,
    };
  }

  const highlights: string[] = [];
  
  if (stats.totalTrips >= 5) {
    highlights.push(`🔥 ${stats.totalTrips} trips`);
  } else {
    highlights.push(`${stats.totalTrips} trip${stats.totalTrips > 1 ? 's' : ''}`);
  }
  
  highlights.push(`${stats.totalDistance.toFixed(1)} km`);
  
  if (stats.topSpeed >= 150) {
    highlights.push(`⚡ ${Math.round(stats.topSpeed)} km/h top`);
  }

  return {
    title: "📊 Your Weekly Recap is Ready!",
    body: `Hey ${displayName}! This week: ${highlights.join(' • ')}. Tap to see full stats!`,
  };
}

export const notificationsRouter = createTRPCRouter({
  sendTestNotification: publicProcedure
    .input(z.object({
      pushToken: z.string(),
      title: z.string().optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log("[PUSH] sendTestNotification called");
      console.log("[PUSH] Token:", input.pushToken.substring(0, 30) + "...");
      
      const title = input.title || "🚗 Test Notification";
      const body = input.body || "Push notifications are working! You'll receive weekly recaps here.";

      const success = await sendExpoPushNotification({
        to: input.pushToken,
        title,
        body,
        data: { type: "test" },
      });

      console.log("[PUSH] sendTestNotification result:", success);
      return { success };
    }),

  sendWeeklyRecapNotifications: publicProcedure
    .input(z.object({
      userId: z.string().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      console.log("[PUSH] Starting weekly recap notifications...");

      const users = await getUsersWithPushTokens();
      const trips = await getAllTrips();
      const { start, end } = getWeekRange();

      const usersToNotify = input?.userId
        ? users.filter(u => u.id === input.userId)
        : users;

      if (usersToNotify.length === 0) {
        return { success: true, message: "No users with push tokens", sent: 0, failed: 0 };
      }

      const messages: ExpoPushMessage[] = usersToNotify.map(user => {
        const stats = calculateUserWeeklyStats(trips, user.id, start, end);
        const { title, body } = generateNotificationContent(user.displayName, stats);
        return {
          to: user.pushToken,
          title,
          body,
          data: { type: "weekly_recap", stats },
          channelId: "weekly-recap",
        };
      });

      const { sent, failed } = await sendBatchNotifications(messages);

      console.log(`[PUSH] Weekly recap: ${sent} sent, ${failed} failed`);
      return { success: true, totalUsers: usersToNotify.length, sent, failed };
    }),

  sendCustomNotification: publicProcedure
    .input(z.object({
      userId: z.string().optional(),
      title: z.string(),
      body: z.string(),
      data: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const users = await getUsersWithPushTokens();
      
      const usersToNotify = input.userId
        ? users.filter(u => u.id === input.userId)
        : users;

      if (usersToNotify.length === 0) {
        return { success: false, message: "No users with push tokens", sent: 0 };
      }

      const messages: ExpoPushMessage[] = usersToNotify.map(user => ({
        to: user.pushToken,
        title: input.title,
        body: input.body,
        data: input.data,
      }));

      const { sent, failed } = await sendBatchNotifications(messages);
      return { success: true, sent, failed };
    }),

  sendDrivePing: publicProcedure
    .input(z.object({
      fromUserId: z.string(),
      fromUserName: z.string(),
      fromUserCar: z.string().optional(),
      toUserId: z.string(),
      toUserName: z.string(),
      toUserCar: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log("[PUSH] Drive ping from", input.fromUserName, "to", input.toUserId);
      
      const users = await getUsersWithPushTokens();
      const targetUser = users.find(u => u.id === input.toUserId);

      if (!targetUser) {
        return { success: false, message: "User not found or notifications not enabled" };
      }

      const meetupId = `meetup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const meetup: DriveMeetup = {
        id: meetupId,
        fromUserId: input.fromUserId,
        fromUserName: input.fromUserName,
        fromUserCar: input.fromUserCar,
        toUserId: input.toUserId,
        toUserName: input.toUserName,
        toUserCar: input.toUserCar,
        status: 'pending',
        createdAt: Date.now(),
      };

      await storeMeetup(meetup);

      const carInfo = input.fromUserCar ? ` (${input.fromUserCar})` : '';
      const success = await sendExpoPushNotification({
        to: targetUser.pushToken,
        title: "🚗 Drive Invite!",
        body: `${input.fromUserName}${carInfo} wants to go for a drive with you!`,
        data: { 
          type: "drive_ping", 
          meetupId,
          fromUserId: input.fromUserId,
          fromUserName: input.fromUserName,
        },
      });

      return { success, meetupId };
    }),

  respondToPing: publicProcedure
    .input(z.object({
      meetupId: z.string(),
      response: z.enum(['accepted', 'declined']),
      responderId: z.string(),
      responderName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const meetups = await getAllMeetups();
      const meetup = meetups.find(m => m.id === input.meetupId);

      if (!meetup) return { success: false, message: "Meetup not found" };
      if (meetup.toUserId !== input.responderId) return { success: false, message: "Not authorized" };

      const updated = await updateMeetup(input.meetupId, {
        status: input.response,
        respondedAt: Date.now(),
      });

      if (!updated) return { success: false, message: "Failed to update meetup" };

      const users = await getUsersWithPushTokens();
      const pinger = users.find(u => u.id === meetup.fromUserId);

      if (pinger) {
        const title = input.response === 'accepted' ? "✅ Drive Accepted!" : "❌ Drive Declined";
        const body = input.response === 'accepted'
          ? `${input.responderName} accepted your drive invite!`
          : `${input.responderName} declined your drive invite.`;

        await sendExpoPushNotification({
          to: pinger.pushToken,
          title,
          body,
          data: {
            type: input.response === 'accepted' ? 'ping_accepted' : 'ping_declined',
            meetupId: input.meetupId,
            fromUserId: input.responderId,
            fromUserName: input.responderName,
          },
        });
      }

      return { success: true, status: input.response };
    }),

  shareLocation: publicProcedure
    .input(z.object({
      meetupId: z.string(),
      userId: z.string(),
      userName: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    }))
    .mutation(async ({ input }) => {
      const meetups = await getAllMeetups();
      const meetup = meetups.find(m => m.id === input.meetupId);

      if (!meetup) return { success: false, message: "Meetup not found" };
      if (meetup.status !== 'accepted') return { success: false, message: "Meetup not accepted" };

      const isFromUser = meetup.fromUserId === input.userId;
      const isToUser = meetup.toUserId === input.userId;

      if (!isFromUser && !isToUser) return { success: false, message: "Not authorized" };

      const locationData = {
        latitude: input.latitude,
        longitude: input.longitude,
        timestamp: Date.now(),
      };

      const updateField = isToUser ? 'toUserLocation' : 'fromUserLocation';
      const updated = await updateMeetup(input.meetupId, { [updateField]: locationData });

      if (!updated) return { success: false, message: "Failed to share location" };

      const users = await getUsersWithPushTokens();
      const otherUserId = isToUser ? meetup.fromUserId : meetup.toUserId;
      const otherUser = users.find(u => u.id === otherUserId);

      if (otherUser) {
        await sendExpoPushNotification({
          to: otherUser.pushToken,
          title: "📍 Location Shared!",
          body: `${input.userName} shared their location for the meetup.`,
          data: {
            type: 'location_shared',
            meetupId: input.meetupId,
            fromUserId: input.userId,
            latitude: input.latitude,
            longitude: input.longitude,
          },
        });
      }

      return { success: true };
    }),

  getMeetups: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const meetups = await getAllMeetups();
      
      const userMeetups = meetups.filter(m => 
        (m.fromUserId === input.userId || m.toUserId === input.userId) &&
        (m.status === 'pending' || m.status === 'accepted')
      );

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return userMeetups.filter(m => m.createdAt > oneDayAgo);
    }),

  cancelMeetup: publicProcedure
    .input(z.object({
      meetupId: z.string(),
      userId: z.string(),
      userName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const meetups = await getAllMeetups();
      const meetup = meetups.find(m => m.id === input.meetupId);

      if (!meetup) return { success: false, message: "Meetup not found" };

      const isParticipant = meetup.fromUserId === input.userId || meetup.toUserId === input.userId;
      if (!isParticipant) return { success: false, message: "Not authorized" };

      await updateMeetup(input.meetupId, { status: 'cancelled' });

      const users = await getUsersWithPushTokens();
      const otherUserId = meetup.fromUserId === input.userId ? meetup.toUserId : meetup.fromUserId;
      const otherUser = users.find(u => u.id === otherUserId);

      if (otherUser) {
        await sendExpoPushNotification({
          to: otherUser.pushToken,
          title: "❌ Meetup Cancelled",
          body: `${input.userName} cancelled the drive meetup.`,
          data: { type: 'meetup_cancelled', meetupId: input.meetupId },
        });
      }

      return { success: true };
    }),
});
