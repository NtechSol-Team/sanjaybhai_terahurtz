
import "dotenv/config";
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
        console.log("Checking referrers table content...");
        const res = await pool.query(`SELECT * FROM referrers`);
        console.log(`Count: ${res.rowCount}`);
        console.table(res.rows);

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
