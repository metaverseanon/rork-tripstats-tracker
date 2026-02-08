import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { isDbConfigured, getSupabaseHeaders, getSupabaseRestUrl } from "../db";

const TripLocationSchema = z.object({
  country: z.string().optional(),
  city: z.string().optional(),
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
  created_at?: string;
  updated_at?: string;
}

function tripToSupabaseRow(trip: SyncedTrip): SupabaseTripRow {
  return {
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
}

function supabaseRowToTrip(row: SupabaseTripRow): SyncedTrip {
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
  };
}

export const tripsRouter = createTRPCRouter({
  syncTrip: publicProcedure
    .input(TripStatsSchema)
    .mutation(async ({ input }) => {
      console.log("[TRIPS] Syncing trip:", input.id, "for user:", input.userId);

      if (!isDbConfigured()) {
        console.log("[TRIPS] Database not configured");
        return { success: false, message: "Database not configured" };
      }

      try {
        const row = tripToSupabaseRow(input);
        
        const response = await fetch(
          `${getSupabaseRestUrl("trips")}?id=eq.${input.id}`,
          {
            method: "GET",
            headers: getSupabaseHeaders(),
          }
        );

        const existing = await response.json();
        
        if (Array.isArray(existing) && existing.length > 0) {
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
            console.error("[TRIPS] Failed to update trip:", error);
            return { success: false, message: "Failed to update trip" };
          }
        } else {
          const insertResponse = await fetch(getSupabaseRestUrl("trips"), {
            method: "POST",
            headers: getSupabaseHeaders(),
            body: JSON.stringify(row),
          });

          if (!insertResponse.ok) {
            const error = await insertResponse.text();
            console.error("[TRIPS] Failed to insert trip:", error);
            return { success: false, message: "Failed to insert trip" };
          }
        }

        console.log("[TRIPS] Trip synced successfully:", input.id);
        return { success: true };
      } catch (error) {
        console.error("[TRIPS] Error syncing trip:", error);
        return { success: false, message: "Error syncing trip" };
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
      console.log("[TRIPS] Fetching leaderboard trips for category:", input.category);

      if (!isDbConfigured()) {
        console.log("[TRIPS] Database not configured");
        return [];
      }

      try {
        let url = getSupabaseRestUrl("trips");
        const params: string[] = [];

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
          params.push(`car_model=like.${encodeURIComponent(input.carBrand)}*`);
        }

        if (input.timePeriod && input.timePeriod !== "all") {
          const now = new Date();
          let startTime: number;
          
          switch (input.timePeriod) {
            case "today":
              startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
              break;
            case "week":
              const dayOfWeek = now.getDay();
              startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
              break;
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
          case "totalDistance":
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

        if (params.length > 0) {
          url += "?" + params.join("&");
        }

        console.log("[TRIPS] Fetching from:", url);

        const response = await fetch(url, {
          method: "GET",
          headers: getSupabaseHeaders(),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("[TRIPS] Failed to fetch trips:", error);
          return [];
        }

        const rows: SupabaseTripRow[] = await response.json();
        const trips = rows.map(supabaseRowToTrip);
        
        const uniqueUsers = [...new Set(trips.map(t => t.userName || t.userId))];
        console.log("[TRIPS] Fetched", trips.length, "trips from", uniqueUsers.length, "unique users:", uniqueUsers.join(', '));
        return trips;
      } catch (error) {
        console.error("[TRIPS] Error fetching trips:", error);
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
