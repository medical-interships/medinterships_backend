import express from "express";
import mysql from "mysql2/promise";
import config from "./config.js";

const app = express();
app.use(express.json());

// Create MySQL connection pool (best practice)
const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
});

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running 🚀" });
});

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
