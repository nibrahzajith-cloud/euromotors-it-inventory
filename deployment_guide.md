# Euro Motors IT Inventory - Deployment Guide

This guide provides a step-by-step strategy for deploying the application stack into a live production environment.

---

## 1. Environment Configuration

Before deploying, you must configure the exact security keys for both the Frontend and Backend.

### Backend Required Keys (`backend/.env` or Cloud Dashboard)
- **`DATABASE_URL`**: The connection string pointing to your live production PostgreSQL database.
- **`JWT_SECRET`**: A completely random, long cryptographic string (e.g., `EM_Super_Secret_Key_xyz`) used to generate user sessions.
- **`PORT`**: Usually `5000` (or leave it blank to let cloud providers assign one dynamically).

### Frontend Required Keys (`.env.local` or Cloud Dashboard)
- **`VITE_API_URL`**: The live URL of your deployed backend server (e.g., `https://euromotors-backend.onrender.com/api`). 

---

## 2. Database Deployment

For maximum stability, we recommend migrating your local database to a Managed Serverless Cloud Database.

**Recommended Platforms**: Supabase, Render Postgres, or Neon Database.

### Step-by-Step Migration:
1. Create a new project on your chosen platform (e.g., Supabase).
2. Grab the `DATABASE_URL` connection string provided by the cloud provider.
3. Open your backend folder using the command line.
4. Update the local `.env` with the new cloud `DATABASE_URL`.
5. Run the migration command to push the schema into the cloud: 
   `npx prisma db push`
   *(This ensures your cloud database matches your local Prisma tables perfectly!)*

---

## 3. Backend Deployment (Node.js/Express)

The backend must run on a server that supports executing Node APIs continuously. 

**Recommended Platform**: Render or Railway (Extremely simple Github integration).

### Step-by-Step Deployment (Render Example):
1. Connect your Github account to Render and create a new **Web Service**.
2. Point it straight to the `backend` folder in your repository.
3. **Build Command**: `npm install`
4. **Start Command**: `node index.js`
5. Navigate to the **Environment** tab inside Render and add your three required variables: `DATABASE_URL`, `JWT_SECRET`, and `PORT`.
6. Click **Deploy**. Write down the Live URL Render assigns you (You will need this for the frontend).

---

## 4. Frontend Deployment (React/Vite)

Because Vite bundles React into static HTML/JS logic, it can be deployed on blazing-fast static CDNs for free.

**Recommended Platform**: Vercel or Netlify.

### Step-by-Step Deployment (Vercel Example):
1. Go to Vercel and Import your GitHub Repository.
2. Ensure the Framework Preset is set to **Vite**.
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. Open the **Environment Variables** section and add:
   `VITE_API_URL` -> *(Paste the Backend Live URL you copied from Render)*
6. Click **Deploy**.

---

## 5. Security & Production Guardrails 🛡️

To prevent the application from crashing in production, confirm these final checks:

- **CORS Matrix**: Inside `backend/index.js`, ensure the `cors()` middleware strictly targets your new Vercel App URL. If CORS fails, the browser will aggressively block logins.
- **Dynamic Routing**: Do NOT hardcode `http://localhost:5000` anywhere in `App.jsx` or `AssetProfile.jsx`. The exact system uses `import.meta.env.VITE_API_URL` to dynamically swap between local testing and live targets correctly.
- **Cryptographic Independence**: Changing the `JWT_SECRET` in production will violently force a logout for all users. Keep the secret key safely stored offline.
