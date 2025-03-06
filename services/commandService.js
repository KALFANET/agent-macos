const { exec } = require('child_process');
const Logger = require('../common/logger');

/**
 * שירות לניהול ביצוע פקודות
 */
class CommandService {
  constructor() {
    // רשימת פקודות אסורות/מסוכנות
    this.blacklistedCommands = [
      'rm -rf', 
      'sudo rm', 
      'dd if=',
      'mkfs',
      ':(){:|:&};:'  // Fork bomb
    ];
  }
  
  /**
   * בדיקה האם פקודה מותרת
   */
  isCommandAllowed(command) {
    return !this.blacklistedCommands.some(blacklisted => 
      command.toLowerCase().includes(blacklisted.toLowerCase())
    );
  }
  
  /**
   * ביצוע פקודה
   */
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      // בדיקה שהפקודה מותרת
      if (!this.isCommandAllowed(command)) {
        Logger.error(`🛑 Blocked potentially dangerous command: ${command}`);
        return reject(new Error('This command is not allowed for security reasons'));
      }
      
      Logger.info(`⚙️ Executing command: ${command}`);
      
      exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
          Logger.error(`❌ Command execution error: ${error.message}`);
          return reject(error);
        }
        
        Logger.info(`✅ Command executed successfully`);
        resolve({ stdout, stderr });
      });
    });
  }
}

module.exports = CommandService;