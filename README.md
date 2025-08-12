# M511-Printer-Mod
A Mod for the Brady M511 printer to increase the size of QR codes

---
## Features

- 🖨️ **Brady M511 Printer Integration** - Direct communication with Brady printers
- 🔌 **Multiple Connection Types** - Network, Bluetooth, and USB support
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

1. **Connect to Printer**: 
   - **Network**: Click "Discover Printer" to find your Brady M511 printer on the network
   - **Bluetooth**: Click "Connect Bluetooth" to pair with your printer wirelessly
   - **USB**: Click "Connect USB" to connect to a printer plugged into your computer
2. **Upload Image**: Drag and drop an image file or click the upload area to browse
3. **Preview**: View the uploaded image in the preview area
4. **Print**: Click "Print Image" to send the job to your printer
5. **Control**: Use "Feed Label" and "Cut Label" for manual printer control

## Connection Types

### Network Connection
- Uses Brady SDK's built-in network discovery
- Requires printer to be on the same network

### Bluetooth Connection  
- Uses Web Bluetooth API for wireless connection
- Requires browser support (Chrome/Edge recommended)

### USB Connection
- Uses Web Serial API for direct USB communication
- Requires browser support (Chrome/Edge only)
- Plug your Brady M511 directly into your computer's USB port

## Supported File Types

- Images: PNG, JPG, GIF, SVG
- Other formats: PDF, TXT (processed during print)

## Troubleshooting

If you encounter any certificate-related issues, the application now uses the `selfsigned` npm package instead of requiring OpenSSL to be installed on your system.

### Connection Issues

**Network Connection:**
- Ensure your Brady M511 printer is connected and powered on
- The printer should be on the same network as your computer
- Printer drivers are properly installed

**Bluetooth Connection:**
- Use Chrome or Edge browser for best compatibility
- Ensure Bluetooth is enabled on your computer
- Printer should be in pairing mode

**USB Connection:**
- Only supported in Chrome and Edge browsers
- Ensure printer is connected via USB cable
- May require printer drivers to be installed
- Check that no other applications are using the printer

### Browser Compatibility

- **Chrome/Edge**: Full support (Network, Bluetooth, USB)
- **Firefox**: Network only (no Bluetooth/USB support)
- **Safari**: Network only (limited support)

---