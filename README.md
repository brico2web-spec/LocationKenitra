# Kraylia

## Run the site and admin panel

This is a static website. Open `index.html` in a browser, then open `admin-login.html` to manage the site. No Node.js installation, server, or SMTP setup is required.

The initial admin login is `Zamzam` with password `1463414634`. Use “Mot de passe oublié ?” / “نسيت كلمة المرور؟” and the recovery phrase `Nezar` to change it. Site settings, bookings, login state, and any changed password are saved in that browser's local storage.

This browser-only login is a convenience lock, not secure authentication: credentials are part of the client-side website and can be inspected or bypassed. Do not use it to protect sensitive information or as an internet-facing admin account. Changes are not shared across browsers or devices.

The optional `server.js` backend remains available for deployments that need server-side authentication and email recovery; it is not needed to run the static site.
