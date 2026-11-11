# Kraylia

## Run the site and admin panel

Install Node.js 20 or newer, then run `npm install` and `npm start`. Open `http://localhost:3000/` for the site or `http://localhost:3000/admin.html` for the admin panel.

## Configure the server

Set `CLOUDINARY_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in the server's environment. For local development, copy `.env.example` values into the ignored `.env` file and use your Cloudinary credentials and a strong password. Never commit `.env` or put Cloudinary secrets in browser code.

Deploy `server.js` to a Node.js host, set `ALLOWED_ORIGINS` there to `https://brico2web-spec.github.io`, and set `window.KrayliaApiBaseUrl` in `api-config.js` to the server's HTTPS base URL. The API checks credentials on the server and requires a valid session for uploads and settings changes.

Images uploaded from the vehicle form are sent to Cloudinary by the server. The exact `secure_url` returned by Cloudinary is stored as the vehicle's `image` value in the shared site settings. The public website loads those settings from `/api/site`, so uploaded vehicles and images appear to visitors after refreshing; they no longer depend on the admin browser's local storage.

The server stores shared settings in `SITE_CONFIG_PATH` (default `./data/site-config.json`). Use a persistent disk for this file on the hosting provider, and point `SITE_CONFIG_PATH` to that mounted disk. The included file storage is intended for a single server instance; multiple instances require a shared database. `site-data.js` continues to provide the built-in defaults and browser-only fallback. Bookings remain browser-local.
