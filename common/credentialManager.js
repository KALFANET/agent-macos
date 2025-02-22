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

module.exports = CredentialManager;