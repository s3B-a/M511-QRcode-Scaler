# M511-QRcode-Scaler
A Mod for the Brady M511 printer to increase the size of QR codes

---
## Features

- 🖨️ **Brady M511 Printer Integration** - Direct communication with Brady printers
- 📁 **File Upload Support** - Drag & drop or click to upload images
- 🖼️ **Image Preview** - Real-time preview of uploaded images
- 🔒 **HTTPS Server** - Secure connection with auto-generated certificates
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 📊 **Real-time Logging** - Monitor system status and print operations

## Project Structure

```
M511-Printer-Mod/
├── index.html                  # Main web interface
├── package.json                # Node.js dependencies and scripts
├── README.md                   # Project documentation
├── .gitignore                  # Git ignore rules
├── css/
│   └── styles.css              # Main stylesheet
├── js/
│   ├── https-server.js         # HTTPS server with self-signed certificates
│   ├── printer-controller.js   # Brady printer SDK integration
│   └── file-upload.js          # File upload and preview functionality
└── certs/                      # Auto-generated SSL certificates (git ignored)
    ├── server.crt
    └── server.key
```

## Install and Run Guide

1. Run `npm install` to install dependencies
2. To start the server run `npm start`
3. Open your browser and navigate to `https://localhost:8443`
4. Accept the self-signed certificate warning (this is normal for local development)

The application will automatically generate self-signed SSL certificates using Node.js (no OpenSSL installation required).

## Usage

1. **Connect to Printer**: Click "Discover Printer" to find your Brady M511 printer
2. **Upload Image**: Drag and drop an image file or click the upload area to browse
3. **Preview**: View the uploaded image in the preview area
4. **Print**: Click "Print Image" to send the job to your printer
5. **Control**: Use "Feed Label" and "Cut Label" for manual printer control

## Supported File Types

- Images: PNG, JPG, GIF, SVG
- Other formats: PDF, TXT (processed during print)

## Troubleshooting

If you encounter any certificate-related issues, the application now uses the `selfsigned` npm package instead of requiring OpenSSL to be installed on your system.

For printer connection issues, ensure:
- Your Brady M511 printer is connected and powered on
- The printer is on the same network as your computer
- Printer drivers are properly installed

---
