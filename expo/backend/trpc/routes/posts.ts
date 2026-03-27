import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { isDbConfigured, getSupabaseHeaders, getSupabaseRestUrl } from "../db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PostRow {
  id: string;
  user_id: string;
  text?: string;
  image_url?: string;
  created_at: number;
}

interface PostRevRow {
  id: string;
  post_id: string;
  user_id: string;
  created_at: number;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  from_user_id?: string;
  post_id?: string;
  message: string;
  read: boolean;
  created_at: number;
}

async function sendRevPushNotification(
  fromUserId: string,
  postOwnerId: string,
  postId: string
): Promise<void> {
  if (!isDbConfigured()) return;

  try {
    const fromUserUrl = `${getSupabaseRestUrl("users")}?id=eq.${encodeURIComponent(fromUserId)}&select=display_name&limit=1`;
    const ownerUrl = `${getSupabaseRestUrl("users")}?id=eq.${encodeURIComponent(postOwnerId)}&select=push_token&limit=1`;

    const [fromResp, ownerResp] = await Promise.all([
      fetch(fromUserUrl, { method: "GET", headers: getSupabaseHeaders() }),
      fetch(ownerUrl, { method: "GET", headers: getSupabaseHeaders() }),
    ]);

    if (!fromResp.ok || !ownerResp.ok) return;

    const fromData = await fromResp.json();
    const ownerData = await ownerResp.json();

    const fromUser = fromData[0];
    const owner = ownerData[0];

    if (!fromUser || !owner?.push_token) return;

    const fromName = fromUser.display_name || "Someone";

    console.log("[POSTS] Sending rev push notification to:", postOwnerId);

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: owner.push_token,
        title: "🏎️ New Rev!",
        body: `${fromName} revved your post!`,
        sound: "default",
        data: { type: "post_rev", fromUserId, postId },
        channelId: "default",
        priority: "high",
      }),
    });

    console.log("[POSTS] Rev push notification sent");
  } catch (error) {
    console.error("[POSTS] Rev push notification error:", error);
  }
}

export const postsRouter = createTRPCRouter({
  createPost: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        text: z.string().optional(),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[POSTS] Creating post for user:", input.userId);
      if (!isDbConfigured()) return { success: false, error: "Database not configured" };

      if (!input.text?.trim() && !input.imageUrl) {
        return { success: false, error: "Post must have text or an image" };
      }

      try {
        const id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const row = {
          id,
          user_id: input.userId,
          text: input.text?.trim() || null,
          image_url: input.imageUrl || null,
          created_at: Date.now(),
        };

        const resp = await fetch(getSupabaseRestUrl("posts"), {
          method: "POST",
          headers: getSupabaseHeaders(),
          body: JSON.stringify(row),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[POSTS] Post insert failed:", err);
          return { success: false, error: "Failed to create post" };
        }

        console.log("[POSTS] Post created:", id);
        return { success: true, postId: id };
      } catch (error) {
        console.error("[POSTS] Create post error:", error);
        return { success: false, error: "Network error" };
      }
    }),

  getFeedPosts: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().optional().default(30),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      console.log("[POSTS] Fetching feed posts for user:", input.userId);
      if (!isDbConfigured()) return [];

      try {
        const followingUrl = `${getSupabaseRestUrl("follows")}?follower_id=eq.${encodeURIComponent(input.userId)}&select=following_id`;
        const followResp = await fetch(followingUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (!followResp.ok) return [];
        const followRows: { following_id: string }[] = await followResp.json();
        const followingIds = followRows.map((r) => r.following_id);
        followingIds.push(input.userId);

        if (followingIds.length === 0) return [];

        const userIdFilter = followingIds.map((id) => `"${id}"`).join(",");
        const postsUrl = `${getSupabaseRestUrl("posts")}?user_id=in.(${userIdFilter})&order=created_at.desc&limit=${input.limit}&offset=${input.offset}`;

        const postsResp = await fetch(postsUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (!postsResp.ok) return [];

        const postRows: PostRow[] = await postsResp.json();
        console.log("[POSTS] Feed posts fetched:", postRows.length);

        const usersUrl = `${getSupabaseRestUrl("users")}?select=id,display_name,car_brand,car_model,profile_picture`;
        const usersResp = await fetch(usersUrl, { method: "GET", headers: getSupabaseHeaders() });
        const allUsers: Record<string, any>[] = usersResp.ok ? await usersResp.json() : [];

        const userMap = new Map<string, { displayName: string; carBrand?: string; carModel?: string; profilePicture?: string }>();
        for (const u of allUsers) {
          userMap.set(u.id, {
            displayName: u.display_name,
            carBrand: u.car_brand,
            carModel: u.car_model,
            profilePicture: u.profile_picture,
          });
        }

        const postIds = postRows.map((p) => p.id);
        let revCounts: Record<string, number> = {};
        let userRevs: Set<string> = new Set();

        if (postIds.length > 0) {
          const postIdFilter = postIds.map((id) => `"${id}"`).join(",");
          const revsUrl = `${getSupabaseRestUrl("post_revs")}?post_id=in.(${postIdFilter})&select=post_id,user_id`;
          const revsResp = await fetch(revsUrl, { method: "GET", headers: getSupabaseHeaders() });
          if (revsResp.ok) {
            const revRows: PostRevRow[] = await revsResp.json();
            for (const rev of revRows) {
              revCounts[rev.post_id] = (revCounts[rev.post_id] || 0) + 1;
              if (rev.user_id === input.userId) {
                userRevs.add(rev.post_id);
              }
            }
          }
        }

        return postRows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          userName: userMap.get(row.user_id)?.displayName ?? "Unknown",
          userProfilePicture: userMap.get(row.user_id)?.profilePicture,
          userCarBrand: userMap.get(row.user_id)?.carBrand,
          userCarModel: userMap.get(row.user_id)?.carModel,
          text: row.text,
          imageUrl: row.image_url,
          revCount: revCounts[row.id] || 0,
          isRevved: userRevs.has(row.id),
          createdAt: row.created_at,
        }));
      } catch (error) {
        console.error("[POSTS] Feed posts error:", error);
        return [];
      }
    }),

  getUserPosts: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      console.log("[POSTS] Fetching user posts:", input.userId);
      if (!isDbConfigured()) return [];

      try {
        const postsUrl = `${getSupabaseRestUrl("posts")}?user_id=eq.${encodeURIComponent(input.userId)}&order=created_at.desc&limit=${input.limit}&offset=${input.offset}`;
        const postsResp = await fetch(postsUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (!postsResp.ok) return [];

        const postRows: PostRow[] = await postsResp.json();

        const postIds = postRows.map((p) => p.id);
        let revCounts: Record<string, number> = {};

        if (postIds.length > 0) {
          const postIdFilter = postIds.map((id) => `"${id}"`).join(",");
          const revsUrl = `${getSupabaseRestUrl("post_revs")}?post_id=in.(${postIdFilter})&select=post_id`;
          const revsResp = await fetch(revsUrl, { method: "GET", headers: getSupabaseHeaders() });
          if (revsResp.ok) {
            const revRows: { post_id: string }[] = await revsResp.json();
            for (const rev of revRows) {
              revCounts[rev.post_id] = (revCounts[rev.post_id] || 0) + 1;
            }
          }
        }

        return postRows.map((row) => ({
          id: row.id,
          text: row.text,
          imageUrl: row.image_url,
          revCount: revCounts[row.id] || 0,
          createdAt: row.created_at,
        }));
      } catch (error) {
        console.error("[POSTS] User posts error:", error);
        return [];
      }
    }),

  revPost: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[POSTS] Rev post:", input.postId, "by user:", input.userId);
      if (!isDbConfigured()) return { success: false, error: "Database not configured" };

      try {
        const checkUrl = `${getSupabaseRestUrl("post_revs")}?post_id=eq.${encodeURIComponent(input.postId)}&user_id=eq.${encodeURIComponent(input.userId)}&limit=1`;
        const checkResp = await fetch(checkUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (checkResp.ok) {
          const existing = await checkResp.json();
          if (existing.length > 0) {
            return { success: true, alreadyRevved: true };
          }
        }

        const id = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const row = {
          id,
          post_id: input.postId,
          user_id: input.userId,
          created_at: Date.now(),
        };

        const resp = await fetch(getSupabaseRestUrl("post_revs"), {
          method: "POST",
          headers: getSupabaseHeaders(),
          body: JSON.stringify(row),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[POSTS] Rev insert failed:", err);
          return { success: false, error: "Failed to rev post" };
        }

        const postUrl = `${getSupabaseRestUrl("posts")}?id=eq.${encodeURIComponent(input.postId)}&select=user_id&limit=1`;
        const postResp = await fetch(postUrl, { method: "GET", headers: getSupabaseHeaders() });
        if (postResp.ok) {
          const postData = await postResp.json();
          const postOwnerId = postData[0]?.user_id;
          if (postOwnerId && postOwnerId !== input.userId) {
            const userUrl = `${getSupabaseRestUrl("users")}?id=eq.${encodeURIComponent(input.userId)}&select=display_name&limit=1`;
            const userResp = await fetch(userUrl, { method: "GET", headers: getSupabaseHeaders() });
            let fromName = "Someone";
            if (userResp.ok) {
              const userData = await userResp.json();
              fromName = userData[0]?.display_name || "Someone";
            }

            const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const notifRow = {
              id: notifId,
              user_id: postOwnerId,
              type: "post_rev",
              from_user_id: input.userId,
              post_id: input.postId,
              message: `${fromName} revved your post`,
              read: false,
              created_at: Date.now(),
            };

            fetch(getSupabaseRestUrl("notifications"), {
              method: "POST",
              headers: getSupabaseHeaders(),
              body: JSON.stringify(notifRow),
            }).catch((err) => console.error("[POSTS] Notification insert error:", err));

            sendRevPushNotification(input.userId, postOwnerId, input.postId).catch((err) =>
              console.error("[POSTS] Rev push notification failed:", err)
            );
          }
        }

        console.log("[POSTS] Rev created:", id);
        return { success: true };
      } catch (error) {
        console.error("[POSTS] Rev error:", error);
        return { success: false, error: "Network error" };
      }
    }),

  unrevPost: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[POSTS] Unrev post:", input.postId, "by user:", input.userId);
      if (!isDbConfigured()) return { success: false, error: "Database not configured" };

      try {
        const url = `${getSupabaseRestUrl("post_revs")}?post_id=eq.${encodeURIComponent(input.postId)}&user_id=eq.${encodeURIComponent(input.userId)}`;
        const resp = await fetch(url, { method: "DELETE", headers: getSupabaseHeaders() });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[POSTS] Unrev failed:", err);
          return { success: false, error: "Failed to unrev post" };
        }

        console.log("[POSTS] Unrevved");
        return { success: true };
      } catch (error) {
        console.error("[POSTS] Unrev error:", error);
        return { success: false, error: "Network error" };
      }
    }),

  getNotifications: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input }) => {
      console.log("[POSTS] Fetching notifications for user:", input.userId);
      if (!isDbConfigured()) return [];

      try {
        const url = `${getSupabaseRestUrl("notifications")}?user_id=eq.${encodeURIComponent(input.userId)}&order=created_at.desc&limit=${input.limit}`;
        const resp = await fetch(url, { method: "GET", headers: getSupabaseHeaders() });
        if (!resp.ok) return [];

        const rows: NotificationRow[] = await resp.json();

        const fromUserIds = [...new Set(rows.filter((r) => r.from_user_id).map((r) => r.from_user_id as string))];
        let userMap = new Map<string, { displayName: string; profilePicture?: string }>();

        if (fromUserIds.length > 0) {
          const idFilter = fromUserIds.map((id) => `"${id}"`).join(",");
          const usersUrl = `${getSupabaseRestUrl("users")}?id=in.(${idFilter})&select=id,display_name,profile_picture`;
          const usersResp = await fetch(usersUrl, { method: "GET", headers: getSupabaseHeaders() });
          if (usersResp.ok) {
            const users: Record<string, any>[] = await usersResp.json();
            for (const u of users) {
              userMap.set(u.id, { displayName: u.display_name, profilePicture: u.profile_picture });
            }
          }
        }

        return rows.map((row) => ({
          id: row.id,
          type: row.type,
          fromUserId: row.from_user_id,
          fromUserName: row.from_user_id ? userMap.get(row.from_user_id)?.displayName : undefined,
          fromUserPicture: row.from_user_id ? userMap.get(row.from_user_id)?.profilePicture : undefined,
          postId: row.post_id,
          message: row.message,
          read: row.read,
          createdAt: row.created_at,
        }));
      } catch (error) {
        console.error("[POSTS] Notifications error:", error);
        return [];
      }
    }),

  getUnreadNotificationCount: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      if (!isDbConfigured()) return { count: 0 };

      try {
        const url = `${getSupabaseRestUrl("notifications")}?user_id=eq.${encodeURIComponent(input.userId)}&read=eq.false&select=id`;
        const resp = await fetch(url, { method: "GET", headers: getSupabaseHeaders() });
        if (!resp.ok) return { count: 0 };
        const rows = await resp.json();
        return { count: rows.length };
      } catch {
        return { count: 0 };
      }
    }),

  markNotificationsRead: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      console.log("[POSTS] Marking notifications read for user:", input.userId);
      if (!isDbConfigured()) return { success: false };

      try {
        const url = `${getSupabaseRestUrl("notifications")}?user_id=eq.${encodeURIComponent(input.userId)}&read=eq.false`;
        const resp = await fetch(url, {
          method: "PATCH",
          headers: getSupabaseHeaders(),
          body: JSON.stringify({ read: true }),
        });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[POSTS] Mark read failed:", err);
          return { success: false };
        }

        return { success: true };
      } catch (error) {
        console.error("[POSTS] Mark read error:", error);
        return { success: false };
      }
    }),

  deletePost: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[POSTS] Deleting post:", input.postId);
      if (!isDbConfigured()) return { success: false, error: "Database not configured" };

      try {
        const revsUrl = `${getSupabaseRestUrl("post_revs")}?post_id=eq.${encodeURIComponent(input.postId)}`;
        await fetch(revsUrl, { method: "DELETE", headers: getSupabaseHeaders() });

        const notifsUrl = `${getSupabaseRestUrl("notifications")}?post_id=eq.${encodeURIComponent(input.postId)}`;
        await fetch(notifsUrl, { method: "DELETE", headers: getSupabaseHeaders() });

        const url = `${getSupabaseRestUrl("posts")}?id=eq.${encodeURIComponent(input.postId)}&user_id=eq.${encodeURIComponent(input.userId)}`;
        const resp = await fetch(url, { method: "DELETE", headers: getSupabaseHeaders() });

        if (!resp.ok) {
          const err = await resp.text();
          console.error("[POSTS] Delete failed:", err);
          return { success: false, error: "Failed to delete post" };
        }

        console.log("[POSTS] Post deleted");
        return { success: true };
      } catch (error) {
        console.error("[POSTS] Delete error:", error);
        return { success: false, error: "Network error" };
      }
    }),
});
