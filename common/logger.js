const fs = require('fs');
const path = require('path');

/**
 * מערכת רישום לוגים פשוטה
 */
class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    
    // יצירת תיקיית לוגים אם לא קיימת
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logFile = path.join(this.logDir, `agent-${new Date().toISOString().split('T')[0]}.log`);
  }
  
  // רישום ללוג עם חותמת זמן
  _log(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return arg;
    }).join(' ');
    
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    // הדפסה לקונסולה
    console.log(`[${level}] ${message}`);
    
    // רישום לקובץ
    fs.appendFileSync(this.logFile, logEntry);
  }
  
  // רמות רישום שונות
  info(...args) {
    this._log('INFO', ...args);
  }
  
  warn(...args) {
    this._log('WARN', ...args);
  }
  
  error(...args) {
    this._log('ERROR', ...args);
  }
  
  debug(...args) {
    if (process.env.DEBUG) {
      this._log('DEBUG', ...args);
    }
  }
}

module.exports = new Logger();