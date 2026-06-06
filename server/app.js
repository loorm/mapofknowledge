require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express  = require('express');
const session  = require('express-session');
const passport = require('passport');
const path     = require('path');

const authRouter     = require('./routes/auth');   // also registers passport strategy
const apiRouter      = require('./routes/api');
const subsetsRouter  = require('./routes/subsets');
const requireAuth = require('./middleware/requireAuth');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Session (memory store — acceptable for MVP) ───────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Apache terminates TLS; Node sees plain HTTP on port 3000
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Routes ────────────────────────────────────────────────────────────────────
// Public auth endpoints
app.use('/auth', authRouter);

// Protected API
app.use('/api', requireAuth, apiRouter);
app.use('/api/subsets', requireAuth, subsetsRouter);

// Protected app (the D3 knowledge map)
app.use('/app', requireAuth, express.static(path.join(__dirname, '../app')));

// Public landing page and other static assets at root
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

module.exports = app;
