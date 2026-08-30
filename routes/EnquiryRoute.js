const express = require("express");
const router = express.Router();
const db = require("../db");

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'iiiqbets01@gmail.com',
    pass: 'rava xoel gzai rkgx'
  },
  tls: {
    rejectUnauthorized: false
  }
});

const adminEmail = 'manitejavadnala@gmail.com';

// Email template for admin notification (Refreshment Booking)
const getAdminEmailHTML = (data) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1D9E75 0%, #378ADD 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .field { margin-bottom: 12px; }
        .label { font-weight: bold; color: #555; }
        .value { color: #000; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        .status-badge { display: inline-block; background: #4CAF50; color: white; padding: 2px 10px; border-radius: 3px; font-size: 12px; }
        .refreshment-id { background: #1D9E75; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🍽️ New Refreshment Booking</h2>
          <p style="margin: 0; opacity: 0.8;">Refreshment #${data.refreshment_id} - ${new Date().toLocaleString()}</p>
        </div>
        <div class="content">
          <h3 style="margin-top: 0;">Customer Details</h3>
          
          <div class="field">
            <span class="label">Name:</span>
            <span class="value">${data.name}</span>
          </div>
          
          <div class="field">
            <span class="label">Email:</span>
            <span class="value">${data.email}</span>
          </div>
          
          <div class="field">
            <span class="label">Phone:</span>
            <span class="value">${data.mobile}</span>
          </div>
          
          <div class="field">
            <span class="label">Company:</span>
            <span class="value">${data.company_name || 'Not provided'}</span>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          
          <h3>Booking Details</h3>
          
          <div class="field">
            <span class="label">Refreshment ID:</span>
            <span class="refreshment-id">#${data.refreshment_id}</span>
          </div>
          
          <div class="field">
            <span class="label">Package ID:</span>
            <span class="value">${data.product_id || 'N/A'}</span>
          </div>
          
          <div class="field">
            <span class="label">Package Name:</span>
            <span class="value">${data.package_name || 'N/A'}</span>
          </div>
          
          <div class="field">
            <span class="label">Team Size:</span>
            <span class="value">${data.team_size || 'N/A'} people</span>
          </div>
          
          <div class="field">
            <span class="label">Required Date:</span>
            <span class="value">${data.required_date || 'N/A'}</span>
          </div>
          
          <div class="field">
            <span class="label">Type:</span>
            <span class="value">${data.type}</span>
          </div>
          
          <div class="field">
            <span class="label">Status:</span>
            <span class="status-badge">${data.status}</span>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          
          <div class="footer">
            <p>This refreshment booking was submitted through the JSB Gifting website.</p>
            <p>To respond to this booking, reply directly to: <a href="mailto:${data.email}">${data.email}</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Email template for customer confirmation
const getCustomerEmailHTML = (data) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1D9E75 0%, #378ADD 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .field { margin-bottom: 10px; }
        .label { font-weight: bold; color: #555; }
        .value { color: #000; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
        .refreshment-id { background: #1D9E75; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Refreshment Booking Confirmed</h2>
          <p style="margin: 0; opacity: 0.8;">Thank you for your booking!</p>
        </div>
        <div class="content">
          <p>Dear <strong>${data.name}</strong>,</p>
          
          <p>We have received your refreshment booking request and our team will get back to you shortly with confirmation and details.</p>
          
          <h3>Booking Summary</h3>
          
          <div class="field">
            <span class="label">Booking ID:</span>
            <span class="refreshment-id">#${data.refreshment_id}</span>
          </div>
          
          <div class="field">
            <span class="label">Package:</span>
            <span class="value">${data.package_name || 'N/A'}</span>
          </div>
          
          <div class="field">
            <span class="label">Team Size:</span>
            <span class="value">${data.team_size || 'N/A'} people</span>
          </div>
          
          <div class="field">
            <span class="label">Required Date:</span>
            <span class="value">${data.required_date || 'N/A'}</span>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          
          <p style="font-size: 14px; color: #555;">
            We will contact you at <strong>${data.email}</strong> and <strong>${data.mobile}</strong> to confirm your booking.
          </p>
          
          <div class="footer">
            <p>If you have any questions, please reply to this email or contact us at <strong>${adminEmail}</strong></p>
            <p style="margin-top: 10px;">Thank you for choosing JSB Gifting Refreshments!</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Function to send emails
const sendEmails = async (data) => {
  try {
    // Email to admin
    const adminMailOptions = {
      from: 'iiiqbets01@gmail.com',
      to: adminEmail,
      subject: `🍽️ New Refreshment Booking - ${data.name}`,
      html: getAdminEmailHTML(data)
    };

    // Email to customer
    const customerMailOptions = {
      from: 'iiiqbets01@gmail.com',
      to: data.email,
      subject: '✅ Refreshment Booking Confirmed - JSB Gifting',
      html: getCustomerEmailHTML(data)
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(customerMailOptions)
    ]);

    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// ============================================================
// CREATE REFRESHMENT BOOKING
// POST /api/refreshment-bookings
// ============================================================
router.post("/refreshment-bookings", async (req, res) => {
    try {
        const {
            name,
            email,
            mobile,
            company_name,
            team_size,
            package_id,
            package_name,
            required_date,
            type = 'Refreshment Booking',
            status = 'New'
        } = req.body;

        // Validation
        if (!name || !email || !mobile || !company_name || !team_size || !package_id) {
            return res.status(400).json({
                success: false,
                message: "Name, email, mobile, company_name, team_size and package_id are required"
            });
        }

        // Generate refreshment_id (RFP-YYYYMMDD-XXXX)
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        const refreshmentId = `RFP-${dateStr}-${randomStr}`;

        const enquiryDate = new Date().toISOString().split("T")[0];

        const sql = `
            INSERT INTO enquiries
            (
                name,
                email,
                mobile,
                type,
                team_size,
                status,
                enquiry_date,
                company_name,
                quantity,
                refreshment_id,
                package_name
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            name,
            email,
            mobile,
            type,
            parseInt(team_size, 10) || null,
            status,
            enquiryDate,
            company_name,
            parseInt(team_size, 10) || null,
            package_id,
            package_name || null
        ];

        const [result] = await db.query(sql, values);

        // Prepare response data for emails
        const responseData = {
            id: result.insertId,
            refreshment_id: refreshmentId,
            name,
            email,
            mobile,
            company_name,
            team_size: parseInt(team_size, 10) || null,
            package_id,
            package_name: package_name || null,
            required_date: required_date || null,
            type,
            status,
            enquiry_date: enquiryDate
        };

        // Send emails (don't await to not block response)
        sendEmails(responseData).then(success => {
            if (success) {
                console.log(`✅ Emails sent for refreshment booking #${refreshmentId}`);
            } else {
                console.log(`❌ Failed to send emails for refreshment booking #${refreshmentId}`);
            }
        });

        res.status(201).json({
            success: true,
            message: "Refreshment booking created successfully",
            data: responseData
        });

    } catch (error) {
        console.error("CREATE REFRESHMENT BOOKING ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create refreshment booking",
            error: error.message
        });
    }
});

// ============================================================
// CREATE ENQUIRY (Existing)
// POST /api/enquiries
// ============================================================
router.post("/enquiries", async (req, res) => {
    try {
        const {
            name,
            email,
            mobile,
            type,
            team_size,
            status,
            enquiry_date,
            company_name,
            product_id,
            quantity,
            required_date
        } = req.body;

        // Validation
        if (!name || !email || !mobile || !type) {
            return res.status(400).json({
                success: false,
                message: "Name, email, mobile and type are required"
            });
        }

        const enquiryStatus = status || "New";
        const enquiryDate = enquiry_date || new Date().toISOString().split("T")[0];

        const sql = `
            INSERT INTO enquiries
            (
                name,
                email,
                mobile,
                type,
                team_size,
                status,
                enquiry_date,
                company_name,
                product_id,
                quantity,
                required_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            name,
            email,
            mobile,
            type,
            team_size || null,
            enquiryStatus,
            enquiryDate,
            company_name || null,
            product_id || null,
            quantity || null,
            required_date || null
        ];

        const [result] = await db.query(sql, values);

        const responseData = {
            id: result.insertId,
            name,
            email,
            mobile,
            type,
            team_size: team_size || null,
            status: enquiryStatus,
            enquiry_date: enquiryDate,
            company_name: company_name || null,
            product_id: product_id || null,
            quantity: quantity || null,
            required_date: required_date || null
        };

        res.status(201).json({
            success: true,
            message: "Enquiry created successfully",
            data: responseData
        });

    } catch (error) {
        console.error("CREATE ENQUIRY ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create enquiry",
            error: error.message
        });
    }
});




// ============================================================
// GET ALL ENQUIRIES
// GET /api/enquiries
// ============================================================

router.get("/enquiries", async (req, res) => {
    try {

        const sql = `
            SELECT
                id,
                name,
                email,
                mobile,
                type,
                team_size,
                status,
                enquiry_date,
                created_at,
                updated_at
            FROM enquiries
            ORDER BY id DESC
        `;

        const [rows] = await db.query(sql);

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET ENQUIRIES ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch enquiries",
            error: error.message
        });
    }
});


// ============================================================
// GET SINGLE ENQUIRY
// GET /api/enquiries/:id
// ============================================================

router.get("/enquiries/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const sql = `
            SELECT
                id,
                name,
                email,
                mobile,
                type,
                team_size,
                status,
                enquiry_date,
                created_at,
                updated_at
            FROM enquiries
            WHERE id = ?
        `;

        const [rows] = await db.query(sql, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Enquiry not found"
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("GET SINGLE ENQUIRY ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch enquiry",
            error: error.message
        });
    }
});


// ============================================================
// UPDATE ENQUIRY
// PUT /api/enquiries/:id
// ============================================================

router.put("/enquiries/:id", async (req, res) => {
    try {

        const { id } = req.params;

        const {
            name,
            email,
            mobile,
            type,
            team_size,
            status,
            enquiry_date
        } = req.body;

        // Check if enquiry exists
        const [existing] = await db.query(
            "SELECT id FROM enquiries WHERE id = ?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Enquiry not found"
            });
        }

        const sql = `
            UPDATE enquiries
            SET
                name = ?,
                email = ?,
                mobile = ?,
                type = ?,
                team_size = ?,
                status = ?,
                enquiry_date = ?
            WHERE id = ?
        `;

        const values = [
            name,
            email,
            mobile,
            type,
            team_size || null,
            status || "New",
            enquiry_date,
            id
        ];

        await db.query(sql, values);

        res.status(200).json({
            success: true,
            message: "Enquiry updated successfully"
        });

    } catch (error) {
        console.error("UPDATE ENQUIRY ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update enquiry",
            error: error.message
        });
    }
});


// ============================================================
// DELETE ENQUIRY
// DELETE /api/enquiries/:id
// ============================================================

router.delete("/enquiries/:id", async (req, res) => {
    try {

        const { id } = req.params;

        // Check if enquiry exists
        const [existing] = await db.query(
            "SELECT id FROM enquiries WHERE id = ?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Enquiry not found"
            });
        }

        await db.query(
            "DELETE FROM enquiries WHERE id = ?",
            [id]
        );

        res.status(200).json({
            success: true,
            message: "Enquiry deleted successfully"
        });

    } catch (error) {
        console.error("DELETE ENQUIRY ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete enquiry",
            error: error.message
        });
    }
});


module.exports = router;