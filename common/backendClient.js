const fs = require('fs');
const axios = require('axios');
const path = require('path');
const os = require('os');
const macaddress = require('macaddress');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log("📂 Checking .env file path:", path.resolve(__dirname, '../.env'));
console.log("🔍 Loaded AGENT_API_KEY:", process.env.AGENT_API_KEY);
console.log("🔍 Loaded SECRET_KEY:", process.env.SECRET_KEY);

class BackendClient {
    constructor(platform) {
        this.platform = platform;
        this.baseURL = process.env.BACKEND_URL || 'http://localhost:4000';
        this.envFilePath = path.join(__dirname, '../.env');
        this.apiKey = process.env.AGENT_API_KEY || null; // ✅ אתחול API Key
        this.jwtToken = process.env.JWT_TOKEN || null;
    }

    async getMacAddress() {
        return new Promise((resolve, reject) => {
            macaddress.one((err, mac) => {
                if (err) {
                    console.error("❌ Error retrieving MAC address:", err);
                    return reject(new Error(`MAC Address Retrieval Failed: ${err.message || err}`));
                }
                resolve(mac);
            });
        });
    }

    getIpAddress() {
        const nets = os.networkInterfaces();
        let ip = '127.0.0.1';

        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`📌 Found IP Address on interface ${name}: ${net.address}`);
                    return net.address;
                }
            }
        }
        console.warn("⚠️ No external IP address found, using localhost.");
        return ip;
    }

    async registerDevice() {
        console.log("📤 Checking if device is already registered...");
    
        try {
            const macAddress = await this.getMacAddress();
            const ipAddress = this.getIpAddress();
    
            const payload = {
                deviceId: os.hostname(),
                name: os.hostname(),
                platform: this.platform,
                os: this.platform,
                osVersion: os.release(),
                cpu: os.cpus()[0].model,
                memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
                macAddress,
                ipAddress
            };
    
            console.log("📤 Sending device registration request with data:", payload);
            const response = await axios.post(`${this.baseURL}/devices/register`, payload);
    
            if (response.data.apiKey) {
                this.apiKey = response.data.apiKey;
                this.saveToEnvFile("AGENT_API_KEY", this.apiKey);
                console.log("✅ AGENT_API_KEY saved to .env");
    
                // שמירה גם בזיכרון המקומי
                fs.writeFileSync(path.join(__dirname, 'agentConfig.json'), JSON.stringify({ apiKey: this.apiKey }, null, 2));
            } else {
                console.error("❌ API Key not received from backend!");
            }
        } catch (error) {
            console.error("❌ Error registering device:", error.response ? error.response.data : error.message);
        }
    }

    saveToEnvFile(key, value) {
        let envData = fs.existsSync(this.envFilePath) ? fs.readFileSync(this.envFilePath, 'utf8') : '';

        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envData)) {
            envData = envData.replace(regex, `${key}=${value}`);
            console.log(`🔄 Updated ${key} in .env file.`);
        } else {
            envData += `\n${key}=${value}`;
            console.log(`🆕 Added ${key} to .env file.`);
        }

        fs.writeFileSync(this.envFilePath, envData);
        console.log("✅ .env file successfully updated.");
    }
}

module.exports = BackendClient;