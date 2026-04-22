## MongoDB Atlas + Vercel Setup

This project already supports MongoDB. It switches to Mongo storage when:

- `STORAGE_MODE=mongo`, or
- `MONGODB_URI` is set

### 1. Create a free Atlas database

1. Sign in to MongoDB Atlas.
2. Create a project.
3. Create a Free cluster.
4. Under `Security` -> `Database Access`, create a database user.
5. Under `Security` -> `Network Access`, add an IP access list entry.

For Vercel, the simplest public setup is:

- `0.0.0.0/0`

Use a strong database password if you allow access from anywhere.

### 2. Copy the Atlas connection string

In Atlas:

1. Open your cluster.
2. Click `Connect`.
3. Choose `Drivers`.
4. Select `Node.js`.
5. Copy the SRV connection string.

Important:

- Replace the Atlas password placeholder with your real password and remove any surrounding `< >`.
- Add your app database name in the path, for example `/blustup`, instead of leaving just `/?...`.

Use a database name like `blustup` in the URI:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/blustup?retryWrites=true&w=majority&appName=blustup
```

Example conversion:

```env
# Atlas placeholder style
mongodb+srv://blustup_db_user:22388812@cluster0.myfdqg2.mongodb.net/?appName=Cluster0

# App-ready URI
mongodb+srv://blustup_db_user:22388812@cluster0.myfdqg2.mongodb.net/blustup?retryWrites=true&w=majority&appName=Cluster0
```

### 3. Local `.env` example

```env
PORT=3000
NODE_ENV=development
STORAGE_MODE=mongo
CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/blustup?retryWrites=true&w=majority&appName=blustup
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=choose-a-strong-password
```

### 4. Vercel environment variables

Set these in your Vercel project:

```env
NODE_ENV=production
STORAGE_MODE=mongo
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/blustup?retryWrites=true&w=majority&appName=blustup
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=choose-a-strong-password
CORS_ORIGINS=https://your-project.vercel.app,https://www.yourdomain.com
```

Optional:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `REPORT_EMAIL_FROM`

### 5. Verify

After deployment:

1. Open `https://your-project.vercel.app/api/health`
2. Confirm it returns JSON with `ok: true`
3. Open the site and test login, products, and admin

### Notes

- MongoDB Atlas is the best fit for this repo because the backend already uses Mongoose.
- PostgreSQL would require a storage-layer rewrite.
- File uploads still write to local disk in this codebase, so for production you should prefer image URLs or move uploads to Blob / S3 / Cloudinary.
