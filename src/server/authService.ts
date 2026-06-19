import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is missing. Halting server startup in alignment with strict Phase 4 security instructions. Please define it in your .env or Secrets panel.");
  process.exit(1);
}

// Temporary in-memory OTP register for secure forgotten password workflows (Phase 4)
interface IOtpRecord {
  email: string;
  otpCode: string;
  expiresAt: Date;
}
const otpRegister: Record<string, IOtpRecord> = {};

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = "15m";
  private static readonly REFRESH_TOKEN_EXPIRY = "7d";

  // Bcrypt Password hash creation
  public static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  }

  // Bcrypt Password comparison
  public static async comparePasswords(password: string, hashed: string): Promise<boolean> {
    return await bcrypt.compare(password, hashed);
  }

  // Generate short-lived Access Token containing user ID and email
  public static generateAccessToken(payload: { id: string; email: string }): string {
    return jwt.sign(payload, JWT_SECRET as string, { expiresIn: this.ACCESS_TOKEN_EXPIRY });
  }

  // Generate long-lived Refresh Token
  public static generateRefreshToken(payload: { id: string; email: string }): string {
    return jwt.sign(payload, JWT_SECRET as string, { expiresIn: this.REFRESH_TOKEN_EXPIRY });
  }

  // Verify access or refresh tokens securely
  public static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET as string);
    } catch (err) {
      return null;
    }
  }

  // Create random 6-character numeric OTP
  public static generateOTP(email: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10); // Code active for 10 minutes

    otpRegister[email.toLowerCase()] = {
      email: email.toLowerCase(),
      otpCode: code,
      expiresAt: expiry
    };

    console.info(`🔑 SECURITY: OTP [${code}] issued for user password reset: ${email}. Use this to verify.`);
    return code;
  }

  // Validate OTP code matching
  public static verifyOTP(email: string, code: string): boolean {
    const record = otpRegister[email.toLowerCase()];
    if (!record) return false;

    const now = new Date();
    if (now > record.expiresAt) {
      delete otpRegister[email.toLowerCase()];
      return false; // Code expired
    }

    const isValid = record.otpCode === code;
    if (isValid) {
      delete otpRegister[email.toLowerCase()]; // OTP can only be used once
    }
    return isValid;
  }
}
