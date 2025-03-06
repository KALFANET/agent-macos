const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

/**
 * בדיקת ה-API Key של ה-Agent
 */
function checkidKey() {
  Logger.info("======== API KEY CHECK ========");
  
  // בדיקת API Key בקובץ agentConfig.json
  const configFile = path.join(__dirname, 'agentConfig.json');
  let configidKey = null;
  
  try {
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      configidKey = config.idKey;
      Logger.info(`✅ API Key in agentConfig.json: ${configidKey ? configidKey.substring(0, 10) + '...' : 'Not found'}`);
    } else {
      Logger.warn("⚠️ agentConfig.json file not found");
    }
  } catch (error) {
    Logger.error(`❌ Error reading agentConfig.json: ${error.message}`);
  }
  
  // בדיקת API Key במשתני סביבה
  const envidKey = process.env.AGENT_API_KEY;
  Logger.info(`✅ API Key in environment: ${envidKey ? envidKey.substring(0, 10) + '...' : 'Not found'}`);
  
  // בדיקת התאמה
  if (configidKey && envidKey && configidKey !== envidKey) {
    Logger.warn("⚠️ API Key mismatch between agentConfig.json and environment variables");
  }
  
  // בדיקת תקינות (האם יש API Key כלשהו)
  const finalidKey = configidKey || envidKey;
  if (!finalidKey) {
    Logger.error("❌ No API Key found in any source");
  } else {
    Logger.info(`✅ Using API Key: ${finalidKey.substring(0, 10)}...`);
  }
  
  Logger.info("==============================");
  
  return finalidKey;
}

module.exports = { checkidKey };