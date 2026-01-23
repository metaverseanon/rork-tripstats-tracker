import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DB_ENDPOINT = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
const DB_NAMESPACE = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
const DB_TOKEN = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

interface WeeklyStats {
  totalTrips: number;
  totalDistance: number;
  topSpeed: number;
  avgSpeed: number;
  totalDuration: number;
  maxGForce: number;
  best0to100: number | null;
  corners: number;
}

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  value: number;
  isCurrentUser: boolean;
}

interface UserTripData {
  id: string;
  email: string;
  displayName: string;
  country?: string;
  city?: string;
  trips: {
    id: string;
    startTime: number;
    distance: number;
    duration: number;
    topSpeed: number;
    avgSpeed: number;
    maxGForce?: number;
    time0to100?: number;
    corners: number;
    location?: {
      country?: string;
      city?: string;
    };
  }[];
}

const getWeeklyEmailHtml = (
  displayName: string,
  stats: WeeklyStats,
  leaderboard: LeaderboardEntry[],
  userRank: number | null,
  country: string,
  weekRange: string
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly RedLine Recap</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px 16px 0 0;">
              <img src="https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/pnnoj3a6b358u5apkxo4m" alt="RedLine" style="height: 36px; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff;">
                Weekly Recap 📊
              </h1>
              <p style="margin: 10px 0 0; font-size: 14px; color: #888888;">
                ${weekRange}
              </p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px; background-color: #1a1a1a;">
              <p style="margin: 0; font-size: 18px; line-height: 1.6; color: #ffffff;">
                Hey ${displayName}! 👋
              </p>
              <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: #888888;">
                Here's how you performed this week on the road.
              </p>
            </td>
          </tr>
          
          <!-- Stats Section -->
          <tr>
            <td style="padding: 0 40px 30px; background-color: #1a1a1a;">
              <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #ffffff; border-bottom: 1px solid #333; padding-bottom: 10px;">
                📈 Your Week in Numbers
              </h2>
              
              <!-- Stats Grid -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #1e3a5f 0%, #1a2d47 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.5px;">Total Trips</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${stats.totalTrips}</p>
                  </td>
                  <td style="width: 8px;"></td>
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #1e3a5f 0%, #1a2d47 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #4ade80; text-transform: uppercase; letter-spacing: 0.5px;">Distance</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${stats.totalDistance.toFixed(1)} <span style="font-size: 14px; color: #888;">km</span></p>
                  </td>
                </tr>
                <tr><td colspan="3" style="height: 8px;"></td></tr>
                <tr>
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #5f1e1e 0%, #471a1a 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #f87171; text-transform: uppercase; letter-spacing: 0.5px;">Top Speed</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${Math.round(stats.topSpeed)} <span style="font-size: 14px; color: #888;">km/h</span></p>
                  </td>
                  <td style="width: 8px;"></td>
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #4a1e5f 0%, #371a47 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #c084fc; text-transform: uppercase; letter-spacing: 0.5px;">Avg Speed</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${Math.round(stats.avgSpeed)} <span style="font-size: 14px; color: #888;">km/h</span></p>
                  </td>
                </tr>
                <tr><td colspan="3" style="height: 8px;"></td></tr>
                <tr>
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #1e5f3a 0%, #1a4730 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px;">Drive Time</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${formatDuration(stats.totalDuration)}</p>
                  </td>
                  <td style="width: 8px;"></td>
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #5f4a1e 0%, #47371a 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">Corners</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${stats.corners}</p>
                  </td>
                </tr>
                ${stats.maxGForce > 0 || stats.best0to100 ? `
                <tr><td colspan="3" style="height: 8px;"></td></tr>
                <tr>
                  ${stats.maxGForce > 0 ? `
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #5f1e4a 0%, #471a37 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #f472b6; text-transform: uppercase; letter-spacing: 0.5px;">Max G-Force</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${stats.maxGForce.toFixed(2)} <span style="font-size: 14px; color: #888;">G</span></p>
                  </td>
                  ` : '<td style="width: 50%;"></td>'}
                  <td style="width: 8px;"></td>
                  ${stats.best0to100 ? `
                  <td style="width: 50%; padding: 12px; background: linear-gradient(135deg, #1e4a5f 0%, #1a3747 100%); border-radius: 12px; vertical-align: top;">
                    <p style="margin: 0; font-size: 12px; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.5px;">Best 0-100</p>
                    <p style="margin: 5px 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">${stats.best0to100.toFixed(1)} <span style="font-size: 14px; color: #888;">sec</span></p>
                  </td>
                  ` : '<td style="width: 50%;"></td>'}
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          
          <!-- Leaderboard Section -->
          ${leaderboard.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 30px; background-color: #1a1a1a;">
              <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #ffffff; border-bottom: 1px solid #333; padding-bottom: 10px;">
                🏆 ${country} Leaderboard - Top Speed
              </h2>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                ${leaderboard.map((entry, index) => `
                <tr>
                  <td style="padding: 12px 15px; background-color: ${entry.isCurrentUser ? '#2a2a4a' : '#252525'}; border-radius: ${index === 0 ? '12px 12px 0 0' : index === leaderboard.length - 1 ? '0 0 12px 12px' : '0'}; ${index < leaderboard.length - 1 ? 'border-bottom: 1px solid #333;' : ''}">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="width: 40px;">
                          <span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background-color: ${entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : '#444'}; color: ${entry.rank <= 3 ? '#000' : '#fff'}; font-weight: 700; font-size: 12px;">
                            ${entry.rank}
                          </span>
                        </td>
                        <td style="color: ${entry.isCurrentUser ? '#60a5fa' : '#ffffff'}; font-size: 15px; font-weight: ${entry.isCurrentUser ? '600' : '400'};">
                          ${entry.displayName} ${entry.isCurrentUser ? '(You)' : ''}
                        </td>
                        <td style="text-align: right; color: #fbbf24; font-size: 15px; font-weight: 600;">
                          ${Math.round(entry.value)} km/h
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `).join('')}
              </table>
              
              ${userRank && userRank > 10 ? `
              <p style="margin: 15px 0 0; font-size: 14px; color: #888888; text-align: center;">
                You're currently ranked <strong style="color: #60a5fa;">#${userRank}</strong> in ${country}. Keep pushing! 🚀
              </p>
              ` : ''}
            </td>
          </tr>
          ` : `
          <tr>
            <td style="padding: 0 40px 30px; background-color: #1a1a1a;">
              <div style="padding: 20px; background-color: #252525; border-radius: 12px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #888888;">
                  No regional leaderboard available yet. Complete more trips to see how you rank! 🏎️
                </p>
              </div>
            </td>
          </tr>
          `}
          
          <!-- Motivational CTA -->
          <tr>
            <td style="padding: 0 40px 30px; background-color: #1a1a1a;">
              <div style="padding: 25px; background: linear-gradient(135deg, #CC0000 0%, #8B0000 100%); border-radius: 12px; text-align: center;">
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  ${stats.totalTrips === 0 ? "No trips this week? Time to hit the road! 🛣️" : stats.totalTrips >= 5 ? "Amazing week! You're on fire! 🔥" : "Good progress! Keep pushing those limits! 💪"}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #141414; border-radius: 0 0 16px 16px; text-align: center;">
              <img src="https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/pnnoj3a6b358u5apkxo4m" alt="RedLine" style="height: 32px; margin-bottom: 15px;" />
              <p style="margin: 0; font-size: 13px; color: #666;">
                Drive safe and enjoy the journey! 🛣️
              </p>
              <p style="margin: 15px 0 0; font-size: 11px; color: #444;">
                © ${new Date().getFullYear()} RedLine. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

function getWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday - 7);
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  return {
    start: lastMonday,
    end: lastSunday,
    label: `${formatDate(lastMonday)} - ${formatDate(lastSunday)}, ${lastSunday.getFullYear()}`
  };
}

async function getAllUsersWithTrips(): Promise<UserTripData[]> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    console.log("Database not configured");
    return [];
  }

  try {
    const usersResponse = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/users`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!usersResponse.ok) {
      console.error("Failed to fetch users");
      return [];
    }

    const usersData = await usersResponse.json();
    const users = usersData.items || usersData || [];

    const tripsResponse = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/trips`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    let allTrips: any[] = [];
    if (tripsResponse.ok) {
      const tripsData = await tripsResponse.json();
      allTrips = tripsData.items || tripsData || [];
    }

    return users.map((user: any) => ({
      ...user,
      trips: allTrips.filter((trip: any) => trip.userId === user.id),
    }));
  } catch (error) {
    console.error("Error fetching users with trips:", error);
    return [];
  }
}

function calculateWeeklyStats(trips: UserTripData['trips'], weekStart: Date, weekEnd: Date): WeeklyStats {
  const weeklyTrips = trips.filter(trip => {
    const tripDate = new Date(trip.startTime);
    return tripDate >= weekStart && tripDate <= weekEnd;
  });

  if (weeklyTrips.length === 0) {
    return {
      totalTrips: 0,
      totalDistance: 0,
      topSpeed: 0,
      avgSpeed: 0,
      totalDuration: 0,
      maxGForce: 0,
      best0to100: null,
      corners: 0,
    };
  }

  const totalDistance = weeklyTrips.reduce((sum, t) => sum + t.distance, 0);
  const totalDuration = weeklyTrips.reduce((sum, t) => sum + t.duration, 0);
  const topSpeed = Math.max(...weeklyTrips.map(t => t.topSpeed));
  const avgSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 3600 : 0;
  const maxGForce = Math.max(...weeklyTrips.map(t => t.maxGForce || 0));
  const times0to100 = weeklyTrips.map(t => t.time0to100).filter((t): t is number => t !== undefined && t > 0);
  const best0to100 = times0to100.length > 0 ? Math.min(...times0to100) : null;
  const corners = weeklyTrips.reduce((sum, t) => sum + t.corners, 0);

  return {
    totalTrips: weeklyTrips.length,
    totalDistance,
    topSpeed,
    avgSpeed,
    totalDuration,
    maxGForce,
    best0to100,
    corners,
  };
}

function calculateRegionalLeaderboard(
  users: UserTripData[],
  country: string,
  currentUserId: string
): { leaderboard: LeaderboardEntry[]; userRank: number | null } {
  const usersInCountry = users.filter(u => u.country === country && u.trips.length > 0);
  
  const userTopSpeeds = usersInCountry.map(user => {
    const topSpeed = user.trips.length > 0 ? Math.max(...user.trips.map(t => t.topSpeed)) : 0;
    return {
      id: user.id,
      displayName: user.displayName,
      topSpeed,
    };
  });

  userTopSpeeds.sort((a, b) => b.topSpeed - a.topSpeed);

  const userRankIndex = userTopSpeeds.findIndex(u => u.id === currentUserId);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : null;

  const top10 = userTopSpeeds.slice(0, 10).map((user, index) => ({
    rank: index + 1,
    displayName: user.displayName,
    value: user.topSpeed,
    isCurrentUser: user.id === currentUserId,
  }));

  return { leaderboard: top10, userRank };
}

async function sendWeeklyEmail(
  email: string,
  displayName: string,
  stats: WeeklyStats,
  leaderboard: LeaderboardEntry[],
  userRank: number | null,
  country: string,
  weekRange: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping weekly email");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RedLine <info@redlineapp.io>",
        to: [email],
        subject: `Your Weekly RedLine Recap 📊 - ${stats.totalTrips} trips, ${stats.totalDistance.toFixed(1)} km`,
        html: getWeeklyEmailHtml(displayName, stats, leaderboard, userRank, country, weekRange),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send weekly email:", error);
      return false;
    }

    console.log("Weekly email sent to:", email);
    return true;
  } catch (error) {
    console.error("Error sending weekly email:", error);
    return false;
  }
}

export const weeklyEmailRouter = createTRPCRouter({
  sendWeeklyRecap: publicProcedure
    .input(z.object({
      userId: z.string().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      console.log("Starting weekly recap email job...");
      
      const users = await getAllUsersWithTrips();
      const { start, end, label } = getWeekRange();
      
      let sentCount = 0;
      let failedCount = 0;
      const results: { email: string; success: boolean }[] = [];

      const usersToProcess = input?.userId 
        ? users.filter(u => u.id === input.userId)
        : users;

      for (const user of usersToProcess) {
        if (!user.email) continue;

        const stats = calculateWeeklyStats(user.trips, start, end);
        const country = user.country || 'Global';
        const { leaderboard, userRank } = calculateRegionalLeaderboard(users, country, user.id);

        const success = await sendWeeklyEmail(
          user.email,
          user.displayName,
          stats,
          leaderboard,
          userRank,
          country,
          label
        );

        results.push({ email: user.email, success });
        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      console.log(`Weekly recap job completed: ${sentCount} sent, ${failedCount} failed`);
      
      return {
        success: true,
        totalUsers: usersToProcess.length,
        sent: sentCount,
        failed: failedCount,
        weekRange: label,
        results,
      };
    }),

  previewWeeklyEmail: publicProcedure
    .input(z.object({
      displayName: z.string(),
      country: z.string().optional(),
    }))
    .query(({ input }) => {
      const { label } = getWeekRange();
      
      const mockStats: WeeklyStats = {
        totalTrips: 7,
        totalDistance: 342.5,
        topSpeed: 185,
        avgSpeed: 72,
        totalDuration: 14400,
        maxGForce: 1.2,
        best0to100: 6.8,
        corners: 156,
      };

      const mockLeaderboard: LeaderboardEntry[] = [
        { rank: 1, displayName: 'SpeedDemon', value: 245, isCurrentUser: false },
        { rank: 2, displayName: 'RoadRunner', value: 220, isCurrentUser: false },
        { rank: 3, displayName: input.displayName, value: 185, isCurrentUser: true },
        { rank: 4, displayName: 'NightRider', value: 178, isCurrentUser: false },
        { rank: 5, displayName: 'TurboMax', value: 165, isCurrentUser: false },
      ];

      return {
        html: getWeeklyEmailHtml(
          input.displayName,
          mockStats,
          mockLeaderboard,
          3,
          input.country || 'Global',
          label
        ),
        weekRange: label,
      };
    }),
});
