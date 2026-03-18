import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { isDbConfigured, getSupabaseHeaders, getSupabaseRestUrl } from "../db";

interface FollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: number;
}

interface ActivityFeedRow {
  id: string;
  user_id: string;
  type: string;
  trip_id?: string;
  car_model?: string;
  top_speed?: number;
  distance?: number;
  duration?: number;
  country?: string;
  city?: string;
  created_at: number;
}

export const socialRouter = createTRPCRouter({
  follow: publicProcedure
    .input(z.object({
      followerId: z.string(),
      followingId: z.string(),
    }))
    .mutation(async ({ input }) => {
      console.log("[SOCIAL] Follow:", input.followerId, "->", input.followingId);
      if (!isDbConfigured()) return { success: false, error: "Database not configured" };
      if (input.followerId === input.followingId) return { success: false, error: "Cannot follow yourself" };

      try {
        const checkUrl = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.followerId)}&following_id=eq.${encodeURIComponent(input.followingId)}`;
        const checkResp = await fetch(checkUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (checkResp.ok) {
          const existing = await checkResp.json();
          if (existing.length > 0) {
            console.log("[SOCIAL] Already following");
            return { success: true, alreadyFollowing: true };
          }
        }

        const id = `follow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const row = {
          id,
          follower_id: input.followerId,
          following_id: input.followingId,
          created_at: Date.now(),
        };

        const resp = await fetch(getSupabaseRestUrl("follows"), {
          method: "POST",
          headers: getSupabaseHeaders(),
          body: JSON.stringify(row),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[SOCIAL] Follow insert failed:", err);
          return { success: false, error: "Failed to follow" };
        }

        console.log("[SOCIAL] Follow created:", id);
        return { success: true };
      } catch (error) {
        console.error("[SOCIAL] Follow error:", error);
        return { success: false, error: "Network error" };
      }
    }),

  unfollow: publicProcedure
    .input(z.object({
      followerId: z.string(),
      followingId: z.string(),
    }))
    .mutation(async ({ input }) => {
      console.log("[SOCIAL] Unfollow:", input.followerId, "->", input.followingId);
      if (!isDbConfigured()) return { success: false, error: "Database not configured" };

      try {
        const url = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.followerId)}&following_id=eq.${encodeURIComponent(input.followingId)}`;
        const resp = await fetch(url, { method: "DELETE", headers: getSupabaseHeaders() });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[SOCIAL] Unfollow failed:", err);
          return { success: false, error: "Failed to unfollow" };
        }

        console.log("[SOCIAL] Unfollowed");
        return { success: true };
      } catch (error) {
        console.error("[SOCIAL] Unfollow error:", error);
        return { success: false, error: "Network error" };
      }
    }),

  isFollowing: publicProcedure
    .input(z.object({
      followerId: z.string(),
      followingId: z.string(),
    }))
    .query(async ({ input }) => {
      if (!isDbConfigured()) return { following: false };
      if (input.followerId === input.followingId) return { following: false };

      try {
        const url = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.followerId)}&following_id=eq.${encodeURIComponent(input.followingId)}&limit=1`;
        const resp = await fetch(url, { method: "GET", headers: getSupabaseHeaders() });
        if (!resp.ok) return { following: false };
        const data = await resp.json();
        return { following: data.length > 0 };
      } catch {
        return { following: false };
      }
    }),

  getFollowCounts: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      if (!isDbConfigured()) return { followers: 0, following: 0 };

      try {
        const followersUrl = `${getSupabaseRestUrl("follows")}?following_id=eq.${encodeURIComponent(input.userId)}&select=id`;
        const followingUrl = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.userId)}&select=id`;

        const [followersResp, followingResp] = await Promise.all([
          fetch(followersUrl, { method: "GET", headers: getSupabaseHeaders() }),
          fetch(followingUrl, { method: "GET", headers: getSupabaseHeaders() }),
        ]);

        const followers = followersResp.ok ? (await followersResp.json()).length : 0;
        const following = followingResp.ok ? (await followingResp.json()).length : 0;

        return { followers, following };
      } catch {
        return { followers: 0, following: 0 };
      }
    }),

  getFollowers: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      if (!isDbConfigured()) return [];

      try {
        const url = `${getSupabaseRestUrl("follows")}?following_id=eq.${encodeURIComponent(input.userId)}&select=follower_id,created_at&order=created_at.desc`;
        const resp = await fetch(url, { method: "GET", headers: getSupabaseHeaders() });
        if (!resp.ok) return [];
        const rows: FollowRow[] = await resp.json();
        const userIds = rows.map(r => r.follower_id);

        if (userIds.length === 0) return [];

        const usersUrl = `${getSupabaseRestUrl("users")}?select=id,display_name,car_brand,car_model,country,city`;
        const usersResp = await fetch(usersUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (!usersResp.ok) return [];
        const allUsers: Record<string, any>[] = await usersResp.json();

        return userIds
          .map(uid => {
            const u = allUsers.find((au: any) => au.id === uid);
            if (!u) return null;
            return {
              id: u.id,
              displayName: u.display_name,
              carBrand: u.car_brand,
              carModel: u.car_model,
              country: u.country,
              city: u.city,
            };
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    }),

  getFollowing: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      if (!isDbConfigured()) return [];

      try {
        const url = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.userId)}&select=following_id,created_at&order=created_at.desc`;
        const resp = await fetch(url, { method: "GET", headers: getSupabaseHeaders() });
        if (!resp.ok) return [];
        const rows: FollowRow[] = await resp.json();
        const userIds = rows.map(r => r.following_id);

        if (userIds.length === 0) return [];

        const usersUrl = `${getSupabaseRestUrl("users")}?select=id,display_name,car_brand,car_model,country,city`;
        const usersResp = await fetch(usersUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (!usersResp.ok) return [];
        const allUsers: Record<string, any>[] = await usersResp.json();

        return userIds
          .map(uid => {
            const u = allUsers.find((au: any) => au.id === uid);
            if (!u) return null;
            return {
              id: u.id,
              displayName: u.display_name,
              carBrand: u.car_brand,
              carModel: u.car_model,
              country: u.country,
              city: u.city,
            };
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    }),

  createActivityEntry: publicProcedure
    .input(z.object({
      userId: z.string(),
      type: z.string().default("trip"),
      tripId: z.string().optional(),
      carModel: z.string().optional(),
      topSpeed: z.number().optional(),
      distance: z.number().optional(),
      duration: z.number().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log("[SOCIAL] Creating activity entry for user:", input.userId, "type:", input.type);
      if (!isDbConfigured()) return { success: false };

      try {
        if (input.tripId) {
          const checkUrl = `${getSupabaseRestUrl("activity_feed")}?trip_id=eq.${encodeURIComponent(input.tripId)}&limit=1`;
          const checkResp = await fetch(checkUrl, { method: "GET", headers: getSupabaseHeaders() });
          if (checkResp.ok) {
            const existing = await checkResp.json();
            if (existing.length > 0) {
              console.log("[SOCIAL] Activity entry already exists for trip:", input.tripId);
              return { success: true, alreadyExists: true };
            }
          }
        }

        const id = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const row = {
          id,
          user_id: input.userId,
          type: input.type,
          trip_id: input.tripId,
          car_model: input.carModel,
          top_speed: input.topSpeed ?? 0,
          distance: input.distance ?? 0,
          duration: input.duration ?? 0,
          country: input.country,
          city: input.city,
          created_at: Date.now(),
        };

        const resp = await fetch(getSupabaseRestUrl("activity_feed"), {
          method: "POST",
          headers: getSupabaseHeaders(),
          body: JSON.stringify(row),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[SOCIAL] Activity entry insert failed:", err);
          return { success: false };
        }

        console.log("[SOCIAL] Activity entry created:", id);
        return { success: true };
      } catch (error) {
        console.error("[SOCIAL] Activity entry error:", error);
        return { success: false };
      }
    }),

  getFeed: publicProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().optional().default(30),
      offset: z.number().optional().default(0),
    }))
    .query(async ({ input }) => {
      console.log("[SOCIAL] Fetching feed for user:", input.userId, "limit:", input.limit, "offset:", input.offset);
      if (!isDbConfigured()) return [];

      try {
        const followingUrl = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.userId)}&select=following_id`;
        const followResp = await fetch(followingUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (!followResp.ok) return [];
        const followRows: { following_id: string }[] = await followResp.json();
        const followingIds = followRows.map(r => r.following_id);

        followingIds.push(input.userId);

        if (followingIds.length === 0) return [];

        const userIdFilter = followingIds.map(id => `"${id}"`).join(",");
        const feedUrl = `${getSupabaseRestUrl("activity_feed")}?user_id=in.(${userIdFilter})&order=created_at.desc&limit=${input.limit}&offset=${input.offset}`;

        const feedResp = await fetch(feedUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (!feedResp.ok) {
          const err = await feedResp.text();
          console.error("[SOCIAL] Feed fetch failed:", err);
          return [];
        }

        const feedRows: ActivityFeedRow[] = await feedResp.json();
        console.log("[SOCIAL] Feed rows fetched:", feedRows.length);

        const usersUrl = `${getSupabaseRestUrl("users")}?select=id,display_name,car_brand,car_model,country,city`;
        const usersResp = await fetch(usersUrl, { method: "GET", headers: getSupabaseHeaders() });
        const allUsers: Record<string, any>[] = usersResp.ok ? await usersResp.json() : [];

        const userMap = new Map<string, { displayName: string; carBrand?: string; carModel?: string }>();
        for (const u of allUsers) {
          userMap.set(u.id, {
            displayName: u.display_name,
            carBrand: u.car_brand,
            carModel: u.car_model,
          });
        }

        return feedRows.map(row => ({
          id: row.id,
          userId: row.user_id,
          userName: userMap.get(row.user_id)?.displayName ?? "Unknown",
          type: row.type,
          tripId: row.trip_id,
          carModel: row.car_model,
          topSpeed: row.top_speed ?? 0,
          distance: row.distance ?? 0,
          duration: row.duration ?? 0,
          country: row.country,
          city: row.city,
          createdAt: row.created_at,
        }));
      } catch (error) {
        console.error("[SOCIAL] Feed error:", error);
        return [];
      }
    }),

  batchIsFollowing: publicProcedure
    .input(z.object({
      followerId: z.string(),
      followingIds: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      if (!isDbConfigured()) return { followingMap: {} as Record<string, boolean> };
      if (input.followingIds.length === 0) return { followingMap: {} as Record<string, boolean> };

      try {
        const ids = input.followingIds.filter(id => id !== input.followerId);
        if (ids.length === 0) return { followingMap: {} as Record<string, boolean> };

        const idFilter = ids.map(id => `"${id}"`).join(",");
        const url = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.followerId)}&following_id=in.(${idFilter})&select=following_id`;
        const resp = await fetch(url, { method: "GET", headers: getSupabaseHeaders() });
        if (!resp.ok) return { followingMap: {} as Record<string, boolean> };

        const rows: { following_id: string }[] = await resp.json();
        const followingMap: Record<string, boolean> = {};
        for (const id of ids) {
          followingMap[id] = rows.some(r => r.following_id === id);
        }
        return { followingMap };
      } catch {
        return { followingMap: {} as Record<string, boolean> };
      }
    }),

  searchUsers: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      currentUserId: z.string(),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      console.log("[SOCIAL] Searching users:", input.query);
      if (!isDbConfigured()) return [];

      try {
        const url = `${getSupabaseRestUrl("users")}?display_name=ilike.*${encodeURIComponent(input.query)}*&select=id,display_name,car_brand,car_model,country,city&limit=${input.limit}`;
        const resp = await fetch(url, { method: "GET", headers: getSupabaseHeaders() });
        if (!resp.ok) return [];

        const users: Record<string, any>[] = await resp.json();
        return users
          .filter((u: any) => u.id !== input.currentUserId)
          .map((u: any) => ({
            id: u.id,
            displayName: u.display_name,
            carBrand: u.car_brand,
            carModel: u.car_model,
            country: u.country,
            city: u.city,
          }));
      } catch {
        return [];
      }
    }),
});
