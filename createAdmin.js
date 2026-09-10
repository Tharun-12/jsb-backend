require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./db");

const email = (process.env.ADMIN_EMAIL || "manitejavadnala079@gmail.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "1234";
const name = process.env.ADMIN_NAME || "Admin";

async function createAdmin() {
  try {
    const [existing] = await db.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    const hashedPassword = await bcrypt.hash(password, 12);

    if (existing.length > 0) {
      await db.execute(
        `UPDATE users SET name = ?, password = ?, role = 'admin', is_active = TRUE WHERE id = ?`,
        [name, hashedPassword, existing[0].id]
      );
      console.log(`Admin user updated: ${email}`);
    } else {
      await db.execute(
        `INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'admin', TRUE)`,
        [name, email, hashedPassword]
      );
      console.log(`Admin user created: ${email}`);
    }

    console.log("Password stored as a bcrypt hash.");
  } catch (error) {
    console.error("Failed to create/update admin:", error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

createAdmin();
