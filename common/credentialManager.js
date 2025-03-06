const keytar = require('keytar');

const SERVICE_NAME = "AgentMacService";
const ACCOUNT_NAME = "deviceToken";

class CredentialManager {
    static async saveToken(token) {
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
    }

    static async getToken() {
        return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    }
}
// הוספת מידלוור לאימות API Key
const validateidKey = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const configFile = path.join(__dirname, 'agentConfig.json');
    
    let idKey = null;
    
    // קריאה של ה-API Key מקובץ הקונפיגורציה
    try {
        if (fs.existsSync(configFile)) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            idKey = config.idKey;
        }
    } catch (error) {
        console.error('❌ Error reading API Key from config file:', error);
    }
    
    // אם לא נמצא בקובץ, ננסה לקרוא מה-.env
    if (!idKey && process.env.AGENT_API_KEY) {
        idKey = process.env.AGENT_API_KEY;
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== idKey) {
        Logger.error('❌ Authentication failed: Invalid API Key');
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    }
    
    next();
};

// הגדרת שרת ה-Express של ה-Agent
const setupAgentServer = () => {
    const agentServer = express();
    agentServer.use(express.json());
    
    // נקודת קצה לביצוע פקודות
    agentServer.post('/execute', validateidKey, (req, res) => {
        const { command } = req.body;
        
        if (!command) {
            Logger.error('❌ No command provided');
            return res.status(400).json({ error: 'No command provided' });
        }
        
        Logger.info(`📌 Executing command: ${command}`);
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                Logger.error(`❌ Command execution error: ${stderr}`);
                return res.status(500).json({ 
                    error: 'Command execution failed', 
                    details: stderr 
                });
            }
            
            Logger.info(`✅ Command executed successfully: ${command}`);
            res.json({ stdout, stderr });
        });
    });
    
    // נקודת קצה להתקנת תוכנה
    agentServer.post('/install', validateidKey, (req, res) => {
        const { softwareUrl, os } = req.body;
        
        if (!softwareUrl) {
            Logger.error('❌ No software URL provided');
            return res.status(400).json({ error: 'No software URL provided' });
        }
        
        Logger.info(`📌 Installing software from: ${softwareUrl}`);
        
        let installCommand;
        
        // התאמת פקודת ההתקנה למערכת ההפעלה
        if (os === 'windows' || process.platform === 'win32') {
            // פקודת התקנה ל-Windows
            installCommand = `powershell -Command "Invoke-WebRequest -Uri '${softwareUrl}' -OutFile 'installer.exe'; Start-Process -Wait installer.exe -ArgumentList '/quiet'; Remove-Item installer.exe"`;
        } else if (os === 'macos' || process.platform === 'darwin') {
            // פקודת התקנה ל-MacOS
            installCommand = `curl -sL ${softwareUrl} -o installer.pkg && sudo installer -pkg installer.pkg -target / && rm installer.pkg`;
        } else {
            // פקודת התקנה ל-Linux
            installCommand = `wget -q ${softwareUrl} -O installer.deb && sudo dpkg -i installer.deb && rm installer.deb`;
        }
        
        exec(installCommand, (error, stdout, stderr) => {
            if (error) {
                Logger.error(`❌ Software installation error: ${stderr}`);
                return res.status(500).json({ 
                    error: 'Software installation failed', 
                    details: stderr 
                });
            }
            
            Logger.info(`✅ Software installed successfully from: ${softwareUrl}`);
            res.json({ message: 'Software installed successfully', stdout, stderr });
        });
    });
    
    // הפעלת השרת
    agentServer.listen(3001, () => {
        Logger.info("🚀 Agent server is running on port 3001");
    });
    
    return agentServer;
};
module.exports = CredentialManager;