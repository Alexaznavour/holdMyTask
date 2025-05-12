/**
 * Simple in-memory session storage for the Telegram bot
 * In a production environment, you might want to use Redis or another database
 */
class SessionService {
  constructor() {
    this.sessions = {};
  }

  /**
   * Get a session for a user
   * @param {number} userId - Telegram user ID
   * @returns {Object} Session object
   */
  getSession(userId) {
    if (!this.sessions[userId]) {
      this.sessions[userId] = {
        state: null,
        data: {},
        lastActivity: Date.now()
      };
    }
    
    this.sessions[userId].lastActivity = Date.now();
    return this.sessions[userId];
  }

  /**
   * Set session state
   * @param {number} userId - Telegram user ID
   * @param {string} state - State to set
   */
  setState(userId, state) {
    const session = this.getSession(userId);
    session.state = state;
    return session;
  }

  /**
   * Set session data
   * @param {number} userId - Telegram user ID
   * @param {string} key - Data key
   * @param {any} value - Data value
   */
  setData(userId, key, value) {
    const session = this.getSession(userId);
    session.data[key] = value;
    return session;
  }

  /**
   * Clear session data
   * @param {number} userId - Telegram user ID
   */
  clearSession(userId) {
    if (this.sessions[userId]) {
      this.sessions[userId] = {
        state: null,
        data: {},
        lastActivity: Date.now()
      };
    }
  }

  /**
   * Clean up old sessions (utility method)
   * @param {number} maxAgeMs - Maximum age of sessions in milliseconds
   */
  cleanupSessions(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    Object.keys(this.sessions).forEach(userId => {
      if (now - this.sessions[userId].lastActivity > maxAgeMs) {
        delete this.sessions[userId];
      }
    });
  }
}

// Create a singleton instance
const sessionService = new SessionService();

// Set up periodic cleanup
setInterval(() => {
  sessionService.cleanupSessions();
}, 60 * 60 * 1000); // Every hour

module.exports = sessionService; 