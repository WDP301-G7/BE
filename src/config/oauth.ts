// src/config/oauth.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { ENV } from './env';

// Google OAuth Strategy
if (ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET && ENV.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: ENV.GOOGLE_CLIENT_ID,
        clientSecret: ENV.GOOGLE_CLIENT_SECRET,
        callbackURL: ENV.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          // OAuth logic will be implemented in Phase 1+
          return done(null, profile);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}

// Facebook OAuth Strategy
if (ENV.FACEBOOK_APP_ID && ENV.FACEBOOK_APP_SECRET && ENV.FACEBOOK_CALLBACK_URL) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: ENV.FACEBOOK_APP_ID,
        clientSecret: ENV.FACEBOOK_APP_SECRET,
        callbackURL: ENV.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'emails', 'name', 'picture'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          // OAuth logic will be implemented in Phase 1+
          return done(null, profile);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}

export default passport;
