class Tracking {
  constructor() {
    this.sessionId = this.getSessionId();
  }

  getSessionId() {
    let id = localStorage.getItem('sessionId');
    if (!id) {
      id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('sessionId', id);
    }
    return id;
  }

  async track(eventType, eventData = {}) {
    try {
      const token = (typeof getToken === "function" ? getToken() : null) || localStorage.getItem("blustup_token") || sessionStorage.getItem("blustup_token");
      const response = await fetch('/api/tracking/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ eventType, eventData, sessionId: this.sessionId }),
      });
      if (!response.ok) {
        throw new Error('Tracking failed');
      }
    } catch (error) {
      console.error('Tracking error:', error);
    }
  }
}

const tracker = new Tracking();
window.tracker = tracker;
