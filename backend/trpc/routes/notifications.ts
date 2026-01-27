import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import type { DriveMeetup, MeetupStatus } from "@/types/meetup";

const DB_ENDPOINT = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
const DB_NAMESPACE = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
const DB_TOKEN = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

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
  maxGForce?: number;
  time0to100?: number;
  corners: number;
}

interface WeeklyStats {
  totalTrips: number;
  totalDistance: number;
  topSpeed: number;
  totalDuration: number;
  corners: number;
}

async function getUsersWithPushTokens(): Promise<UserWithToken[]> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    console.log("Database not configured");
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
      console.error("Failed to fetch users");
      return [];
    }

    const data = await response.json();
    const users = data.items || data || [];
    return users.filter((u: any) => u.pushToken);
  } catch (error) {
    console.error("Error fetching users:", error);
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

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.items || data || [];
  } catch (error) {
    console.error("Error fetching meetups:", error);
    return [];
  }
}

async function storeMeetup(meetup: DriveMeetup): Promise<boolean> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    return false;
  }

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
    console.error("Error storing meetup:", error);
    return false;
  }
}

async function updateMeetup(meetupId: string, updates: Partial<DriveMeetup>): Promise<boolean> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    return false;
  }

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
    console.error("Error updating meetup:", error);
    return false;
  }
}

async function getAllTrips(): Promise<TripData[]> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    return [];
  }

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/trips`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.items || data || [];
  } catch (error) {
    console.error("Error fetching trips:", error);
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
    return {
      totalTrips: 0,
      totalDistance: 0,
      topSpeed: 0,
      totalDuration: 0,
      corners: 0,
    };
  }

  return {
    totalTrips: userTrips.length,
    totalDistance: userTrips.reduce((sum, t) => sum + t.distance, 0),
    topSpeed: Math.max(...userTrips.map(t => t.topSpeed)),
    totalDuration: userTrips.reduce((sum, t) => sum + t.duration, 0),
    corners: userTrips.reduce((sum, t) => sum + t.corners, 0),
  };
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

// Export for potential future use
export { formatDuration };

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

async function sendExpoPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: "default",
        data: data || { type: "weekly_recap" },
        channelId: "weekly-recap",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send push notification:", error);
      return false;
    }

    const result = await response.json();
    console.log("Push notification sent:", result);
    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
}

async function sendBatchPushNotifications(
  messages: { to: string; title: string; body: string; data?: Record<string, unknown> }[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const chunks: typeof messages[] = [];
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
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
          sound: "default",
          data: msg.data || { type: "weekly_recap" },
          channelId: "weekly-recap",
        }))),
      });

      if (response.ok) {
        const result = await response.json();
        const tickets = result.data || [];
        sent += tickets.filter((t: any) => t.status === "ok").length;
        failed += tickets.filter((t: any) => t.status !== "ok").length;
      } else {
        failed += chunk.length;
      }
    } catch (error) {
      console.error("Error sending batch notifications:", error);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

export const notificationsRouter = createTRPCRouter({
  sendWeeklyRecapNotifications: publicProcedure
    .input(z.object({
      userId: z.string().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      console.log("Starting weekly recap push notifications job...");

      const users = await getUsersWithPushTokens();
      const trips = await getAllTrips();
      const { start, end } = getWeekRange();

      const usersToNotify = input?.userId
        ? users.filter(u => u.id === input.userId)
        : users;

      if (usersToNotify.length === 0) {
        return {
          success: true,
          message: "No users with push tokens found",
          sent: 0,
          failed: 0,
        };
      }

      const messages = usersToNotify.map(user => {
        const stats = calculateUserWeeklyStats(trips, user.id, start, end);
        const { title, body } = generateNotificationContent(user.displayName, stats);
        return {
          to: user.pushToken,
          title,
          body,
          data: { type: "weekly_recap", stats },
        };
      });

      const { sent, failed } = await sendBatchPushNotifications(messages);

      console.log(`Weekly recap notifications: ${sent} sent, ${failed} failed`);

      return {
        success: true,
        totalUsers: usersToNotify.length,
        sent,
        failed,
      };
    }),

  sendTestNotification: publicProcedure
    .input(z.object({
      pushToken: z.string(),
      title: z.string().optional(),
      body: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const title = input.title || "🚗 Test Notification";
      const body = input.body || "If you see this, push notifications are working!";

      const success = await sendExpoPushNotification(input.pushToken, title, body, { type: "test" });

      return { success };
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
        return {
          success: false,
          message: "No users with push tokens found",
          sent: 0,
        };
      }

      const messages = usersToNotify.map(user => ({
        to: user.pushToken,
        title: input.title,
        body: input.body,
        data: input.data,
      }));

      const { sent, failed } = await sendBatchPushNotifications(messages);

      return {
        success: true,
        sent,
        failed,
      };
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
      console.log("Sending drive ping from", input.fromUserName, "to user", input.toUserId);
      
      const users = await getUsersWithPushTokens();
      const targetUser = users.find(u => u.id === input.toUserId);

      if (!targetUser) {
        return {
          success: false,
          message: "User not found or notifications not enabled",
        };
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
      const title = "🚗 Drive Invite!";
      const body = `${input.fromUserName}${carInfo} wants to go for a drive with you!`;

      const success = await sendExpoPushNotification(
        targetUser.pushToken,
        title,
        body,
        { 
          type: "drive_ping", 
          meetupId,
          fromUserId: input.fromUserId,
          fromUserName: input.fromUserName,
        }
      );

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
      console.log("Responding to ping:", input.meetupId, input.response);
      
      const meetups = await getAllMeetups();
      const meetup = meetups.find(m => m.id === input.meetupId);

      if (!meetup) {
        return { success: false, message: "Meetup not found" };
      }

      if (meetup.toUserId !== input.responderId) {
        return { success: false, message: "Not authorized to respond" };
      }

      const updated = await updateMeetup(input.meetupId, {
        status: input.response,
        respondedAt: Date.now(),
      });

      if (!updated) {
        return { success: false, message: "Failed to update meetup" };
      }

      const users = await getUsersWithPushTokens();
      const pinger = users.find(u => u.id === meetup.fromUserId);

      if (pinger) {
        const title = input.response === 'accepted' 
          ? "✅ Drive Accepted!" 
          : "❌ Drive Declined";
        const body = input.response === 'accepted'
          ? `${input.responderName} accepted your drive invite! Get ready to meet up.`
          : `${input.responderName} declined your drive invite.`;

        await sendExpoPushNotification(
          pinger.pushToken,
          title,
          body,
          {
            type: input.response === 'accepted' ? 'ping_accepted' : 'ping_declined',
            meetupId: input.meetupId,
            fromUserId: input.responderId,
            fromUserName: input.responderName,
          }
        );
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
      console.log("Sharing location for meetup:", input.meetupId);
      
      const meetups = await getAllMeetups();
      const meetup = meetups.find(m => m.id === input.meetupId);

      if (!meetup) {
        return { success: false, message: "Meetup not found" };
      }

      if (meetup.status !== 'accepted') {
        return { success: false, message: "Meetup not accepted" };
      }

      const isFromUser = meetup.fromUserId === input.userId;
      const isToUser = meetup.toUserId === input.userId;

      if (!isFromUser && !isToUser) {
        return { success: false, message: "Not authorized" };
      }

      const locationData = {
        latitude: input.latitude,
        longitude: input.longitude,
        timestamp: Date.now(),
      };

      const updateField = isToUser ? 'toUserLocation' : 'fromUserLocation';
      const updated = await updateMeetup(input.meetupId, {
        [updateField]: locationData,
      });

      if (!updated) {
        return { success: false, message: "Failed to share location" };
      }

      const users = await getUsersWithPushTokens();
      const otherUserId = isToUser ? meetup.fromUserId : meetup.toUserId;
      const otherUser = users.find(u => u.id === otherUserId);

      if (otherUser) {
        const title = "📍 Location Shared!";
        const body = `${input.userName} shared their location for the meetup.`;

        await sendExpoPushNotification(
          otherUser.pushToken,
          title,
          body,
          {
            type: 'location_shared',
            meetupId: input.meetupId,
            fromUserId: input.userId,
            fromUserName: input.userName,
            latitude: input.latitude,
            longitude: input.longitude,
          }
        );
      }

      return { success: true };
    }),

  getMeetups: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
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

      if (!meetup) {
        return { success: false, message: "Meetup not found" };
      }

      const isParticipant = meetup.fromUserId === input.userId || meetup.toUserId === input.userId;
      if (!isParticipant) {
        return { success: false, message: "Not authorized" };
      }

      await updateMeetup(input.meetupId, { status: 'cancelled' });

      const users = await getUsersWithPushTokens();
      const otherUserId = meetup.fromUserId === input.userId ? meetup.toUserId : meetup.fromUserId;
      const otherUser = users.find(u => u.id === otherUserId);

      if (otherUser) {
        await sendExpoPushNotification(
          otherUser.pushToken,
          "❌ Meetup Cancelled",
          `${input.userName} cancelled the drive meetup.`,
          { type: 'meetup_cancelled', meetupId: input.meetupId }
        );
      }

      return { success: true };
    }),
});
