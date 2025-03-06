const Logger = require('../common/logger');

/**
 * שירות לניהול הסטטוס של המכשיר
 */
class StatusService {
  constructor(backendClient) {
    this.backendClient = backendClient;
    this.updateInterval = null;
    this.intervalMs = 5 * 60 * 1000; // כל 5 דקות
  }
  
  /**
   * התחלת עדכון סטטוס תקופתי
   */
  startStatusUpdateInterval() {
    // עצירת הרצות קודמות אם יש
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    Logger.info(`⏱️ Starting status update interval (every ${this.intervalMs / 1000 / 60} minutes)`);
    
    // עדכון ראשוני
    this.updateStatus('online');
    
    // עדכון תקופתי
    this.updateInterval = setInterval(() => {
      this.updateStatus('online');
    }, this.intervalMs);
    
    // טיפול בסגירת האפליקציה
    process.on('exit', () => {
      this.stopStatusUpdateInterval();
      this.updateStatus('offline');
    });
  }
  
  /**
   * עצירת עדכון סטטוס תקופתי
   */
  stopStatusUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      Logger.info(`⏱️ Stopped status update interval`);
    }
  }
  
  /**
   * עדכון סטטוס בשרת הראשי
   */
  async updateStatus(status) {
    try {
      Logger.info(`🔄 Updating status to: ${status}`);
      
      const result = await this.backendClient.updateStatus(status);
      
      if (result) {
        Logger.info(`✅ Status updated successfully to: ${status}`);
        global.isOnline = status === 'online';
        return true;
      } else {
        Logger.error(`❌ Failed to update status`);
        return false;
      }
    } catch (error) {
      Logger.error(`❌ Error updating status: ${error.message}`);
      return false;
    }
  }
}

module.exports = StatusService;