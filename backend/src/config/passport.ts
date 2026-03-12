import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import pool from './database.js';
import config from './index.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: config.auth.google.clientId || 'dummy',
      clientSecret: config.auth.google.clientSecret || 'dummy',
      callbackURL: config.auth.google.callbackUrl,
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }

        // 1. Check if user exists by email
        let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        let user = userResult.rows[0];

        if (!user) {
          // 2. Create new user if doesn't exist
          const newUserResult = await pool.query(
            'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
            [email, profile.displayName]
          );
          user = newUserResult.rows[0];
        }

        // 3. Check if social identity exists
        const identityResult = await pool.query(
          'SELECT * FROM social_identities WHERE user_id = $1 AND provider = $2',
          [user.id, 'google']
        );

        if (identityResult.rows.length === 0) {
          // 4. Link social identity if not already linked (handles account merging by email)
          await pool.query(
            'INSERT INTO social_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
            [user.id, 'google', profile.id]
          );
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: config.auth.github.clientId || 'dummy',
      clientSecret: config.auth.github.clientSecret || 'dummy',
      callbackURL: config.auth.github.callbackUrl,
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value || profile._json?.email;
        if (!email) {
          return done(new Error('No email found in GitHub profile'));
        }

        let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        let user = userResult.rows[0];

        if (!user) {
          const newUserResult = await pool.query(
            'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
            [email, profile.displayName || profile.username]
          );
          user = newUserResult.rows[0];
        }

        const identityResult = await pool.query(
          'SELECT * FROM social_identities WHERE user_id = $1 AND provider = $2',
          [user.id, 'github']
        );

        if (identityResult.rows.length === 0) {
          await pool.query(
            'INSERT INTO social_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
            [user.id, 'github', profile.id]
          );
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done: any) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done: any) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

export default passport;
