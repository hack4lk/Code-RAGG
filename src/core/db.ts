import pg from "pg";
import "dotenv/config";
import { config, logConfig } from "../infrastructure/configSchema.js";

const { Pool } = pg;

const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
});

// Log safe config (passwords hidden)
logConfig();

export default pool;