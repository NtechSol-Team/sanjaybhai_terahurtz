
import { storage } from "../server/storage";
// Access pool from the storage instance if possible, or just import pg directly if pool isn't exported.
// Looking at storage.ts, pool is not exported. But storage is the default export.
// Actually, I can just rely on the fact that storage initializes connection.
// But to run raw queries I need the pool.
// Use pg directly with the env var.

import pg from "pg";
const { Pool } = pg;

async function check() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not set");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log("Checking referrers table schema...");
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'referrers';
    `);
        console.table(res.rows);

        console.log("Checking patients table schema (id type)...");
        const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'patients' AND column_name = 'id';
    `);
        console.table(res2.rows);

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
