module.exports = {
  port: process.env.PORT || 3000,

  db: {
    host: process.env.DB_HOST || "mysql",
    name: process.env.DB_NAME || "internship_db",
    user: process.env.DB_USER || "root",
    pass: process.env.DB_PASS || "Itachi12",
    port: process.env.DB_PORT || 3306,
  },

  jwtSecret: process.env.JWT_SECRET || "supersecret123",
};
