// src/utils/token.ts
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class TokenService {
  /**
   * Generate access token
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
      expiresIn: ENV.JWT_ACCESS_EXPIRES_IN,
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
      expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(payload: TokenPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as TokenPayload;
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as TokenPayload;
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): TokenPayload | null {
    return jwt.decode(token) as TokenPayload | null;
  }
}

export const tokenService = new TokenService();