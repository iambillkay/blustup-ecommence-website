const { z } = require("zod");

const storage = require("../storage");

const trackEventSchema = z.object({
  eventType: z.string().trim().min(1).max(80),
  sessionId: z.union([z.string().trim().max(120), z.literal(""), z.null()]).optional(),
  eventData: z.record(z.string(), z.unknown()).optional(),
});

exports.trackEvent = async (req, res) => {
  const parsed = trackEventSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid tracking payload" });
  }

  try {
    const { eventType, eventData, sessionId } = parsed.data;
    const userId = req.user ? req.user.sub : null;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    await storage.tracking.add({
      userId,
      sessionId,
      eventType,
      eventData: eventData || {},
      ipAddress,
      userAgent,
    });
    res.status(200).json({ message: "Event tracked" });
  } catch (error) {
    console.error("Tracking error:", error);
    res.status(500).json({ error: error.message });
  }
};
