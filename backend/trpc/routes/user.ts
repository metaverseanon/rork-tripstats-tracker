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
  pushToken?: string | null;
}

interface PasswordResetCode {
  email: string;
  code: string;
  expiresAt: number;
}

const passwordResetCodes: Map<string, PasswordResetCode> = new Map();

const getWelcomeEmailHtml = (displayName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to RedLine</title>
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
                🚗 Welcome to RedLine
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
                Thanks for joining RedLine! We're excited to have you on board.
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
              <img src="https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/pnnoj3a6b358u5apkxo4m" alt="RedLine" style="height: 40px; margin-bottom: 15px;" />
              <p style="margin: 0; font-size: 14px; color: #666;">
                Drive safe and enjoy the journey! 🛣️
              </p>
              <p style="margin: 15px 0 0; font-size: 12px; color: #444;">
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
        from: "RedLine <info@redlineapp.io>",
        to: [email],
        subject: "Welcome to RedLine! 🚗",
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

async function updateUserInDb(userId: string, updates: Partial<StoredUser>): Promise<boolean> {
  if (!DB_ENDPOINT || !DB_NAMESPACE || !DB_TOKEN) {
    console.log("Database not configured");
    return false;
  }

  try {
    const response = await fetch(`${DB_ENDPOINT}/${DB_NAMESPACE}/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${DB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to update user:", error);
      return false;
    }

    console.log("User updated in database:", userId);
    return true;
  } catch (error) {
    console.error("Error updating user:", error);
    return false;
  }
}

async function getUsersWithPushTokens(): Promise<StoredUser[]> {
  const users = await getAllUsers();
  return users.filter(u => u.pushToken);
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

function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const getPasswordResetEmailHtml = (displayName: string, code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - RedLine</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; text-align: center;">
                🔐 Password Reset
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px; background-color: #1a1a1a;">
              <p style="margin: 0 0 20px; font-size: 18px; line-height: 1.6; color: #ffffff;">
                Hey ${displayName}! 👋
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #b0b0b0;">
                We received a request to reset your password. Use the code below to reset it:
              </p>
              <div style="background-color: #252525; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: 8px;">
                  ${code}
                </p>
              </div>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #888;">
                This code will expire in 15 minutes. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #141414; border-radius: 0 0 16px 16px; text-align: center;">
              <img src="https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/pnnoj3a6b358u5apkxo4m" alt="RedLine" style="height: 40px; margin-bottom: 15px;" />
              <p style="margin: 0; font-size: 12px; color: #444;">
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

async function sendPasswordResetEmail(email: string, displayName: string, code: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping password reset email");
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
        subject: "Password Reset Code - RedLine 🔐",
        html: getPasswordResetEmailHtml(displayName, code),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send password reset email:", error);
      return false;
    }

    console.log("Password reset email sent to:", email);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}

export const userRouter = createTRPCRouter({
  checkDisplayName: publicProcedure
    .input(z.object({
      displayName: z.string(),
    }))
    .query(async ({ input }) => {
      console.log("Checking display name availability:", input.displayName);
      const users = await getAllUsers();
      const isTaken = users.some(
        (user) => user.displayName.toLowerCase() === input.displayName.toLowerCase()
      );
      return {
        available: !isTaken,
        displayName: input.displayName,
      };
    }),

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

  updatePushToken: publicProcedure
    .input(z.object({
      userId: z.string(),
      pushToken: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      console.log("Updating push token for user:", input.userId);
      const success = await updateUserInDb(input.userId, { pushToken: input.pushToken });
      return { success };
    }),

  getUsersWithNotifications: publicProcedure.query(async () => {
    const users = await getUsersWithPushTokens();
    return users.map(u => ({
      id: u.id,
      displayName: u.displayName,
      pushToken: u.pushToken,
    }));
  }),

  getNearbyUsers: publicProcedure
    .input(z.object({
      userId: z.string(),
      country: z.string().optional(),
      city: z.string().optional(),
    }))
    .query(async ({ input }) => {
      console.log("Fetching nearby users for:", input.userId);
      const users = await getAllUsers();
      
      const nearbyUsers = users.filter(u => {
        if (u.id === input.userId) return false;
        if (input.city && u.city === input.city) return true;
        if (input.country && u.country === input.country) return true;
        return false;
      });

      return nearbyUsers.map(u => ({
        id: u.id,
        displayName: u.displayName,
        country: u.country,
        city: u.city,
        carBrand: u.carBrand,
        carModel: u.carModel,
        hasPushToken: !!u.pushToken,
      }));
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      console.log("Password reset requested for:", input.email);
      const users = await getAllUsers();
      const user = users.find(u => u.email.toLowerCase() === input.email.toLowerCase());
      
      if (!user) {
        return { success: true, message: "If an account exists, a reset code will be sent." };
      }

      const code = generateResetCode();
      const expiresAt = Date.now() + 15 * 60 * 1000;
      
      passwordResetCodes.set(input.email.toLowerCase(), {
        email: input.email.toLowerCase(),
        code,
        expiresAt,
      });

      const emailSent = await sendPasswordResetEmail(input.email, user.displayName, code);
      
      return { 
        success: true, 
        emailSent,
        message: "If an account exists, a reset code will be sent."
      };
    }),

  verifyResetCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string(),
    }))
    .mutation(async ({ input }) => {
      console.log("Verifying reset code for:", input.email);
      const storedData = passwordResetCodes.get(input.email.toLowerCase());
      
      if (!storedData) {
        return { valid: false, error: "No reset code found. Please request a new one." };
      }

      if (Date.now() > storedData.expiresAt) {
        passwordResetCodes.delete(input.email.toLowerCase());
        return { valid: false, error: "Reset code has expired. Please request a new one." };
      }

      if (storedData.code !== input.code) {
        return { valid: false, error: "Invalid code. Please try again." };
      }

      return { valid: true };
    }),

  clearResetCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      passwordResetCodes.delete(input.email.toLowerCase());
      return { success: true };
    }),
});
