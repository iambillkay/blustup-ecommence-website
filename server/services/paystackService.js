const https = require("https");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || "";

function isConfigured() {
  return Boolean(PAYSTACK_SECRET_KEY && PAYSTACK_PUBLIC_KEY);
}

function getPublicKey() {
  return PAYSTACK_PUBLIC_KEY;
}

function paystackRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.status) {
            return reject(new Error(parsed.message || "Paystack request failed"));
          }
          resolve(parsed);
        } catch (_e) {
          reject(new Error("Failed to parse Paystack response"));
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Initialize a Paystack transaction.
 * @param {string} email - Customer email
 * @param {number} amountKobo - Amount in the smallest currency unit (pesewas for GHS)
 * @param {object} metadata - Extra data to attach to the transaction
 * @param {string} [callbackUrl] - Optional callback URL after payment
 * @returns {Promise<{authorization_url: string, access_code: string, reference: string}>}
 */
async function initializeTransaction(email, amountKobo, metadata = {}, callbackUrl) {
  const body = {
    email,
    amount: Math.round(amountKobo),
    currency: "GHS",
    metadata,
  };
  if (callbackUrl) body.callback_url = callbackUrl;

  const response = await paystackRequest("POST", "/transaction/initialize", body);
  return response.data;
}

/**
 * Verify a Paystack transaction by reference.
 * @param {string} reference
 * @returns {Promise<{status: string, reference: string, amount: number, currency: string, metadata: object}>}
 */
async function verifyTransaction(reference) {
  const response = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
  return response.data;
}

module.exports = {
  isConfigured,
  getPublicKey,
  initializeTransaction,
  verifyTransaction,
};
