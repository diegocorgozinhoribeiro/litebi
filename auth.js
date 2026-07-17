'use strict';
/*
 * auth.js — estratégias de autenticação (Passport): e-mail+senha e Google OAuth.
 */
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const LEGAL = require('./legal');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
      [id]
    );
    done(null, rows[0] || false);
  } catch (e) {
    done(e);
  }
});

// ---- E-mail + senha ----
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [String(email || '').toLowerCase().trim()]
      );
      const u = rows[0];
      if (!u || !u.password_hash) {
        return done(null, false, { message: 'E-mail ou senha inválidos.' });
      }
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) return done(null, false, { message: 'E-mail ou senha inválidos.' });
      return done(null, u);
    } catch (e) {
      return done(e);
    }
  }
));

// ---- Google OAuth (ativado apenas se as credenciais existirem) ----
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  const base = (process.env.BASE_URL || '').replace(/\/$/, '');
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: base + '/auth/google/callback',
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = (
          (profile.emails && profile.emails[0] && profile.emails[0].value) || ''
        ).toLowerCase();
        const googleId = profile.id;
        const name = profile.displayName || (email ? email.split('@')[0] : 'Usuário');
        const avatar = (profile.photos && profile.photos[0] && profile.photos[0].value) || null;

        const { rows } = await pool.query(
          'SELECT * FROM users WHERE google_id = $1 OR email = $2',
          [googleId, email]
        );
        let u = rows[0];
        if (u) {
          if (!u.google_id) {
            await pool.query(
              'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3',
              [googleId, avatar, u.id]
            );
          }
        } else {
          const consent = req.session && req.session.legalConsent;
          const consentIsCurrent = consent
            && Date.now() - Number(consent.acceptedAt) < 15 * 60 * 1000
            && consent.termsVersion === LEGAL.termsVersion
            && consent.privacyVersion === LEGAL.privacyVersion;
          if (!consentIsCurrent) return done(null, false, { message: 'legal_required' });
          const ins = await pool.query(
            `INSERT INTO users (email, name, google_id, avatar_url, legal_accepted_at, terms_version, privacy_version)
             VALUES ($1, $2, $3, $4, now(), $5, $6, $7) RETURNING *`,
            [email, name, googleId, avatar, LEGAL.termsVersion, LEGAL.privacyVersion]
          );
          u = ins.rows[0];
          delete req.session.legalConsent;
        }
        return done(null, u);
      } catch (e) {
        return done(e);
      }
    }
  ));
  console.log('[LiteBI] Google OAuth habilitado.');
} else {
  console.log('[LiteBI] Google OAuth desabilitado (defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).');
}

module.exports = passport;
