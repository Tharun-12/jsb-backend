const express = require("express");
const router = express.Router();

const db = require("../db");


// ============================================================
// CREATE ENQUIRY
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
            enquiry_date
        } = req.body;

        // Validation
        if (!name || !email || !mobile || !type) {
            return res.status(400).json({
                success: false,
                message: "Name, email, mobile and type are required"
            });
        }

        const enquiryStatus = status || "New";

        const enquiryDate =
            enquiry_date ||
            new Date().toISOString().split("T")[0];

        const sql = `
            INSERT INTO enquiries
            (
                name,
                email,
                mobile,
                type,
                team_size,
                status,
                enquiry_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            name,
            email,
            mobile,
            type,
            team_size || null,
            enquiryStatus,
            enquiryDate
        ];

        const [result] = await db.query(sql, values);

        res.status(201).json({
            success: true,
            message: "Enquiry created successfully",
            data: {
                id: result.insertId,
                name,
                email,
                mobile,
                type,
                team_size: team_size || null,
                status: enquiryStatus,
                enquiry_date: enquiryDate
            }
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