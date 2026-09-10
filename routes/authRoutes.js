const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");

const db = require("../db");
const authenticateToken = require("../middleware/authMiddleware");
const sendOTP = require("../Utils/mailer");

require("dotenv").config();

const router = express.Router();


// =====================================================
// TEMPORARY FORGOT PASSWORD DATA
// No database changes required
// =====================================================

const passwordResetStore = new Map();


// =====================================================
// CREATE JWT
// =====================================================

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};


// =====================================================
// ADMIN LOGIN
// POST /api/admin/login
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();


    const [users] = await db.execute(
      `
      SELECT
        id,
        name,
        email,
        password,
        role,
        is_active
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [normalizedEmail]
    );


    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }


    const user = users[0];


    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled",
      });
    }


    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have admin access",
      });
    }


    const passwordMatch = await bcrypt.compare(
      String(password),
      user.password
    );


    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }


    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT configuration missing",
      });
    }


    const token = createToken(user);


    return res.json({
      success: true,
      message: "Login successful",

      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {

    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


// =====================================================
// FORGOT PASSWORD
// POST /api/admin/forgot-password
// =====================================================

router.post("/forgot-password", async (req, res) => {
  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }


    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();


    const [users] = await db.execute(
      `
      SELECT
        id,
        email,
        role,
        is_active
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [normalizedEmail]
    );


    if (
      users.length === 0 ||
      users[0].role !== "admin"
    ) {
      return res.status(400).json({
        success: false,
        message: "Admin email not matched",
      });
    }


    const user = users[0];


    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled",
      });
    }


    // Generate OTP

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
      digits: true,
    });


    // Store temporarily in server memory

    passwordResetStore.set(normalizedEmail, {
      otp: otp,
      verified: false,
      createdAt: Date.now(),
    });


    // Send OTP

    try {

      await sendOTP(
        normalizedEmail,
        otp
      );

    } catch (mailError) {

      console.error(
        "OTP email error:",
        mailError
      );

      passwordResetStore.delete(
        normalizedEmail
      );

      return res.status(500).json({
        success: false,
        message: "Email sending failed",
      });
    }


    return res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (error) {

    console.error(
      "Forgot password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


// =====================================================
// VERIFY OTP
// POST /api/admin/verify-otp
// =====================================================

router.post("/verify-otp", async (req, res) => {
  try {

    const { email, otp } = req.body;


    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }


    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();


    const resetData =
      passwordResetStore.get(
        normalizedEmail
      );


    if (!resetData) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }


    // OTP valid for 5 minutes

    if (
      Date.now() - resetData.createdAt >
      5 * 60 * 1000
    ) {

      passwordResetStore.delete(
        normalizedEmail
      );

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }


    if (
      String(resetData.otp) !==
      String(otp).trim()
    ) {

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }


    // Mark verified

    resetData.verified = true;


    passwordResetStore.set(
      normalizedEmail,
      resetData
    );


    return res.json({
      success: true,
      message: "OTP verified",
    });

  } catch (error) {

    console.error(
      "Verify OTP error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


// =====================================================
// RESET PASSWORD
// POST /api/admin/reset-password
// =====================================================

router.post("/reset-password", async (req, res) => {
  try {

    const {
      email,
      password,
    } = req.body;


    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }


    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters",
      });
    }


    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();


    // Check OTP verification

    const resetData =
      passwordResetStore.get(
        normalizedEmail
      );


    if (
      !resetData ||
      resetData.verified !== true
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Please verify OTP before resetting password",
      });
    }


    // Find admin

    const [users] = await db.execute(
      `
      SELECT
        id,
        email,
        role,
        is_active
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [normalizedEmail]
    );


    if (
      users.length === 0 ||
      users[0].role !== "admin"
    ) {

      return res.status(400).json({
        success: false,
        message: "Admin email not matched",
      });
    }


    const user = users[0];


    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been disabled",
      });
    }


    // Hash new password

    const hashedPassword =
      await bcrypt.hash(
        String(password),
        12
      );


    // Update existing users table

    await db.execute(
      `
      UPDATE users
      SET password = ?
      WHERE id = ?
      `,
      [
        hashedPassword,
        user.id,
      ]
    );


    // Remove temporary reset data

    passwordResetStore.delete(
      normalizedEmail
    );


    return res.json({
      success: true,
      message:
        "Password reset successful",
    });

  } catch (error) {

    console.error(
      "Reset password error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Password update failed",
    });
  }
});


// =====================================================
// GET CURRENT ADMIN
// GET /api/admin/me
// =====================================================

router.get(
  "/me",
  authenticateToken,
  async (req, res) => {

    try {

      const [users] = await db.execute(
        `
        SELECT
          id,
          name,
          email,
          role,
          is_active,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [req.user.id]
      );


      if (
        users.length === 0 ||
        !users[0].is_active ||
        users[0].role !== "admin"
      ) {

        return res.status(401).json({
          success: false,
          message:
            "User account is not available",
        });
      }


      return res.json({
        success: true,
        user: users[0],
      });

    } catch (error) {

      console.error(
        "Get current admin error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Internal server error",
      });
    }
  }
);


module.exports = router;