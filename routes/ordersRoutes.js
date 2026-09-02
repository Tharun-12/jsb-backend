// routes/orders.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { transporter, adminEmail } = require('../config/nodemailer');

// Create a new order
router.post('/orders', async (req, res) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    company_name,
    delivery_address,
    total_amount,
    total_items,
    status,
    items
  } = req.body;

  // Start a transaction
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Insert order
    const [orderResult] = await connection.query(
      `INSERT INTO orders (
        customer_name, 
        customer_email, 
        customer_phone, 
        company_name, 
        delivery_address, 
        total_amount, 
        total_items, 
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        customer_name,
        customer_email,
        customer_phone,
        company_name || null,
        delivery_address,
        total_amount,
        total_items,
        status || 'pending'
      ]
    );

    const orderId = orderResult.insertId;

    // 2. Insert order items
    if (items && items.length > 0) {
      const orderItemsValues = items.map(item => [
        orderId,
        item.product_id || null,
        item.refreshment_id || null,
        item.name,
        item.price,
        item.bulk_price || item.price,
        item.quantity,
        item.category,
        item.discount || 0,
        item.image || '',
        item.item_type || 'product'
      ]);

      await connection.query(
        `INSERT INTO order_items (
          order_id,
          product_id,
          refreshment_id,
          item_name,
          price,
          bulk_price,
          quantity,
          category,
          discount,
          image,
          item_type
        ) VALUES ?`,
        [orderItemsValues]
      );
    }

    await connection.commit();

    // 3. Send emails after successful order placement
    try {
      await sendOrderEmails(orderId, {
        customer_name,
        customer_email,
        customer_phone,
        company_name,
        delivery_address,
        total_amount,
        total_items,
        status: status || 'pending', // ✅ Pass status here
        items
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the order if email fails, just log the error
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { id: orderId }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  } finally {
    connection.release();
  }
});

// Function to send order emails
async function sendOrderEmails(orderId, orderData) {
  const {
    customer_name,
    customer_email,
    customer_phone,
    company_name,
    delivery_address,
    total_amount,
    total_items,
    status, // ✅ Now status is properly passed
    items
  } = orderData;

  // Format date
  const orderDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const orderTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Generate items HTML
  const itemsHtml = items.map((item, index) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">${index + 1}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">
        <strong>${item.name}</strong><br>
        <span style="color: #6b7280; font-size: 12px;">${item.category || 'N/A'} | ${item.item_type || 'product'}</span>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.bulk_price || item.price}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${((item.bulk_price || item.price) * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => sum + ((item.bulk_price || item.price) * item.quantity), 0);
  const discount = subtotal - total_amount;

  // Admin Email HTML
  const adminEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Order #${orderId}</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
        .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #5FD9C4, #6FA8E8); padding: 30px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .header p { color: rgba(255,255,255,0.9); margin: 5px 0 0; }
        .content { padding: 30px; }
        .order-info { background-color: #f3f4f6; border-radius: 8px; padding: 15px 20px; margin-bottom: 25px; }
        .order-info p { margin: 5px 0; color: #374151; font-size: 14px; }
        .order-info strong { color: #111827; }
        .section-title { font-size: 18px; font-weight: bold; color: #111827; margin: 20px 0 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        .total-row { font-weight: bold; background-color: #f9fafb; }
        .total-row td { border-top: 2px solid #111827; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .badge { display: inline-block; background-color: #fbbf24; color: #111827; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛒 New Order Received</h1>
          <p>Order #${orderId} • ${orderDate} at ${orderTime}</p>
        </div>
        <div class="content">
          <div class="order-info">
            <p><strong>Customer:</strong> ${customer_name}</p>
            <p><strong>Email:</strong> ${customer_email}</p>
            <p><strong>Phone:</strong> ${customer_phone}</p>
            ${company_name ? `<p><strong>Company:</strong> ${company_name}</p>` : ''}
            <p><strong>Delivery Address:</strong> ${delivery_address}</p>
          </div>

          <h3 class="section-title">Order Items (${total_items} items)</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td colspan="4" style="text-align: right; padding: 12px;">Subtotal:</td>
                <td style="text-align: right; padding: 12px;">₹${subtotal.toFixed(2)}</td>
              </tr>
              ${discount > 0 ? `
              <tr>
                <td colspan="4" style="text-align: right; padding: 12px; color: #059669;">Discount:</td>
                <td style="text-align: right; padding: 12px; color: #059669;">-₹${discount.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="4" style="text-align: right; padding: 12px; font-size: 16px;">Total:</td>
                <td style="text-align: right; padding: 12px; font-size: 18px; color: #5FD9C4;">₹${total_amount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #5FD9C4;">
            <p style="margin: 0; color: #065f46; font-size: 14px;">
              <strong>Status:</strong> <span class="badge">${status || 'PENDING'}</span>
            </p>
            <p style="margin: 5px 0 0; color: #065f46; font-size: 13px;">
              This order requires your attention. Please process it as soon as possible.
            </p>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated notification from JSB Gifting Platform.</p>
          <p>© ${new Date().getFullYear()} JSB. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // User Email HTML
  const userEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation #${orderId}</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
        .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #5FD9C4, #6FA8E8); padding: 30px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .header p { color: rgba(255,255,255,0.9); margin: 5px 0 0; }
        .content { padding: 30px; }
        .thank-you { text-align: center; margin-bottom: 25px; }
        .thank-you h2 { color: #111827; margin: 0; }
        .thank-you p { color: #6b7280; margin: 5px 0 0; }
        .order-info { background-color: #f3f4f6; border-radius: 8px; padding: 15px 20px; margin-bottom: 25px; }
        .order-info p { margin: 5px 0; color: #374151; font-size: 14px; }
        .order-info strong { color: #111827; }
        .section-title { font-size: 18px; font-weight: bold; color: #111827; margin: 20px 0 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        .total-row { font-weight: bold; background-color: #f9fafb; }
        .total-row td { border-top: 2px solid #111827; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        .badge { display: inline-block; background-color: #fbbf24; color: #111827; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .btn { display: inline-block; background: linear-gradient(135deg, #5FD9C4, #6FA8E8); color: #ffffff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Order Confirmed!</h1>
          <p>Thank you for your order, ${customer_name}!</p>
        </div>
        <div class="content">
          <div class="thank-you">
            <h2>Order #${orderId}</h2>
            <p>Placed on ${orderDate} at ${orderTime}</p>
          </div>

          <div class="order-info">
            <p><strong>Delivery Address:</strong> ${delivery_address}</p>
            ${company_name ? `<p><strong>Company:</strong> ${company_name}</p>` : ''}
            <p><strong>Contact:</strong> ${customer_phone}</p>
          </div>

          <h3 class="section-title">Your Order Items (${total_items} items)</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td colspan="4" style="text-align: right; padding: 12px;">Subtotal:</td>
                <td style="text-align: right; padding: 12px;">₹${subtotal.toFixed(2)}</td>
              </tr>
              ${discount > 0 ? `
              <tr>
                <td colspan="4" style="text-align: right; padding: 12px; color: #059669;">Discount:</td>
                <td style="text-align: right; padding: 12px; color: #059669;">-₹${discount.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="4" style="text-align: right; padding: 12px; font-size: 16px;">Total:</td>
                <td style="text-align: right; padding: 12px; font-size: 18px; color: #5FD9C4;">₹${total_amount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          
        </div>
        <div class="footer">
          <p>Thank you for shopping with JSB Gifting!</p>
          <p>For any queries, contact us at support@jsbgifting.com</p>
          <p>© ${new Date().getFullYear()} JSB. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email to admin
  const adminMailOptions = {
    from: '"JSB Gifting" <iiiqbets01@gmail.com>',
    to: adminEmail,
    subject: `🛒 New Order #${orderId} - ${customer_name}`,
    html: adminEmailHtml
  };

  // Send email to customer
  const userMailOptions = {
    from: '"JSB Gifting" <iiiqbets01@gmail.com>',
    to: customer_email,
    subject: `✅ Order Confirmation #${orderId} - JSB Gifting`,
    html: userEmailHtml
  };

  // Send both emails
  await Promise.all([
    transporter.sendMail(adminMailOptions),
    transporter.sendMail(userMailOptions)
  ]);
}

// Get orders
router.get('/orders', async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT * FROM orders ORDER BY created_at DESC`
    );
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get order by ID with items
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE id = ?`,
      [id]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const [items] = await db.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...orders[0],
        items
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update order status
router.put('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE orders SET status = ? WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get orders by order_id - only order_items table
router.get('/orders/order-items/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const [items] = await db.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No order items found for order ID ${orderId}`
      });
    }

    res.json({
      success: true,
      data: {
        order_id: orderId,
        items: items
      }
    });

  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order items'
    });
  }
});

module.exports = router;