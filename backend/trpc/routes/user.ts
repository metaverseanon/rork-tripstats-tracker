import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DB_ENDPOINT = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
const DB_NAMESPACE = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
const DB_TOKEN = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  country?: string;
  city?: string;
  carBrand?: string;
  carModel?: string;
  createdAt: number;
  welcomeEmailSent: boolean;
}

const getWelcomeEmailHtml = (displayName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DriveTrack</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; text-align: center;">
                🚗 Welcome to DriveTrack
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px; background-color: #1a1a1a;">
              <p style="margin: 0 0 20px; font-size: 18px; line-height: 1.6; color: #ffffff;">
                Hey ${displayName}! 👋
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Thanks for joining DriveTrack! We're excited to have you on board.
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Start tracking your drives, compete on the leaderboard, and connect with fellow car enthusiasts. Every mile counts!
              </p>
              
              <!-- Features -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 15px; background-color: #252525; border-radius: 12px; margin-bottom: 10px;">
                    <p style="margin: 0; font-size: 14px; color: #ffffff;">
                      <strong style="color: #4ade80;">📍 Track Trips</strong><br>
                      <span style="color: #888;">Log your drives and see your stats</span>
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                <tr>
                  <td style="padding: 15px; background-color: #252525; border-radius: 12px;">
                    <p style="margin: 0; font-size: 14px; color: #ffffff;">
                      <strong style="color: #60a5fa;">🏆 Leaderboard</strong><br>
                      <span style="color: #888;">Compete with drivers worldwide</span>
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 10px;"></td></tr>
                <tr>
                  <td style="padding: 15px; background-color: #252525; border-radius: 12px;">
                    <p style="margin: 0; font-size: 14px; color: #ffffff;">
                      <strong style="color: #f472b6;">📊 Monthly Recap</strong><br>
                      <span style="color: #888;">Get insights on your driving habits</span>
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                Ready to hit the road? Open the app and start your first trip!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #141414; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                Drive safe and enjoy the journey! 🛣️
              </p>
              <p style="margin: 15px 0 0; font-size: 12px; color: #444;">
                © ${new Date().getFullYear()} DriveTrack. All rights reserved.
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

async function sendWelcomeEmail(email: string, displayName: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping welcome email");
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
        from: "DriveTrack <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to DriveTrack! 🚗",
        html: getWelcomeEmailHtml(displayName),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send welcome email:", error);
      return false;
    }

    console.log("Welcome email sent to:", email);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return false;
  }
}

async function storeUserInDb(user: StoredUser): Promise<boolean> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    console.log("Database not configured, skipping user storage");
    return false;
  }

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to store user:", error);
      return false;
    }

    console.log("User stored in database:", user.email);
    return true;
  } catch (error) {
    console.error("Error storing user:", error);
    return false;
  }
}

async function getAllUsers(): Promise<StoredUser[]> {
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
    return data.items || data || [];
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export const userRouter = createTRPCRouter({
  register: publicProcedure
    .input(z.object({
      id: z.string(),
      email: z.string().email(),
      displayName: z.string(),
      country: z.string().optional(),
      city: z.string().optional(),
      carBrand: z.string().optional(),
      carModel: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log("Registering new user:", input.email);

      const storedUser: StoredUser = {
        ...input,
        createdAt: Date.now(),
        welcomeEmailSent: false,
      };

      const stored = await storeUserInDb(storedUser);
      const emailSent = await sendWelcomeEmail(input.email, input.displayName);

      if (stored && emailSent) {
        storedUser.welcomeEmailSent = true;
        await storeUserInDb(storedUser);
      }

      return {
        success: true,
        stored,
        welcomeEmailSent: emailSent,
      };
    }),

  getAllEmails: publicProcedure.query(async () => {
    const users = await getAllUsers();
    return users.map(u => ({
      email: u.email,
      displayName: u.displayName,
      createdAt: u.createdAt,
      country: u.country,
      city: u.city,
    }));
  }),

  getStats: publicProcedure.query(async () => {
    const users = await getAllUsers();
    return {
      totalUsers: users.length,
      emailsSent: users.filter(u => u.welcomeEmailSent).length,
    };
  }),
});
