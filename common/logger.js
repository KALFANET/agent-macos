const fs = require('fs');
const path = require('path');

class Logger {
    static logFile = path.join(__dirname, '../logs.txt');

    static info(message) {
        console.log("[INFO]", message);
        fs.appendFileSync(this.logFile, `[INFO] ${message}\n`);
    }

    static error(message) {
        console.error("[ERROR]", message);
        fs.appendFileSync(this.logFile, `[ERROR] ${message}\n`);
    }
}

module.exports = Logger;