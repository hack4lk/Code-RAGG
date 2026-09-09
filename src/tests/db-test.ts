import pool from "../db";

async function testDb() {
  try {
    const result = await pool.query("SELECT NOW()");

    console.log("Database connected!");
    console.log(result.rows);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error);
  } finally {
    await pool.end();
  }
}

testDb();
