# Starfleet Communications Module

A Star Trek: The Next Generation-inspired real-time chat application built with Express, MongoDB, EJS, and Socket.IO.

The interface presents crew profiles through an LCARS-style dashboard. Authenticated users can search the crew directory, see presence changes, open a private conversation, and exchange messages in real time.

## What it demonstrates

- Session-based registration and login
- Password hashing with bcrypt
- MongoDB-backed users, messages, and production sessions
- Authenticated Socket.IO connections
- Private user rooms and server-authorized conversation history
- Online presence across multiple browser tabs
- Crew search across names, ranks, ships, and species
- MongoDB-backed profile images
- Responsive EJS interface with an LCARS visual system

## Application structure

```text
app.js                 Express, sessions, Socket.IO, and startup
controllers/           Account and crew-directory operations
middlewares/           Authentication, CSRF, uploads, headers, and rate limits
models/                Mongoose models for users, messages, and sessions
routes/                HTTP route definitions
views/                 EJS pages and shared partials
public/                Browser JavaScript, styles, fonts, and default avatar
```

Messages are written through the authenticated Socket.IO connection. The server derives the sender from the session, validates the recipient, stores the message, and emits it only to the recipient's private room. The browser never supplies a trusted sender ID.

## Security controls

- HTTP-only, same-site session cookies; secure cookies in production
- MongoDB session storage in production
- Session regeneration after login
- CSRF validation for every state-changing HTTP form
- Rate limiting on login and registration
- Server-side authorization for chat history and message delivery
- Escaped DOM rendering for message text
- Restrictive security headers and frame protection
- Upload allowlist for JPEG, PNG, and WebP files with a 1 MB limit
- Authenticated avatar delivery with immutable browser caching
- Generic authentication errors to avoid username enumeration

## Local setup

Requirements:

- Node.js 20 or newer
- MongoDB

```bash
git clone https://github.com/aminmoji/Starfleet-Communications-Module.git
cd Starfleet-Communications-Module
npm ci
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | Set to `production` for secure cookies and persistent sessions |
| `PORT` | No | HTTP port; defaults to `3000` |
| `DATABASE_URL` | Yes | MongoDB connection string |
| `SESSION_SECRET` | Production | Long random value used to sign session cookies |

Uploaded profile images are stored with the user record in MongoDB and limited to 1 MB. This keeps the portfolio deployment self-contained and avoids relying on an ephemeral server filesystem.

## Deploy on Render

The repository includes a `render.yaml` Blueprint for a free Render web service. It installs production dependencies, waits for GitHub CI to pass before deploying, and checks `/health` before promoting a build.

1. Create or reuse a MongoDB Atlas database.
2. In Render, create a new Blueprint from this repository.
3. Enter the Atlas connection string when Render prompts for `DATABASE_URL`.
4. Deploy the Blueprint. Render generates `SESSION_SECRET` automatically.

No payment method is required for the free service. Free Render services sleep after periods of inactivity, so the first request after a quiet period can take about a minute.

## Verification

```bash
npm run check
npm test
```

The test suite checks health responses, security headers, CSRF issuance, and invalid CSRF rejection. Database behavior is exercised by the application against the configured MongoDB instance.

## Project background

This began as a 2023 boot-camp project and remains a portfolio example of a traditional server-rendered Node.js application with real-time features.

The LCARS stylesheet is credited in its source to [Jim Robertus / The LCARS Computer Network](https://www.thelcars.com/). Star Trek and related marks belong to their respective owners; this is an unofficial, non-commercial fan project.

Application code is released under [The Unlicense](LICENSE).
