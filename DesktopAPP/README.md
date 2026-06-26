# Tinku Mobiles - Desktop Application (Offline Local System)

This directory contains the desktop app version of the project, configured to run completely offline on a local machine using **NativePHP** (powered by Electron) and a self-contained **SQLite** database.

## Prerequisites

Make sure you have the following installed on your machine:
* PHP 8.2 or 8.3+
* Node.js & NPM
* Composer

---

## How to Run in Development Mode

1. **Build the Frontend Assets:**
   Compile the React frontend into the Laravel backend's public folder so it can be served locally:
   ```bash
   cd frontend
   npm run build
   ```

2. **Start the Desktop Application:**
   Navigate to the backend directory and launch the NativePHP Electron server:
   ```bash
   cd ../backend
   php artisan native:serve
   ```
   *This command will download the Electron runner (on first boot) and open the desktop application window automatically.*

---

## Database Migrations & Seeding (SQLite)

NativePHP automatically creates a local persistent SQLite database file on your machine (e.g., under `AppData/Roaming` on Windows).

To run migrations or seed the database locally:
```bash
cd backend
php artisan migrate
php artisan db:seed
```

---

## Building the Desktop App for Production

To compile the application into a standalone standalone installer (`.exe` for Windows, `.dmg` / `.app` for Mac):

```bash
cd backend
php artisan native:build
```
The compiled installer will be generated in the `backend/dist` folder.
