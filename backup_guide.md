# Euro Motors IT Inventory - Backup & Recovery Guide

This guide is designed for the Operations Team to safely backup and restore the core system. 

## 1. What Needs to be Backed Up?

To ensure you can restore the system entirely during an emergency (like a laptop failure or format), you **MUST** back up the following four items:

1. **The Database:** Contains all your Live Assets, Assignments, and System Users.
2. **The Frontend Folder (`src`, `public` etc.):** Contains all the visual design and screens.
3. **The Backend Folder (`backend`):** Contains the engine and server logic.
4. **Environment Files (`.env`, `.env.local`):** **CRITICAL!** These files contain the secret security passwords to your database and authentication keys.

---

## 2. Best Practice: Where to Store Backups

Never store your backups on the same laptop running the software.
- **External Drive:** Copy the backup folder to a company-owned USB or External Hard Drive.
- **Secure Cloud Storage:** Upload the `.zip` file into OneDrive, Google Drive, or SharePoint in a heavily restricted folder.

### Recommended Backup Filename Format:
`EM_IT_Backup_YYYY_MM_DD.zip` (Example: `EM_IT_Backup_2026_04_27.zip`)

### Recommended Backup Schedule:
- **Weekly Backups:** Recommended every Friday at the end of the shift.

---

## 3. Step-by-Step: Backing Up the Database

You can back up the database using the graphical interface (pgAdmin) or the command line. Choose the method you are most comfortable with.

### Method A: Using pgAdmin (Easiest)
1. Open **pgAdmin 4** on your computer.
2. Expand `Servers` -> `PostgreSQL` -> `Databases`.
3. Right-click on **`euromotors_it_inventory`**.
4. Select **Backup...**
5. In the "Filename" box, click the folder icon and name it `database_backup.sql`.
6. Format: Choose **Custom** or **Tar**.
7. Click the **Backup** button. A green success message will appear at the bottom right when finished.

### Method B: Using Terminal (Advanced)
Open Command Prompt and run this exact command:
```bash
pg_dump -U postgres -p 5433 -F c euromotors_it_inventory > "C:\Backups\database_backup.sql"
```
*(It will ask for your postgres password before creating the file).*

---

## 4. Disaster Recovery (Restoring the System)

If the computer completely crashes and you are installing the software on a brand-new laptop, follow these steps exactly:

### Step 1: Restore the Files
Move your saved `.env` files, `backend` folder, and `frontend` folder onto the new computer. 

### Step 2: Restore the Database
You must have PostgreSQL installed on the new computer first.

**Using pgAdmin:**
1. Open pgAdmin, right-click `Databases` -> **Create Database**. Name it `euromotors_it_inventory`.
2. Right-click the newly created database and click **Restore...**
3. Select your saved backup file (`database_backup.sql`).
4. Format: Select **Custom or Tar**.
5. Click **Restore**.

**Using Terminal:**
If you prefer a fast terminal command:
```bash
pg_restore -U postgres -p 5433 -d euromotors_it_inventory "C:\Backups\database_backup.sql"
```

### Step 3: Restart the Application
Once the database is restored and your files are in place, the application can be safely launched using your standard startup procedures. All users, passwords, and assignments will still be active just as they were!
