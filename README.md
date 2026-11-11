# Kraylia

## Run the site and admin panel

Install Node.js 20 or newer, then run `npm install` and `npm start`. Open `http://localhost:3000/` for the site or `http://localhost:3000/admin.html` for the admin panel. This runs the local Express server and stores shared settings in `data/site-config.json`.

## Configure the server

For local development, copy `.env.example` to `.env`, add your Cloudinary credentials, and use a strong admin password. Keep `.env` private and never put Cloudinary secrets in browser code.

For Vercel, deploy this project from its root so the `api/` directory becomes serverless functions. In the Vercel project, create and connect a **public Vercel Blob store**; this site configuration contains public website content, so visitors need read access. Add these environment variables for Production (and Preview if used):

- `CLOUDINARY_URL`: your Cloudinary URL
- `ADMIN_USERNAME` and `ADMIN_PASSWORD`: admin credentials
- `ADMIN_SESSION_SECRET`: a randomly generated secret with at least 32 bytes
- `BLOB_READ_WRITE_TOKEN`: added when connecting the Blob store
- `ALLOWED_ORIGINS`: optional; add any separate site origins such as `https://brico2web-spec.github.io`

Generate `ADMIN_SESSION_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and add the output directly to Vercel's Environment Variables; do not commit it. The Vercel site uses same-origin API routes, so leave `window.KrayliaApiBaseUrl` empty in `api-config.js`. Redeploy after adding the variables. Vercel Blob is persistent across serverless invocations; the local Express server is for local development.

Images uploaded from the vehicle form are sent to Cloudinary by the server. The exact `secure_url` returned by Cloudinary is stored as the vehicle's `image` value in shared Vercel Blob settings. The public website loads those settings from `/api/site`, so uploaded vehicles and images appear to visitors after refreshing; they no longer depend on the admin browser's local storage.

The local server stores shared settings in `SITE_CONFIG_PATH` (default `./data/site-config.json`). On Vercel the API uses Blob storage instead of the serverless filesystem, which is not persistent. `site-data.js` continues to provide the built-in defaults and browser-only fallback. Bookings remain browser-local.
