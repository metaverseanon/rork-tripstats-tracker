import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { isDbConfigured, getSupabaseHeaders, getSupabaseRestUrl } from "../db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function convertSpeedForUnit(speedKmh: number, unit?: string): { value: number; label: string } {
  if (unit === 'mph') {
    return { value: Math.round(speedKmh * 0.621371), label: 'mph' };
  }
  return { value: Math.round(speedKmh), label: 'km/h' };
}

async function createActivityFeedEntry(input: {
  id: string;
  userId: string;
  carModel?: string;
  topSpeed: number;
  distance: number;
  duration: number;
  location?: { country?: string; city?: string };
}): Promise<void> {
  if (!isDbConfigured()) return;

  try {
    const checkUrl = `${getSupabaseRestUrl("activity_feed")}?trip_id=eq.${encodeURIComponent(input.id)}&limit=1`;
    const checkResp = await fetch(checkUrl, { method: "GET", headers: getSupabaseHeaders() });
    if (checkResp.ok) {
      const existing = await checkResp.json();
      if (existing.length > 0) {
        console.log("[TRIPS] Activity entry already exists for trip:", input.id);
        return;
      }
    }

    const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const row = {
      id: activityId,
      user_id: input.userId,
      type: "trip",
      trip_id: input.id,
      car_model: input.carModel,
      top_speed: input.topSpeed,
      distance: input.distance,
      duration: input.duration,
      country: input.location?.country,
      city: input.location?.city,
      created_at: Date.now(),
    };

    const resp = await fetch(getSupabaseRestUrl("activity_feed"), {
      method: "POST",
      headers: getSupabaseHeaders(),
      body: JSON.stringify(row),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("[TRIPS] Activity feed insert failed:", err);
      return;
    }

    console.log("[TRIPS] Activity feed entry created for trip:", input.id);
  } catch (error) {
    console.error("[TRIPS] Activity feed entry error:", error);
  }
}

async function sendLeaderboardBeatNotifications(input: {
  userId: string;
  userName?: string;
  topSpeed: number;
  carModel?: string;
}): Promise<void> {
  if (!isDbConfigured() || input.topSpeed <= 0) return;

  try {
    console.log("[LEADERBOARD_NOTIFY] Checking if user beat anyone. topSpeed:", input.topSpeed);

    const tripsUrl = `${getSupabaseRestUrl("trips")}?select=user_id,top_speed&top_speed=gt.0&order=top_speed.desc&limit=500`;
    const tripsResp = await fetch(tripsUrl, { method: "GET", headers: getSupabaseHeaders() });
    if (!tripsResp.ok) {
      console.error("[LEADERBOARD_NOTIFY] Failed to fetch trips for comparison");
      return;
    }

    const allTrips: { user_id: string; top_speed: number }[] = await tripsResp.json();

    const userBestSpeeds = new Map<string, number>();
    for (const t of allTrips) {
      if (t.user_id === input.userId) continue;
      const existing = userBestSpeeds.get(t.user_id);
      if (!existing || t.top_speed > existing) {
        userBestSpeeds.set(t.user_id, t.top_speed);
      }
    }

    const beatenUserIds: string[] = [];
    for (const [uid, bestSpeed] of userBestSpeeds) {
      if (input.topSpeed > bestSpeed) {
        beatenUserIds.push(uid);
      }
    }

    if (beatenUserIds.length === 0) {
      console.log("[LEADERBOARD_NOTIFY] No users beaten");
      return;
    }

    console.log("[LEADERBOARD_NOTIFY] Beaten user IDs:", beatenUserIds.length);

    const usersUrl = `${getSupabaseRestUrl("users")}?select=id,display_name,push_token,speed_unit`;
    const usersResp = await fetch(usersUrl, { method: "GET", headers: getSupabaseHeaders() });
    if (!usersResp.ok) {
      console.error("[LEADERBOARD_NOTIFY] Failed to fetch users");
      return;
    }

    const allUsers: { id: string; display_name: string; push_token?: string; speed_unit?: string }[] = await usersResp.json();
    const usersToNotify = allUsers.filter(
      u => u.id !== input.userId && beatenUserIds.includes(u.id) && u.push_token
    );

    if (usersToNotify.length === 0) {
      console.log("[LEADERBOARD_NOTIFY] No beaten users have push tokens");
      return;
    }

    const driverName = input.userName || "Someone";
    const carInfo = input.carModel ? ` in a ${input.carModel}` : "";

    const messages = usersToNotify.map(u => {
      const speed = convertSpeedForUnit(input.topSpeed, u.speed_unit);
      return {
        to: u.push_token!,
        title: "🏁 You've been overtaken!",
        body: `${driverName} just beat you${carInfo} hitting ${speed.value} ${speed.label}!`,
        sound: "default" as const,
        data: { type: "leaderboard_beat", fromUserId: input.userId, topSpeed: input.topSpeed },
        channelId: "default",
        priority: "high" as const,
      };
    });

    console.log("[LEADERBOARD_NOTIFY] Sending notifications to", messages.length, "users");

    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      try {
        const resp = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });
        if (resp.ok) {
          const result = await resp.json();
          console.log("[LEADERBOARD_NOTIFY] Batch sent, tickets:", result.data?.length);
        } else {
          console.error("[LEADERBOARD_NOTIFY] Batch send failed:", resp.status);
        }
      } catch (err) {
        console.error("[LEADERBOARD_NOTIFY] Batch send error:", err);
      }
    }
  } catch (error) {
    console.error("[LEADERBOARD_NOTIFY] Error:", error);
  }
}

const TripLocationSchema = z.object({
  country: z.string().optional(),
  city: z.string().optional(),
});

const RoutePointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const TripStatsSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().optional(),
  userProfilePicture: z.string().optional(),
  startTime: z.number(),
  endTime: z.number().optional(),
  distance: z.number(),
  duration: z.number(),
  avgSpeed: z.number(),
  topSpeed: z.number(),
  corners: z.number(),
  carModel: z.string().optional(),
  acceleration: z.number().optional(),
  maxGForce: z.number().optional(),
  location: TripLocationSchema.optional(),
  time0to100: z.number().optional(),
  time0to200: z.number().optional(),
  time0to300: z.number().optional(),
  routePoints: z.array(RoutePointSchema).optional(),
});

type SyncedTrip = z.infer<typeof TripStatsSchema>;

interface SupabaseTripRow {
  id: string;
  user_id: string;
  user_name?: string;
  user_profile_picture?: string;
  start_time: number;
  end_time?: number;
  distance: number;
  duration: number;
  avg_speed: number;
  top_speed: number;
  corners: number;
  car_model?: string;
  acceleration?: number;
  max_g_force?: number;
  country?: string;
  city?: string;
  time_0_to_100?: number;
  time_0_to_200?: number;
  time_0_to_300?: number;
  route_points?: { latitude: number; longitude: number }[] | string;
  created_at?: string;
  updated_at?: string;
}

function tripToSupabaseRow(trip: SyncedTrip): SupabaseTripRow {
  const row: SupabaseTripRow = {
    id: trip.id,
    user_id: trip.userId,
    user_name: trip.userName,
    user_profile_picture: trip.userProfilePicture,
    start_time: trip.startTime,
    end_time: trip.endTime,
    distance: trip.distance,
    duration: trip.duration,
    avg_speed: trip.avgSpeed,
    top_speed: trip.topSpeed,
    corners: trip.corners,
    car_model: trip.carModel,
    acceleration: trip.acceleration,
    max_g_force: trip.maxGForce,
    country: trip.location?.country,
    city: trip.location?.city,
    time_0_to_100: trip.time0to100,
    time_0_to_200: trip.time0to200,
    time_0_to_300: trip.time0to300,
  };
  if (trip.routePoints && trip.routePoints.length > 0) {
    row.route_points = trip.routePoints;
  }
  return row;
}

async function enrichTripsWithUserCars(trips: SyncedTrip[]): Promise<SyncedTrip[]> {
  const uniqueUserIds = [...new Set(trips.map(t => t.userId))];
  const tripsNeedingCar = trips.filter(t => !t.carModel);
  const userIdsNeedingCar = [...new Set(tripsNeedingCar.map(t => t.userId))];
  const userIdsNeedingPic = [...new Set(trips.filter(t => !t.userProfilePicture).map(t => t.userId))];
  const allNeededIds = [...new Set([...userIdsNeedingCar, ...userIdsNeedingPic])];
  
  console.log('[LEADERBOARD] Enriching info for', uniqueUserIds.length, 'users (car:', userIdsNeedingCar.length, ', pic:', userIdsNeedingPic.length, ')');

  if (allNeededIds.length === 0) return trips;

  try {
    const userCarMap = new Map<string, string>();
    const userProfilePicMap = new Map<string, string>();

    if (allNeededIds.length > 0) {
      const idsParam = allNeededIds.map(id => `"${id}"`).join(',');
      const url = `${getSupabaseRestUrl('users')}?id=in.(${idsParam})&select=id,car_brand,car_model,profile_picture`;
      const resp = await fetch(url, { method: 'GET', headers: getSupabaseHeaders() });
      if (resp.ok) {
        const rows: { id: string; car_brand?: string; car_model?: string; profile_picture?: string }[] = await resp.json();
        for (const u of rows) {
          if (u.car_brand && userIdsNeedingCar.includes(u.id)) {
            const carFull = u.car_model ? `${u.car_brand} ${u.car_model}` : u.car_brand;
            userCarMap.set(u.id, carFull);
          }
          if (u.profile_picture && userIdsNeedingPic.includes(u.id)) {
            userProfilePicMap.set(u.id, u.profile_picture);
          }
        }
      }
    }

    const stillNeedPic = userIdsNeedingPic.filter(id => !userProfilePicMap.has(id));
    if (stillNeedPic.length > 0) {
      const idsParam = stillNeedPic.map(id => `"${id}"`).join(',');
      const picUrl = `${getSupabaseRestUrl('trips')}?user_id=in.(${idsParam})&user_profile_picture=neq.null&select=user_id,user_profile_picture&order=start_time.desc`;
      const picResp = await fetch(picUrl, { method: 'GET', headers: getSupabaseHeaders() });
      if (picResp.ok) {
        const picRows: { user_id: string; user_profile_picture: string }[] = await picResp.json();
        for (const row of picRows) {
          if (!userProfilePicMap.has(row.user_id) && row.user_profile_picture) {
            userProfilePicMap.set(row.user_id, row.user_profile_picture);
          }
        }
      }
    }

    console.log('[LEADERBOARD] Found car info for', userCarMap.size, ', pics for', userProfilePicMap.size, 'users');

    return trips.map(trip => {
      const updates: Partial<SyncedTrip> = {};
      if (!trip.carModel && userCarMap.has(trip.userId)) {
        updates.carModel = userCarMap.get(trip.userId);
      }
      if (!trip.userProfilePicture && userProfilePicMap.has(trip.userId)) {
        updates.userProfilePicture = userProfilePicMap.get(trip.userId);
      }
      if (Object.keys(updates).length > 0) {
        return { ...trip, ...updates };
      }
      return trip;
    });
  } catch (error) {
    console.error('[LEADERBOARD] Error enriching trip info:', error);
    return trips;
  }
}

function supabaseRowToTrip(row: SupabaseTripRow): SyncedTrip {
  let routePoints: { latitude: number; longitude: number }[] | undefined;
  if (row.route_points) {
    try {
      if (typeof row.route_points === 'string') {
        routePoints = JSON.parse(row.route_points);
      } else if (Array.isArray(row.route_points)) {
        routePoints = row.route_points as unknown as { latitude: number; longitude: number }[];
      }

    } catch (e) {
      console.error('[TRIPS] Failed to parse route_points for trip:', row.id, 'type:', typeof row.route_points, e);
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userProfilePicture: row.user_profile_picture,
    startTime: row.start_time,
    endTime: row.end_time,
    distance: row.distance,
    duration: row.duration,
    avgSpeed: row.avg_speed,
    topSpeed: row.top_speed,
    corners: row.corners,
    carModel: row.car_model,
    acceleration: row.acceleration,
    maxGForce: row.max_g_force,
    location: row.country || row.city ? { country: row.country, city: row.city } : undefined,
    time0to100: row.time_0_to_100,
    time0to200: row.time_0_to_200,
    time0to300: row.time_0_to_300,
    routePoints,
  };
}

async function getTotalDistanceLeaderboard(input: {
  country?: string;
  city?: string;
  carBrand?: string;
  carModel?: string;
  timePeriod?: string;
  limit: number;
}): Promise<SyncedTrip[]> {
  try {
    let url = getSupabaseRestUrl("trips");
    const params: string[] = ["select=id,user_id,user_name,user_profile_picture,start_time,end_time,distance,duration,avg_speed,top_speed,corners,car_model,acceleration,max_g_force,country,city,time_0_to_100,time_0_to_200,time_0_to_300,route_points", "distance=gt.0"];

    if (input.country) {
      params.push(`country=eq.${encodeURIComponent(input.country)}`);
    }
    if (input.city) {
      params.push(`city=eq.${encodeURIComponent(input.city)}`);
    }
    if (input.carBrand && input.carModel) {
      const fullModel = `${input.carBrand} ${input.carModel}`;
      params.push(`car_model=eq.${encodeURIComponent(fullModel)}`);
    } else if (input.carBrand) {
      params.push(`car_model=like.${encodeURIComponent(input.carBrand + "*")}`);
    }

    if (input.timePeriod && input.timePeriod !== "all") {
      const now = new Date();
      let startTime = 0;
      switch (input.timePeriod) {
        case "today":
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          break;
        case "week": {
          const dayOfWeek = (now.getDay() + 6) % 7;
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
          break;
        }
        case "month":
          startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          break;
        case "year":
          startTime = new Date(now.getFullYear(), 0, 1).getTime();
          break;
      }
      if (startTime > 0) {
        params.push(`start_time=gte.${startTime}`);
      }
    }

    params.push("order=start_time.desc");
    params.push("limit=1000");
    url += "?" + params.join("&");

    console.log("[LEADERBOARD] totalDistance fetch from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: getSupabaseHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[LEADERBOARD] totalDistance fetch failed:", error);
      return [];
    }

    const rows: SupabaseTripRow[] = await response.json();
    const trips = rows.map(supabaseRowToTrip);

    const userTotals = new Map<string, { totalDistance: number; trip: SyncedTrip }>(); 
    for (const trip of trips) {
      const existing = userTotals.get(trip.userId);
      if (existing) {
        existing.totalDistance += trip.distance;
        if (trip.startTime > existing.trip.startTime) {
          existing.trip = { ...trip, distance: existing.totalDistance };
        } else {
          existing.trip = { ...existing.trip, distance: existing.totalDistance };
        }
      } else {
        userTotals.set(trip.userId, { totalDistance: trip.distance, trip: { ...trip } });
      }
    }

    const aggregated = Array.from(userTotals.values())
      .map(v => ({ ...v.trip, distance: v.totalDistance }))
      .sort((a, b) => b.distance - a.distance)
      .slice(0, input.limit);

    console.log("[LEADERBOARD] totalDistance aggregated:", aggregated.length, "users");
    return await enrichTripsWithUserCars(aggregated);
  } catch (error) {
    console.error("[LEADERBOARD] totalDistance error:", error);
    return [];
  }
}

export const tripsRouter = createTRPCRouter({
  syncTrip: publicProcedure
    .input(TripStatsSchema)
    .mutation(async ({ input }) => {
      console.log("[TRIPS] Syncing trip:", input.id, "for user:", input.userId, "userName:", input.userName);
      console.log("[TRIPS] Trip data: distance=", input.distance, "topSpeed=", input.topSpeed, "duration=", input.duration);

      if (!isDbConfigured()) {
        console.error("[TRIPS] Database not configured - SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY missing");
        return { success: false, message: "Database not configured" };
      }

      try {
        const row = tripToSupabaseRow(input);
        console.log("[TRIPS] Supabase row to upsert:", JSON.stringify(row));
        
        const checkUrl = `${getSupabaseRestUrl("trips")}?id=eq.${input.id}`;
        console.log("[TRIPS] Checking existing trip at:", checkUrl);
        
        const response = await fetch(checkUrl, {
          method: "GET",
          headers: getSupabaseHeaders(),
        });

        if (!response.ok) {
          const checkError = await response.text();
          console.error("[TRIPS] Failed to check existing trip - Status:", response.status, "Error:", checkError);
          return { success: false, message: `Failed to check existing trip: ${response.status}` };
        }

        const existing = await response.json();
        console.log("[TRIPS] Existing trip check result:", Array.isArray(existing) ? existing.length : 'not-array', "entries");
        
        if (Array.isArray(existing) && existing.length > 0) {
          console.log("[TRIPS] Updating existing trip:", input.id);
          const updateResponse = await fetch(
            `${getSupabaseRestUrl("trips")}?id=eq.${input.id}`,
            {
              method: "PATCH",
              headers: getSupabaseHeaders(),
              body: JSON.stringify(row),
            }
          );

          if (!updateResponse.ok) {
            const error = await updateResponse.text();
            console.error("[TRIPS] Failed to update trip - Status:", updateResponse.status, "Error:", error);
            return { success: false, message: `Failed to update trip: ${updateResponse.status} - ${error}` };
          }
          console.log("[TRIPS] Trip updated successfully:", input.id);
        } else {
          console.log("[TRIPS] Inserting new trip:", input.id, "for user:", input.userId);
          const insertUrl = getSupabaseRestUrl("trips");
          console.log("[TRIPS] Insert URL:", insertUrl);
          
          const insertResponse = await fetch(insertUrl, {
            method: "POST",
            headers: getSupabaseHeaders(),
            body: JSON.stringify(row),
          });

          if (!insertResponse.ok) {
            const error = await insertResponse.text();
            console.error("[TRIPS] Failed to insert trip - Status:", insertResponse.status, "Error:", error);
            console.error("[TRIPS] Insert payload was:", JSON.stringify(row));
            return { success: false, message: `Failed to insert trip: ${insertResponse.status} - ${error}` };
          }
          
          const insertResult = await insertResponse.json();
          console.log("[TRIPS] Trip inserted successfully:", input.id, "DB response:", JSON.stringify(insertResult).substring(0, 200));
        }

        sendLeaderboardBeatNotifications({
          userId: input.userId,
          userName: input.userName,
          topSpeed: input.topSpeed,
          carModel: input.carModel,
        }).catch(err => console.error("[TRIPS] Leaderboard notification error:", err));

        createActivityFeedEntry(input).catch((err: unknown) => console.error("[TRIPS] Activity feed entry error:", err));

        return { success: true };
      } catch (error) {
        console.error("[TRIPS] Error syncing trip:", input.id, "for user:", input.userId);
        console.error("[TRIPS] Error details:", error instanceof Error ? error.message : String(error));
        return { success: false, message: `Error syncing trip: ${error instanceof Error ? error.message : String(error)}` };
      }
    }),

  getLeaderboardTrips: publicProcedure
    .input(
      z.object({
        category: z.enum([
          "topSpeed",
          "distance",
          "totalDistance",
          "acceleration",
          "gForce",
          "zeroToHundred",
          "zeroToTwoHundred",
        ]),
        country: z.string().optional(),
        city: z.string().optional(),
        carBrand: z.string().optional(),
        carModel: z.string().optional(),
        timePeriod: z.enum(["today", "week", "month", "year", "all"]).optional(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ input }) => {
      console.log("[LEADERBOARD] Fetching leaderboard for category:", input.category, "filters:", JSON.stringify({
        country: input.country,
        city: input.city,
        carBrand: input.carBrand,
        carModel: input.carModel,
        timePeriod: input.timePeriod,
        limit: input.limit,
      }));

      if (!isDbConfigured()) {
        console.log("[LEADERBOARD] Database not configured");
        return [];
      }

      try {
        if (input.category === "totalDistance") {
          return await getTotalDistanceLeaderboard(input);
        }

        let url = getSupabaseRestUrl("trips");
        const params: string[] = [];
        
        params.push("select=id,user_id,user_name,user_profile_picture,start_time,end_time,distance,duration,avg_speed,top_speed,corners,car_model,acceleration,max_g_force,country,city,time_0_to_100,time_0_to_200,time_0_to_300,route_points");

        if (input.country) {
          params.push(`country=eq.${encodeURIComponent(input.country)}`);
        }
        if (input.city) {
          params.push(`city=eq.${encodeURIComponent(input.city)}`);
        }
        if (input.carBrand && input.carModel) {
          const fullModel = `${input.carBrand} ${input.carModel}`;
          params.push(`car_model=eq.${encodeURIComponent(fullModel)}`);
        } else if (input.carBrand) {
          params.push(`car_model=like.${encodeURIComponent(input.carBrand + "*")}`);
        }

        if (input.timePeriod && input.timePeriod !== "all") {
          const now = new Date();
          let startTime: number;
          
          switch (input.timePeriod) {
            case "today":
              startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
              break;
            case "week": {
              const dayOfWeek = (now.getDay() + 6) % 7;
              startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
              break;
            }
            case "month":
              startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
              break;
            case "year":
              startTime = new Date(now.getFullYear(), 0, 1).getTime();
              break;
            default:
              startTime = 0;
          }
          
          if (startTime > 0) {
            params.push(`start_time=gte.${startTime}`);
          }
        }

        let orderBy = "top_speed";
        let ascending = false;
        let filter = "";

        switch (input.category) {
          case "topSpeed":
            orderBy = "top_speed";
            filter = "top_speed=gt.0";
            break;
          case "distance":
            orderBy = "distance";
            filter = "distance=gt.0";
            break;
          case "acceleration":
            orderBy = "acceleration";
            filter = "acceleration=gt.0";
            break;
          case "gForce":
            orderBy = "max_g_force";
            filter = "max_g_force=gt.0";
            break;
          case "zeroToHundred":
            orderBy = "time_0_to_100";
            ascending = true;
            filter = "time_0_to_100=gt.0";
            break;
          case "zeroToTwoHundred":
            orderBy = "time_0_to_200";
            ascending = true;
            filter = "time_0_to_200=gt.0";
            break;
        }

        params.push(filter);
        params.push(`order=${orderBy}.${ascending ? "asc" : "desc"}`);
        params.push(`limit=${input.limit}`);

        url += "?" + params.join("&");

        console.log("[LEADERBOARD] Fetching from:", url);

        const response = await fetch(url, {
          method: "GET",
          headers: getSupabaseHeaders(),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("[LEADERBOARD] Failed to fetch trips:", response.status, error);
          return [];
        }

        const rows: SupabaseTripRow[] = await response.json();
        console.log("[LEADERBOARD] Raw rows returned:", rows.length);
        
        const trips = rows.map(supabaseRowToTrip);
        
        const uniqueUsers = [...new Set(trips.map(t => t.userId))];
        console.log("[LEADERBOARD] Fetched", trips.length, "trips from", uniqueUsers.length, "unique users:", uniqueUsers.map(uid => {
          const t = trips.find(tr => tr.userId === uid);
          return `${t?.userName || 'unknown'}(${uid})`;
        }).join(', '));
        
        return await enrichTripsWithUserCars(trips);
      } catch (error) {
        console.error("[LEADERBOARD] Error fetching trips:", error);
        return [];
      }
    }),

  getUserTrips: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      console.log("[TRIPS] Fetching trips for user:", input.userId);

      if (!isDbConfigured()) {
        console.log("[TRIPS] Database not configured");
        return [];
      }

      try {
        const url = `${getSupabaseRestUrl("trips")}?user_id=eq.${input.userId}&order=start_time.desc`;

        const response = await fetch(url, {
          method: "GET",
          headers: getSupabaseHeaders(),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("[TRIPS] Failed to fetch user trips:", error);
          return [];
        }

        const rows: SupabaseTripRow[] = await response.json();
        const trips = rows.map(supabaseRowToTrip);
        
        console.log("[TRIPS] Fetched", trips.length, "trips for user:", input.userId);
        return trips;
      } catch (error) {
        console.error("[TRIPS] Error fetching user trips:", error);
        return [];
      }
    }),

  deleteTrip: publicProcedure
    .input(z.object({ tripId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      console.log("[TRIPS] Deleting trip:", input.tripId, "for user:", input.userId);

      if (!isDbConfigured()) {
        return { success: false, message: "Database not configured" };
      }

      try {
        const response = await fetch(
          `${getSupabaseRestUrl("trips")}?id=eq.${input.tripId}&user_id=eq.${input.userId}`,
          {
            method: "DELETE",
            headers: getSupabaseHeaders(),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("[TRIPS] Failed to delete trip:", error);
          return { success: false, message: "Failed to delete trip" };
        }

        console.log("[TRIPS] Trip deleted successfully:", input.tripId);
        return { success: true };
      } catch (error) {
        console.error("[TRIPS] Error deleting trip:", error);
        return { success: false, message: "Error deleting trip" };
      }
    }),
});
