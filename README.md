# Kraylia

## Run the site and protected admin panel

Requires Node.js 22.13 or newer.

1. Install the dependencies with `npm install`.
2. Create the first admin account in a terminal with `npm run setup-admin`. Enter the username, password, recovery phrase, and recovery email when prompted. Passwords and recovery phrases are entered masked and stored as scrypt hashes in `data/auth.sqlite`.
3. Configure SMTP before enabling password recovery. Copy `.env.example` to `.env`, then fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `PUBLIC_URL` with values from your mail provider and deployment. Set `HOST=0.0.0.0` on a hosting platform. Keep `.env` private; it is excluded from version control.
4. Start the server with `npm start` and open `http://localhost:3000`.

The admin page is served only to a valid, signed-in session. Sessions use HTTP-only, SameSite cookies; production cookies require HTTPS. Admin login is rate-limited. Password recovery verifies the recovery phrase, emails a single-use link, and expires that link after 15 minutes.

Deploy behind HTTPS, configure the SMTP environment variables on the hosting provider, and set `PUBLIC_URL` to the public HTTPS address. Do not expose the site by opening HTML files directly; use the Node server.

The existing car-site settings and booking requests still use browser `localStorage`; this authentication server does not synchronize those records between visitors or devices. The SQLite database currently stores admin credentials (as hashes), sessions, and password reset tokens only.
