const express = require('express');
const https = require('https');
const fs = require('fs');
const selfsigned = require('selfsigned');

const app = express();
const port = 8443;

app.use(express.static('.'));

const certPath = './certs/server.crt';
const keyPath = './certs/server.key';

// Ensure certs directory exists
if (!fs.existsSync('./certs')) {
    fs.mkdirSync('./certs', { recursive: true });
}

// Generate self-signed certs if they don't exist
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Generating self-signed certificates...');
    try {
        const attrs = [{ name: 'commonName', value: 'localhost' }];
        const pems = selfsigned.generate(attrs, { 
            keySize: 2048, 
            days: 365,
            algorithm: 'sha256'
        });
        
        fs.writeFileSync(keyPath, pems.private);
        fs.writeFileSync(certPath, pems.cert);
        console.log('Certificates generated successfully!');
    } catch(error) {
        console.error('Error generating certificate:', error.message);
        process.exit(1);
    }
}

// HTTPS server options
const options = {
    key  : fs.readFileSync(keyPath),
    cert : fs.readFileSync(certPath)
};

// Server creation based off https://localhost:8443
https.createServer(options, app).listen(port, () => {
    console.log(`HTTPS Server running on https://localhost:${port}`);
    console.log('Note: You\'ll need to accept the self-signed certificate warning');
});