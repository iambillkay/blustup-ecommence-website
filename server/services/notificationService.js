const { isMailConfigured, sendMail } = require("./mailService");

function formatMoney(value) {
  return `GHS ${Number(value || 0).toFixed(2)}`;
}

async function sendOrderConfirmation(order) {
  if (!isMailConfigured()) return;
  
  const subject = `Order Confirmed: ${order.reference}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2563eb;">Thank you for your order!</h2>
      <p>Hi ${order.customerName},</p>
      <p>Your order <strong>${order.reference}</strong> has been received and is being processed.</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;">
      <p><strong>Order Summary:</strong></p>
      <ul style="list-style: none; padding: 0;">
        ${order.items.map(item => `
          <li style="margin-bottom: 10px;">${item.name} x ${item.qty} - ${formatMoney(item.price * item.qty)}</li>
        `).join('')}
      </ul>
      <p><strong>Total: ${formatMoney(order.total)}</strong></p>
      <p>We'll notify you as soon as your items are on the way.</p>
      <footer style="margin-top: 30px; font-size: 12px; color: #666;">
        &copy; ${new Date().getFullYear()} Blustup E-commerce
      </footer>
    </div>
  `;

  return sendMail({
    to: order.customerEmail,
    subject,
    html
  });
}

async function sendShippingUpdate(order) {
  if (!isMailConfigured()) return;

  const subject = `Your order is on the way! ${order.reference}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2563eb;">Order Shipped! 🚀</h2>
      <p>Hi ${order.customerName},</p>
      <p>Great news! Your order <strong>${order.reference}</strong> has been shipped and is heading your way.</p>
      <p>Our rider will contact you shortly at <strong>${order.customerPhone}</strong> for delivery.</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;">
      <p>Thank you for shopping with Blustup!</p>
      <footer style="margin-top: 30px; font-size: 12px; color: #666;">
        &copy; ${new Date().getFullYear()} Blustup E-commerce
      </footer>
    </div>
  `;

  return sendMail({
    to: order.customerEmail,
    subject,
    html
  });
}

async function sendDeliveryConfirmation(order) {
  if (!isMailConfigured()) return;

  const subject = `Order Delivered: ${order.reference}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #10b981;">Order Delivered!</h2>
      <p>Hi ${order.customerName},</p>
      <p>Your order <strong>${order.reference}</strong> has been successfully delivered. We hope you love your purchase!</p>
      <p>Have a moment? We'd love to hear your feedback on the storefront.</p>
      <footer style="margin-top: 30px; font-size: 12px; color: #666;">
        &copy; ${new Date().getFullYear()} Blustup E-commerce
      </footer>
    </div>
  `;

  return sendMail({
    to: order.customerEmail,
    subject,
    html
  });
}

module.exports = {
  sendOrderConfirmation,
  sendShippingUpdate,
  sendDeliveryConfirmation
};
