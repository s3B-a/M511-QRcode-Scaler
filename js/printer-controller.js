import BradySdk from 'brady-web-sdk';

/**
 * Brady Printer Controller class with enhanced debugging
 * Handles communication with the Brady printer SDK and the front end of the website
 */
class BradyPrinterController {
    constructor() {
        // Initialize SDK and connection variables
        this.sdk                        = null;
        this.isConnected                = false;
        this.currentFile                = null;
        this.bluetoothDevice            = null;
        this.bluetoothServer            = null;
        this.usbDevice                  = null;
        this.connectionType             = null; // 'network', 'bluetooth', 'usb'
        this.debugMode                  = true; // Enable detailed logging
        this.connectionMonitor          = null; // For monitoring connection status
        this.reconnectAttempts          = 0;
        this.maxReconnectAttempts       = 3;
        this.lastDisconnectionTime      = 0; // Track last disconnection to prevent rapid reconnects
        this.reconnectionCooldown       = 10000; // 10 seconds cooldown between reconnection attempts
        this.consecutiveHealthFailures  = 0; // Track consecutive health check failures
        
        // USB polling variables
        this.usbPollingInterval         = null; // For USB data polling
        this.usbPollingErrors           = 0; // Track USB polling errors
        
        // Initialize UI elements
        this.statusIndicator    = document.getElementById('statusIndicator');
        this.statusText         = document.getElementById('statusText');
        this.bluetoothBtn       = document.getElementById('bluetoothBtn');
        this.reconnectBtn       = document.getElementById('reconnectBtn');
        this.usbBtn             = document.getElementById('usbBtn');
        this.discoverBtn        = document.getElementById('discoverBtn');
        this.printBtn           = document.getElementById('printBtn');
        this.feedBtn            = document.getElementById('feedBtn');
        this.cutBtn             = document.getElementById('cutBtn');
        this.statusBtn          = document.getElementById('statusBtn');

        // Initialize SDK and event listeners
        this.initializeSDK();
        this.initializeEventListeners();
        this.checkBluetoothSupport();
        this.checkUSBSupport();
        this.addLog('Brady Printer Controller initialized');
        
        // Debug: Check if all UI elements were found
        this.debugUIElements();
    }

    // Debug method to check UI elements
    debugUIElements() {
        const elements = {
            statusIndicator:    this.statusIndicator,
            statusText:         this.statusText,
            bluetoothBtn:       this.bluetoothBtn,
            reconnectBtn:       this.reconnectBtn,
            usbBtn:             this.usbBtn,
            discoverBtn:        this.discoverBtn,
            printBtn:           this.printBtn,
            feedBtn:            this.feedBtn,
            cutBtn:             this.cutBtn,
            statusBtn:          this.statusBtn
        };
        
        for (const [name, element] of Object.entries(elements)) {
            if (!element) {
                this.addLog(`UI Element not found: ${name}`, 'warning');
            } else {
                this.addLog(`UI Element found: ${name}`, 'info');
            }
        }
    }

    // Method to initialize the Brady SDK for use
    initializeSDK() {
        try {
            this.addLog('🔧 Attempting to initialize Brady SDK...', 'info');
            
            // Check if BradySdk is available
            if (typeof BradySdk === 'undefined') {
                throw new Error('BradySdk is not defined - check if the library is properly loaded');
            }
            
            this.sdk = new BradySdk(this.printerUpdatesCallback.bind(this));
            
            // Check if SDK has required methods
            if (!this.sdk) {
                throw new Error('SDK initialization returned null/undefined');
            }
            
            this.addLog(`📋 SDK Methods available: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.sdk)).join(', ')}`, 'info');
            
            // Configure SDK for M511 printer if possible
            if (this.sdk.setPrinterModel) {
                try {
                    this.sdk.setPrinterModel('M511');
                    this.addLog('Brady SDK configured for M511 printer model', 'info');
                } catch (error) {
                    this.addLog(`Could not set printer model: ${error.message}`, 'warning');
                }
            }
            
            // Initialize analytics if available
            if (this.sdk.initializeAnalytics && typeof this.sdk.initializeAnalytics === 'function') {
                try {
                    this.sdk.initializeAnalytics();
                    this.addLog('Brady SDK analytics initialized', 'info');
                } catch (error) {
                    this.addLog(`Analytics initialization failed: ${error.message}`, 'warning');
                }
            }
            
            if (this.sdk.initializeEventListeners) {
                this.sdk.initializeEventListeners();
            } else {
                this.addLog('SDK does not have initializeEventListeners method', 'warning');
            }
            
            this.addLog('Brady SDK initialized successfully', 'success');
        } catch (error) {
            this.addLog(`Error initializing Brady SDK: ${error.message}`, 'error');
            this.addLog(`Stack trace: ${error.stack}`, 'error');
        }
    }

    // Callback for printer updates
    printerUpdatesCallback(update) {
        console.log("Printer update received:", update);
        this.addLog(`Printer update: ${JSON.stringify(update)}`);
        
        // Update UI based on printer status
        if (update.status) {
            this.updateConnectionStatus(update.status === 'connected');
        }
    }

    // Method to update the connection status
    updateConnectionStatus(connected, connectionType = null) {
        this.isConnected = connected;
        
        if (connected) {
            this.connectionType = connectionType;
            this.statusIndicator.className = 'status-indicator status-connected';
            
            // Update status text based on connection type
            switch(connectionType) {
                case 'usb':
                    this.statusText.textContent = 'Connected (USB)';
                    break;
                case 'bluetooth':
                    this.statusText.textContent = 'Connected (Bluetooth)';
                    break;
                case 'network':
                default:
                    this.statusText.textContent = 'Connected (Network)';
                    break;
            }
            
            // Update button states
            if (this.bluetoothBtn) {
                this.bluetoothBtn.textContent = connectionType === 'bluetooth' ? '🔗 Disconnect Bluetooth' : '📶 Connect Bluetooth';
                this.bluetoothBtn.disabled = connectionType !== 'bluetooth' && connected;
            }
            if (this.reconnectBtn) {
                this.reconnectBtn.style.display = 'none';
            }
            if (this.usbBtn) {
                this.usbBtn.textContent = connectionType === 'usb' ? '🔗 Disconnect USB' : '🔌 Connect USB';
                this.usbBtn.disabled = connectionType !== 'usb' && connected;
            }
        } else {
            this.connectionType = null;
            this.statusIndicator.className = 'status-indicator status-disconnected';
            this.statusText.textContent = 'Disconnected';
            
            // Reset button states
            if (this.bluetoothBtn) {
                this.bluetoothBtn.textContent = '📶 Connect Bluetooth';
                this.bluetoothBtn.disabled = false;
            }
            if (this.reconnectBtn) {
                // Show reconnect button if we had a Bluetooth device
                if (this.bluetoothDevice) {
                    this.reconnectBtn.style.display = 'inline-flex';
                    this.reconnectBtn.disabled = false;
                }
            }
            if (this.usbBtn) {
                this.usbBtn.textContent = '🔌 Connect USB';
                this.usbBtn.disabled = false;
            }
        }
        
        // Enable/disable control buttons based on connection status
        const hasFile = window.fileUploadAPI?.getCurrentFile() != null;
        this.printBtn.disabled      = !connected || !hasFile;
        this.feedBtn.disabled       = !connected;
        this.cutBtn.disabled        = !connected;
        this.statusBtn.disabled     = !connected;
    }

    // Method for printer discovery
    async discoverPrinter() {
        this.addLog('Searching for Brady printers...');
        this.discoverBtn.disabled = true;
        this.statusIndicator.className = 'status-indicator status-printing';
        this.statusText.textContent = 'Discovering...';
        
        try {
            // Check available SDK methods
            if (this.sdk && typeof this.sdk.connect === 'function') {
                this.addLog('Attempting network connection via Brady SDK', 'info');
                await this.sdk.connect({ type: 'network' });
                this.addLog('Network printer connected successfully', 'success');
                this.updateConnectionStatus(true, 'network');
            } else if (this.sdk && typeof this.sdk.discoverPrinters === 'function') {
                await this.sdk.discoverPrinters();
                this.addLog('Printer discovery completed', 'success');
                this.updateConnectionStatus(true, 'network');
            } else {
                throw new Error('Brady SDK does not support network discovery');
            }
        } catch (error) {
            this.addLog(`Discovery failed: ${error.message}`, 'error');
            this.updateConnectionStatus(false);
        } finally {
            this.discoverBtn.disabled = false;
        }
    }

    // Method to print the uploaded image
    async printImage() {
        // Get the current file from the file upload handler
        const uploadedFile = window.fileUploadAPI?.getCurrentFile();
        
        if (!uploadedFile) {
            this.addLog('No file selected for printing', 'error');
            return;
        }

        if (!this.isConnected) {
            this.addLog('Printer not connected. Please connect to printer first.', 'error');
            return;
        }

        this.addLog(`Starting print job for: ${uploadedFile.name}`, 'info');
        this.printBtn.disabled = true;
        this.statusIndicator.className = 'status-indicator status-printing';
        this.statusText.textContent = 'Printing...';

        try {
            // Create image element from file
            const imageElement = await this.createImageElement(uploadedFile);
            
            // Try Brady SDK method first if available and connected
            if (this.sdk && typeof this.sdk.printBitmap === 'function') {
                try {
                    this.addLog('Using Brady SDK printBitmap method', 'info');
                    await this.sdk.printBitmap(imageElement);
                    this.addLog('Print job completed successfully via Brady SDK', 'success');
                    return;
                } catch (sdkError) {
                    this.addLog(`Brady SDK print failed: ${sdkError.message}`, 'warning');
                    // Fall through to direct USB if available
                }
            }

            // Fallback to direct USB communication if available
            if (this.connectionType === 'usb' && this.usbDevice) {
                this.addLog('Using direct USB print communication', 'info');
                await this.printImageViaUSB(imageElement);
                this.addLog('Print job completed successfully via direct USB', 'success');
            } else {
                throw new Error('No available connection method for printing');
            }

        } catch (error) {
            this.addLog(`Print failed: ${error.message}`, 'error');
        } finally {
            this.printBtn.disabled = false;
            this.statusIndicator.className = 'status-indicator status-connected';
            this.statusText.textContent = 'Connected';
        }
    }

    // Create image element from file
    async createImageElement(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('Selected file is not an image'));
                return;
            }

            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    resolve(img);
                };
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    // Print image via direct USB communication
    async printImageViaUSB(imageElement) {
        this.addLog('Printing image via direct USB communication', 'info');
        
        // Convert image to bitmap data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match image
        canvas.width = imageElement.width;
        canvas.height = imageElement.height;
        
        // Draw image to canvas
        ctx.drawImage(imageElement, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Convert to Brady printer format
        const bitmapCommand = this.convertToBradyBitmap(imageData);
        
        // Send print command via USB
        await this.sendUSBCommand(bitmapCommand);
        
        this.addLog('Image data sent to printer via USB', 'success');
    }

    // Convert image data to Brady printer bitmap format
    convertToBradyBitmap(imageData) {
        this.addLog('Converting image to Brady M511 format...', 'info');
        
        // Convert to monochrome first
        const monoData = this.convertToMonochrome(imageData);
        
        // Brady M511 command structure
        let command = '';
        
        // Initialize printer
        command += '\x1B\x40'; // ESC @ (initialize)
        
        // Set graphics mode
        command += '\x1B\x69\x47'; // ESC i G (graphics mode)
        
        // Image dimensions
        const width = imageData.width;
        const height = imageData.height;
        
        // Calculate bytes per line (width rounded up to nearest byte)
        const bytesPerLine = Math.ceil(width / 8);
        
        this.addLog(`Image: ${width}x${height}, ${bytesPerLine} bytes per line`, 'info');
        
        // Send image header
        command += String.fromCharCode(bytesPerLine & 0xFF);        // Width in bytes (low)
        command += String.fromCharCode((bytesPerLine >> 8) & 0xFF); // Width in bytes (high)
        command += String.fromCharCode(height & 0xFF);              // Height (low)
        command += String.fromCharCode((height >> 8) & 0xFF);       // Height (high)

        // Convert monochrome data to bitmap bytes
        for (let y = 0; y < height; y++) {
            let lineData = '';
            for (let byteX = 0; byteX < bytesPerLine; byteX++) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = byteX * 8 + bit;
                    if (x < width) {
                        const index = (y * width + x) * 4; // RGBA format
                        // If pixel is black (or dark), set bit
                        if (monoData.data[index] < 128) { // R channel, assuming grayscale
                            byte |= (1 << (7 - bit));
                        }
                    }
                }
                lineData += String.fromCharCode(byte);
            }
            command += lineData;
        }
        
        // End graphics and print
        command += '\x1B\x69\x45'; // ESC i E (end graphics)
        command += '\x1B\x69\x50'; // ESC i P (print)
        
        this.addLog(`Generated Brady command: ${command.length} bytes`, 'success');
        return command;
    }

    // Convert image to monochrome for Brady printer
    convertToMonochrome(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const result = [];
        
        // Simple threshold-based conversion to monochrome
        for (let y = 0; y < height; y++) {
            let byte = 0;
            let bitPosition = 0;
            
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                // Convert to grayscale and apply threshold
                const gray = (r + g + b) / 3;
                const isBlack = gray < 128; // Threshold at 50%
                
                if (isBlack) {
                    byte |= (1 << (7 - bitPosition));
                }
                
                bitPosition++;
                if (bitPosition === 8) {
                    result.push(String.fromCharCode(byte));
                    byte = 0;
                    bitPosition = 0;
                }
            }
            
            // Handle remaining bits in the row
            if (bitPosition > 0) {
                result.push(String.fromCharCode(byte));
            }
        }
        
        return result.join('');
    }

    // Feed the label to the printer
    async feedLabel() {
        if (!this.isConnected) {
            this.addLog('Printer not connected', 'error');
            return;
        }

        this.addLog('Feeding label...');
        this.feedBtn.disabled = true;

        try {
            // Try Brady SDK method first if available and connected
            if (this.sdk && typeof this.sdk.feed === 'function') {
                try {
                    this.addLog('Using Brady SDK feed method', 'info');
                    await this.sdk.feed();
                    this.addLog('Label fed successfully via Brady SDK', 'success');
                    return;
                } catch (sdkError) {
                    this.addLog(`Brady SDK feed failed: ${sdkError.message}`, 'warning');
                    // Fall through to direct USB if available
                }
            }

            // Fallback to direct USB communication if available
            if (this.connectionType === 'usb' && this.usbDevice) {
                this.addLog('Using direct USB feed command', 'info');
                await this.sendUSBCommand('\x1B\x4A\x0A'); // ESC J 10 (feed 10 lines)
                this.addLog('Label fed successfully via direct USB', 'success');
            } else {
                throw new Error('No available connection method for feeding label');
            }

        } catch (error) {
            this.addLog(`Failed to feed label: ${error.message}`, 'error');
        } finally {
            this.feedBtn.disabled = false;
        }
    }

    // Cut the label
    async cutLabel() {
        if (!this.isConnected) {
            this.addLog('Printer not connected', 'error');
            return;
        }

        this.addLog('Cutting label...');
        this.cutBtn.disabled = true;

        try {
            // Try Brady SDK method first if available and connected
            if (this.sdk && typeof this.sdk.cut === 'function') {
                try {
                    this.addLog('Using Brady SDK cut method', 'info');
                    await this.sdk.cut();
                    this.addLog('Label cut successfully via Brady SDK', 'success');
                    return;
                } catch (sdkError) {
                    this.addLog(`Brady SDK cut failed: ${sdkError.message}`, 'warning');
                    // Fall through to direct USB if available
                }
            }

            // Fallback to direct USB communication if available
            if (this.connectionType === 'usb' && this.usbDevice) {
                this.addLog('Using direct USB cut command', 'info');
                await this.sendUSBCommand('\x1B\x69'); // ESC i (cut command)
                this.addLog('Label cut successfully via direct USB', 'success');
            } else {
                throw new Error('No available connection method for cutting label');
            }

        } catch (error) {
            this.addLog(`Failed to cut label: ${error.message}`, 'error');
        } finally {
            this.cutBtn.disabled = false;
        }
    }

    // Check connection health and stability
    async checkConnectionHealth() {
        // Simple connection health check - just verify basic connectivity
        if (!this.isConnected) return false;

        try {
            switch (this.connectionType) {
                case 'bluetooth':
                    // For Bluetooth with Brady SDK, use SDK connection status if available
                    if (this.sdk && typeof this.sdk.isConnected === 'function') {
                        try {
                            const connected = await this.sdk.isConnected();
                            return connected === true;
                        } catch (sdkError) {
                            // If SDK check fails, assume connected to avoid false disconnections
                            return true;
                        }
                    }
                    // Fallback: assume connected if we think we're connected
                    return this.isConnected;
                    
                case 'usb':
                    // For USB, check if device is still open
                    return this.usbDevice && this.usbDevice.opened;
                    
                case 'network':
                    // For network, use SDK connection status if available
                    if (this.sdk && typeof this.sdk.isConnected === 'function') {
                        try {
                            const connected = await this.sdk.isConnected();
                            return connected === true;
                        } catch (sdkError) {
                            return true; // Assume connected to avoid false disconnections
                        }
                    }
                    return true;
                    
                default:
                    return false;
            }
        } catch (error) {
            // Don't log connection health failures as they can be noisy
            return true; // Assume connected to avoid false disconnections
        }
    }

    // Check printer status
    async checkPrinterStatus() {
        if (!this.isConnected) {
            this.addLog('Printer not connected', 'error');
            return;
        }

        this.addLog('Checking printer status...');
        this.statusBtn.disabled = true;

        try {
            if (this.connectionType === 'usb') {
                // Send status inquiry command via USB
                await this.sendUSBCommand('\x1B\x69\x53'); // ESC i S (status inquiry)
                
                // Wait for potential response
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Note: This printer model may not provide readable status responses via USB
                this.addLog('Status inquiry transmitted via USB (printer response verification not available)', 'warning');
                this.addLog('Check printer display/lights for actual status information', 'info');
                
                // Check if Brady SDK has status methods
                if (this.sdk && typeof this.sdk.isConnected === 'function') {
                    try {
                        const connected = await this.sdk.isConnected();
                        if (connected) {
                            this.addLog(`Brady SDK connection status: connected (hybrid USB mode)`, 'success');
                            this.addLog('Both Brady SDK and direct USB communication available', 'info');
                        } else {
                            this.addLog(`Brady SDK connection status: disconnected (direct USB mode only)`, 'info');
                            this.addLog('Only direct USB communication available - Brady SDK operations may not work', 'warning');
                        }
                    } catch (sdkError) {
                        this.addLog(`Brady SDK status check failed: ${sdkError.message}`, 'warning');
                        this.addLog('Direct USB communication active, Brady SDK status unknown', 'info');
                    }
                } else {
                    this.addLog('Brady SDK status method not available', 'info');
                    this.addLog('Direct USB communication only', 'info');
                }
                
            } else if (this.connectionType === 'bluetooth' || this.connectionType === 'network') {
                // For Bluetooth and Network, use Brady SDK status methods
                if (this.sdk && typeof this.sdk.isConnected === 'function') {
                    try {
                        const connected = await this.sdk.isConnected();
                        this.addLog(`Brady SDK connection status: ${connected ? 'connected' : 'disconnected'}`, connected ? 'success' : 'warning');
                        
                        if (!connected) {
                            this.addLog('Connection appears to be lost. Try reconnecting.', 'warning');
                            this.updateConnectionStatus(false);
                        }
                    } catch (error) {
                        this.addLog(`Status check failed: ${error.message}`, 'error');
                    }
                } else {
                    this.addLog('Brady SDK status method not available', 'warning');
                }
            }
        } catch (error) {
            this.addLog(`Status check error: ${error.message}`, 'error');
        } finally {
            this.statusBtn.disabled = false;
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Button event listeners
        this.discoverBtn.addEventListener('click', () => this.discoverPrinter());
        this.printBtn.addEventListener('click', () => this.printImage());
        this.feedBtn.addEventListener('click', () => this.feedLabel());
        this.cutBtn.addEventListener('click', () => this.cutLabel());
        this.statusBtn.addEventListener('click', () => this.checkPrinterStatus());

        // Bluetooth listener
        if (this.bluetoothBtn) {
            this.bluetoothBtn.addEventListener('click', () => {
                if (this.connectionType === 'bluetooth') {
                    this.disconnectBluetooth();
                } else {
                    this.connectBluetooth();
                }
            });
        }

        // Reconnect listener
        if (this.reconnectBtn) {
            this.reconnectBtn.addEventListener('click', () => {
                this.reconnectAttempts = 0;     // Reset attempts for manual reconnection
                this.lastDisconnectionTime = 0; // Reset cooldown for manual reconnection
                this.addLog('Manual reconnection initiated', 'info');
                this.attemptBluetoothReconnection();
            });
        }

        // USB listener
        if (this.usbBtn) {
            this.usbBtn.addEventListener('click', () => {
                if (this.connectionType === 'usb') {
                    this.disconnectUSB();
                } else {
                    this.connectUSB();
                }
            });
        }

        if (navigator.bluetooth) {
            navigator.bluetooth.addEventListener('advertisementreceived', (event) => {
                this.addLog(`Bluetooth advertisement received: ${event.device.name}`);
            });
        }

        // Listen for file selection changes
        const checkForFile = () => {
            if (window.fileUploadAPI) {
                const newFile = window.fileUploadAPI.getCurrentFile();
                if (newFile !== this.currentFile) {
                    this.currentFile = newFile;
                    this.printBtn.disabled = !this.isConnected || !this.currentFile;
                    if (newFile) {
                        this.addLog(`File ready for printing: ${newFile.name}`);
                    }
                }
            }
        };

        // Check for file changes periodically
        setInterval(checkForFile, 2000);

        // SDK event listeners
        if (this.sdk) {
            // Use try-catch for event listener setup in case SDK doesn't support these events
            try {
                this.sdk.on('printerStatusChanged', this.printerUpdatesCallback.bind(this));
            } catch (error) {
                this.addLog('SDK does not support printerStatusChanged event', 'warning');
            }
            
            try {
                this.sdk.on('bluetoothDisconnected', () => {
                    this.addLog('Brady SDK detected Bluetooth disconnection', 'warning');
                    this.handleBluetoothDisconnection();
                });
            } catch (error) {
                this.addLog('SDK does not support bluetoothDisconnected event', 'warning');
            }
        }
    }

    // Method to add information to the log
    addLog(message, type = 'info') {
        if (window.fileUploadAPI && window.fileUploadAPI.addLog) {
            window.fileUploadAPI.addLog(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Method to check if Web Bluetooth is supported
    checkBluetoothSupport() {
        if (!navigator.bluetooth) {
            this.addLog('Web Bluetooth API is not supported in this browser.');
            if (this.bluetoothBtn) {
                this.bluetoothBtn.disabled = true;
                this.bluetoothBtn.textContent = '🚫 Bluetooth Not Supported';
            }
            return false;
        }
        return true;
    }

    // Method to check if WebUSB API is supported
    checkUSBSupport() {
        if (!('usb' in navigator)) {
            this.addLog('WebUSB API is not supported in this browser. Please use Chrome/Edge.');
            if (this.usbBtn) {
                this.usbBtn.disabled = true;
                this.usbBtn.textContent = '🚫 USB Not Supported';
            }
            return false;
        }
        this.addLog('WebUSB API support detected', 'success');
        return true;
    }

    // Method to connect via USB using WebUSB API
    async connectUSB() {
        if (!('usb' in navigator)) {
            this.addLog('WebUSB not supported', 'error');
            return;
        }

        this.addLog('Connecting to USB printer...');
        this.usbBtn.disabled = true;
        this.statusIndicator.className = 'status-indicator status-printing';
        this.statusText.textContent = 'Connecting...';

        try {
            // Initialize Brady SDK first
            if (!this.sdk) {
                this.initializeSDK();
            }

            // Use Brady SDK's showDiscoveredUsbDevices method to connect
            if (this.sdk && typeof this.sdk.showDiscoveredUsbDevices === 'function') {
                this.addLog('Using Brady SDK USB device discovery...', 'info');
                try {
                    // This should open a device selection dialog and handle the connection
                    await this.sdk.showDiscoveredUsbDevices();
                    
                    // Verify the connection was established
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    if (this.sdk && typeof this.sdk.isConnected === 'function') {
                        const connected = await this.sdk.isConnected();
                        if (connected) {
                            this.addLog('Brady SDK USB connection established and verified', 'success');
                            this.updateConnectionStatus(true, 'usb');
                            this.addLog('USB printer ready for operations via Brady SDK', 'success');
                            return;
                        } else {
                            this.addLog('Brady SDK USB connection not verified, falling back to direct USB', 'warning');
                        }
                    } else {
                        this.addLog('Brady SDK USB connection completed (verification not available)', 'warning');
                        this.updateConnectionStatus(true, 'usb');
                        this.addLog('USB printer ready for operations via Brady SDK', 'success');
                        return;
                    }
                } catch (sdkError) {
                    this.addLog(`Brady SDK USB connection failed: ${sdkError.message}`, 'warning');
                    this.addLog('Falling back to direct USB connection...', 'info');
                }
            }

            // Fallback to direct USB connection if SDK method fails
            this.addLog('Select your Brady M511 printer from the available USB devices', 'info');
            
            // Request USB device - Brady M511 printer
            const device = await navigator.usb.requestDevice({
                filters: [
                    { vendorId: 0x0E2E },  // Brady Corporation vendor ID
                    { vendorId: 0x04b8 },  // Epson (some Brady printers use Epson chips)
                    { vendorId: 0x0922 },  // Dymo (alternative)
                    {}                     // Allow any device if specific vendor ID is unknown
                ]
            });

            this.addLog(`USB device selected: ${device.productName || 'Unknown Device'}`);
            this.addLog(`Vendor ID: 0x${device.vendorId.toString(16).toUpperCase()}, 
                        Product ID: 0x${device.productId.toString(16).toUpperCase()}`);

            // Open the USB device
            await device.open();
            
            // Select the first configuration if not already configured
            if (device.configuration === null) {
                await device.selectConfiguration(1);
            }

            // Find and claim the first available interface
            let interfaceNumber = 0;
            let interfaceClaimed = false;
            
            this.addLog(`Device has ${device.configuration.interfaces.length} interface(s)`, 'info');
            
            // Try to find an unclaimed interface
            for (const interface_ of device.configuration.interfaces) {
                this.addLog(`Checking interface ${interface_.interfaceNumber}: claimed=${interface_.claimed}, 
                            endpoints=${interface_.alternates[0].endpoints.length}`, 'info');
                
                try {
                    if (!interface_.claimed) {
                        await device.claimInterface(interface_.interfaceNumber);
                        interfaceNumber = interface_.interfaceNumber;
                        interfaceClaimed = true;
                        
                        // Log endpoint information for this interface
                        const endpoints = interface_.alternates[0].endpoints;
                        this.addLog(`Interface ${interfaceNumber} endpoints:`, 'info');
                        for (const ep of endpoints) {
                            this.addLog(`  - Endpoint ${ep.endpointNumber}: ${ep.direction}, ${ep.type}`, 'info');
                        }
                        
                        this.addLog(`Successfully claimed USB interface ${interfaceNumber}`, 'success');
                        break;
                    }
                } catch (claimError) {
                    this.addLog(`Could not claim interface ${interface_.interfaceNumber}: ${claimError.message}`, 'warning');
                    continue;
                }
            }
            
            if (!interfaceClaimed) {
                throw new Error('No available USB interface could be claimed. The device may be in use by another application or driver.');
            }

            this.usbDevice = device;
            this.addLog('USB device opened and interface claimed', 'success');

            // Test the connection
            await this.testUSBConnection();

            // Try to connect Brady SDK to this USB device
            await this.tryConnectBradySDKToUSB(device);

            this.updateConnectionStatus(true, 'usb');
            this.addLog('Direct USB connection established successfully', 'success');
            this.addLog('Note: Direct USB communication is one-way - commands are sent but printer responses cannot be verified', 'info');

        } catch (error) {
            if (error.name === 'NotFoundError') {
                this.addLog('No device selected. USB connection cancelled.', 'warning');
            } else if (error.message.includes('Unable to claim interface')) {
                this.addLog('USB interface already in use by system driver or another application.', 'error');
                this.addLog('Try these solutions:', 'info');
                this.addLog('1. Disconnect and reconnect the USB cable', 'info');
                this.addLog('2. Close any other applications that might be using the printer', 'info');
                this.addLog('3. Try using Bluetooth connection instead', 'info');
                this.addLog('4. Restart your browser and try again', 'info');
            } else {
                this.addLog(`USB connection failed: ${error.message}`, 'error');
            }
            this.updateConnectionStatus(false);
        } finally {
            this.usbBtn.disabled = false;
        }
    }

    // Try to connect Brady SDK to a USB device that was connected directly
    async tryConnectBradySDKToUSB(device) {
        if (!this.sdk || !device) {
            return;
        }

        this.addLog('Attempting to connect Brady SDK to USB device...', 'info');
        
        try {
            // Try different Brady SDK USB connection methods
            const connectionMethods = [
                async () => {
                    if (typeof this.sdk.connectUSB === 'function') {
                        await this.sdk.connectUSB(device);
                        return 'connectUSB';
                    }
                    throw new Error('connectUSB method not available');
                },
                async () => {
                    if (typeof this.sdk.connect === 'function') {
                        await this.sdk.connect({
                            type: 'usb',
                            device: device,
                            vendorId: device.vendorId,
                            productId: device.productId
                        });
                        return 'connect with USB parameters';
                    }
                    throw new Error('connect method not available');
                },
                async () => {
                    if (this.sdk.setDevice) {
                        await this.sdk.setDevice(device);
                        return 'setDevice';
                    } else if (this.sdk.device !== undefined) {
                        this.sdk.device = device;
                        return 'device property assignment';
                    }
                    throw new Error('no device setting method available');
                }
            ];

            for (const method of connectionMethods) {
                try {
                    const methodName = await method();
                    
                    // Verify connection if possible
                    if (typeof this.sdk.isConnected === 'function') {
                        const connected = await this.sdk.isConnected();
                        if (connected) {
                            this.addLog(`Brady SDK connected to USB device via ${methodName}`, 'success');
                            return;
                        }
                    } else {
                        this.addLog(`Brady SDK connection attempted via ${methodName} (verification not available)`, 'info');
                        return;
                    }
                } catch (methodError) {
                    // Try next method
                    continue;
                }
            }
            
            this.addLog('Brady SDK could not connect to USB device - using direct USB communication only', 'warning');
            
        } catch (error) {
            this.addLog(`Brady SDK USB connection attempt failed: ${error.message}`, 'warning');
        }
    }

    // Test USB connection with a simple command using WebUSB API
    async testUSBConnection() {
        try {
            this.addLog('Testing USB communication...', 'info');
            
            // Send a simple status inquiry command
            await this.sendUSBCommand('\x1B\x40'); // ESC @ (initialize printer)
            
            // Wait a bit for any response
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.addLog('USB communication test completed', 'success');
        } catch (error) {
            this.addLog(`USB communication test failed: ${error.message}`, 'warning');
            // Don't throw error here as this is just a test
        }
    }

    // Initialize Brady SDK with USB connection using WebUSB
    // Setup direct USB communication if Brady SDK doesn't support WebUSB
    setupDirectUSBCommunication(device) {
        this.addLog('Setting up direct USB communication', 'info');
        
        // Store device reference for direct communication
        this.usbDevice = device;
        
        // Start listening for incoming data if needed
        this.setupUSBDataListener();
        
        this.addLog('Direct USB communication established', 'success');
    }

    // Setup USB data listener for incoming responses
    setupUSBDataListener() {
        // For WebUSB, we need to implement polling since there's no continuous reading
        this.addLog('USB data listener setup (polling mode)', 'info');
        
        if (!this.usbDevice) {
            this.addLog('No USB device available for data listener', 'warning');
            return;
        }

        // Find the input endpoint for reading data
        let inEndpoint = null;
        let interfaceNumber = null;

        try {
            // Look through all claimed interfaces to find one with IN endpoint
            for (const interface_ of this.usbDevice.configuration.interfaces) {
                if (interface_.claimed) {
                    const alternate = interface_.alternates[0];
                    for (const endpoint of alternate.endpoints) {
                        if (endpoint.direction === 'in') {
                            inEndpoint = endpoint;
                            interfaceNumber = interface_.interfaceNumber;
                            this.addLog(`Found input endpoint ${endpoint.endpointNumber} on interface ${interfaceNumber}`, 'info');
                            break;
                        }
                    }
                    if (inEndpoint) break;
                }
            }

            if (!inEndpoint) {
                this.addLog('No input endpoint found - printer may not send status responses', 'info');
                return;
            }

            // Set up polling for incoming data
            this.usbPollingInterval = setInterval(async () => {
                try {
                    await this.pollUSBData(inEndpoint.endpointNumber);
                } catch (error) {
                    // Ignore timeout errors as they're expected when no data is available
                    if (!error.message.includes('TIMEOUT') && 
                        !error.message.includes('DEVICE_NO_RESPONSE') &&
                        !error.message.includes('Transfer timed out')) {
                        this.addLog(`USB polling error: ${error.message}`, 'warning');
                        
                        // Stop polling if we get persistent errors
                        if (this.usbPollingErrors > 5) {
                            this.addLog('Too many USB polling errors, stopping data listener', 'warning');
                            this.stopUSBDataListener();
                        } else {
                            this.usbPollingErrors = (this.usbPollingErrors || 0) + 1;
                        }
                    }
                }
            }, 2000); // Poll every 2 seconds

            this.addLog('USB data listener started with polling', 'success');
            this.usbPollingErrors = 0;

        } catch (error) {
            this.addLog(`Failed to setup USB data listener: ${error.message}`, 'error');
        }
    }

    // Poll for USB data on a specific endpoint
    async pollUSBData(endpointNumber) {
        if (!this.usbDevice) {
            return;
        }

        try {
            // Attempt to read data with a short timeout
            const result = await this.usbDevice.transferIn(endpointNumber, 64);
            
            if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
                // Convert ArrayBuffer to string
                const data = new TextDecoder().decode(result.data);
                
                // Only process non-empty data
                if (data.trim()) {
                    this.addLog(`USB received: ${data.trim()}`, 'info');
                    this.processUSBResponse(data);
                    
                    // Reset error count on successful read
                    this.usbPollingErrors = 0;
                }
            }
        } catch (error) {
            // Re-throw for error handling in the calling function
            throw error;
        }
    }

    // Stop USB data listener
    stopUSBDataListener() {
        if (this.usbPollingInterval) {
            clearInterval(this.usbPollingInterval);
            this.usbPollingInterval = null;
            this.addLog('USB data listener stopped', 'info');
        }
    }

    // Read data from USB device using WebUSB API
    async readUSBData() {
        if (!this.usbDevice) {
            this.addLog('No USB device available for reading', 'error');
            return;
        }

        try {
            // Find the correct interface with IN endpoint
            let inEndpoint = null;
            
            // Look through all claimed interfaces to find one with IN endpoint
            for (const interface_ of this.usbDevice.configuration.interfaces) {
                if (interface_.claimed) {
                    const alternate = interface_.alternates[0];
                    for (const endpoint of alternate.endpoints) {
                        if (endpoint.direction === 'in') {
                            inEndpoint = endpoint;
                            break;
                        }
                    }
                    if (inEndpoint) break;
                }
            }

            if (!inEndpoint) {
                this.addLog('No input endpoint found on any claimed interface', 'warning');
                return;
            }

            // Read data from the device
            const result = await this.usbDevice.transferIn(inEndpoint.endpointNumber, 64); // Read up to 64 bytes
            
            if (result.status === 'ok' && result.data) {
                // Convert ArrayBuffer to string
                const data = new TextDecoder().decode(result.data);
                if (data.trim()) {
                    this.addLog(`USB received: ${data}`, 'info');
                    this.processUSBResponse(data);
                }
            }
        } catch (error) {
            // This is normal for printers that don't send responses
            // Only log if it's not a timeout or device busy error
            if (!error.message.includes('TIMEOUT') && !error.message.includes('DEVICE_NO_RESPONSE')) {
                this.addLog(`USB read error: ${error.message}`, 'warning');
            }
        }
    }

    // Process responses from USB printer
    processUSBResponse(data) {
        try {
            // Log raw response for debugging
            const hexData = Array.from(new TextEncoder().encode(data))
                .map(byte => `\\x${byte.toString(16).toUpperCase().padStart(2, '0')}`)
                .join('');
            this.addLog(`USB response (hex): ${hexData}`, 'info');

            // Parse different types of printer responses
            if (data.includes('STATUS') || data.includes('READY')) {
                this.addLog('Printer status: Ready', 'success');
                this.updateConnectionStatus(true, 'usb');
            } 
            else if (data.includes('ERROR') || data.includes('FAULT')) {
                this.addLog('Printer error detected in response', 'error');
            }
            else if (data.includes('BUSY') || data.includes('PRINTING')) {
                this.addLog('Printer status: Busy/Printing', 'info');
            }
            else if (data.includes('PAPER') || data.includes('LABEL')) {
                if (data.includes('OUT') || data.includes('EMPTY')) {
                    this.addLog('Printer status: Out of paper/labels', 'warning');
                } else {
                    this.addLog('Printer status: Paper/labels OK', 'success');
                }
            }
            else if (data.includes('RIBBON') || data.includes('INK')) {
                if (data.includes('OUT') || data.includes('LOW')) {
                    this.addLog('Printer status: Ribbon/ink low or out', 'warning');
                } else {
                    this.addLog('Printer status: Ribbon/ink OK', 'success');
                }
            }
            else if (data.includes('COVER') || data.includes('DOOR')) {
                if (data.includes('OPEN')) {
                    this.addLog('Printer status: Cover/door open', 'warning');
                } else {
                    this.addLog('Printer status: Cover/door closed', 'success');
                }
            }
            else {
                // Check for Brady M511 specific response codes
                const bytes = new TextEncoder().encode(data);
                if (bytes.length > 0) {
                    // Check for common Brady status bytes
                    const firstByte = bytes[0];
                    switch (firstByte) {
                        case 0x00:
                            this.addLog('Printer status: Normal operation', 'success');
                            break;
                        case 0x01:
                            this.addLog('Printer status: Paper out', 'warning');
                            break;
                        case 0x02:
                            this.addLog('Printer status: Ribbon out', 'warning');
                            break;
                        case 0x04:
                            this.addLog('Printer status: Cover open', 'warning');
                            break;
                        case 0x08:
                            this.addLog('Printer status: Cutter error', 'error');
                            break;
                        default:
                            this.addLog(`Printer response: Unknown status code 0x${firstByte.toString(16).toUpperCase()}`, 'info');
                    }
                } else {
                    this.addLog('Printer sent empty response', 'info');
                }
            }
        } catch (error) {
            this.addLog(`Error processing USB response: ${error.message}`, 'error');
        }
    }

    // Send data to USB printer using WebUSB API
    async sendUSBCommand(command) {
        if (!this.usbDevice) {
            throw new Error('USB device not available');
        }

        try {
            // Convert command string to Uint8Array
            const data = new TextEncoder().encode(command);
            
            // Find the correct interface with endpoints
            let outEndpoint = null;
            let targetInterface = null;
            
            // Look through all claimed interfaces to find one with OUT endpoint
            for (const interface_ of this.usbDevice.configuration.interfaces) {
                if (interface_.claimed) {
                    const alternate = interface_.alternates[0];
                    for (const endpoint of alternate.endpoints) {
                        if (endpoint.direction === 'out') {
                            outEndpoint = endpoint;
                            targetInterface = interface_;
                            break;
                        }
                    }
                    if (outEndpoint) break;
                }
            }

            if (!outEndpoint) {
                throw new Error('No output endpoint found on any claimed interface');
            }

            // Send the command
            const result = await this.usbDevice.transferOut(outEndpoint.endpointNumber, data);
            
            if (result.status !== 'ok') {
                throw new Error(`USB transfer failed: ${result.status}`);
            }
            
            // Log command in a more readable format
            const commandPreview = command.replace(/[\x00-\x1F\x7F]/g, (char) => {
                const code = char.charCodeAt(0);
                return `\\x${code.toString(16).toUpperCase().padStart(2, '0')}`;
            });
            
            this.addLog(`USB command transmitted (${data.length} bytes): ${commandPreview.substring(0, 50)}${commandPreview.length > 50 ? '...' : ''}`, 'info');
            
        } catch (error) {
            this.addLog(`Failed to send USB command: ${error.message}`, 'error');
            throw error;
        }
    }

    // Disconnect USB using WebUSB API
    async disconnectUSB() {
        try {
            // Stop USB data listener first
            this.stopUSBDataListener();
            
            if (this.usbDevice) {
                // Release claimed interfaces
                const interfaces = this.usbDevice.configuration?.interfaces || [];
                for (const interface_ of interfaces) {
                    if (interface_.claimed) {
                        await this.usbDevice.releaseInterface(interface_.interfaceNumber);
                    }
                }
                
                // Close the device
                await this.usbDevice.close();
                this.addLog('USB device disconnected', 'success');
                this.usbDevice = null;
            }
            if (this.sdk && this.sdk.disconnect) {
                await this.sdk.disconnect();
            }
            this.updateConnectionStatus(false);
        } catch (error) {
            this.addLog(`USB disconnect error: ${error.message}`, 'error');
        }
    }

    // Method to connect via Bluetooth
    async connectBluetooth() {
        if (!navigator.bluetooth) {
            this.addLog('Bluetooth not supported', 'error');
            return;
        }

        this.addLog('Connecting to Bluetooth printer...');
        this.bluetoothBtn.disabled = true;
        this.statusIndicator.className = 'status-indicator status-printing';
        this.statusText.textContent = 'Connecting...';

        try {
            // Use Brady SDK's built-in Bluetooth discovery and connection
            if (this.sdk && this.sdk.showDiscoveredBleDevices) {
                this.addLog('Using Brady SDK built-in Bluetooth discovery', 'info');
                
                // Use the Brady SDK's native Bluetooth connection method
                await this.sdk.showDiscoveredBleDevices();
                
                // Verify the connection was actually established
                // Wait a moment for connection to stabilize, then check
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (this.sdk && typeof this.sdk.isConnected === 'function') {
                    const connected = await this.sdk.isConnected();
                    if (connected) {
                        this.updateConnectionStatus(true, 'bluetooth');
                        this.addLog('Bluetooth connection established and verified via Brady SDK', 'success');
                        
                        // Reset reconnection attempts on successful connection
                        this.reconnectAttempts = 0;
                    } else {
                        throw new Error('Connection verification failed - device may not be connected');
                    }
                } else {
                    // If we can't verify, assume connected but log warning
                    this.updateConnectionStatus(true, 'bluetooth');
                    this.addLog('Bluetooth connection completed (verification not available)', 'warning');
                }
                
            } else {
                throw new Error('Brady SDK Bluetooth discovery method not available');
            }
        } catch (error) {
            // Check if error indicates user cancellation
            if (error.name === 'NotFoundError' || error.message.includes('User cancelled')) {
                this.addLog('Bluetooth connection cancelled by user', 'warning');
            } else if (error.message.includes('verification failed')) {
                this.addLog('Bluetooth connection failed verification - device may not be properly connected', 'error');
            } else {
                this.addLog(`Bluetooth connection failed: ${error.message}`, 'error');
            }
            this.updateConnectionStatus(false);
        } finally {
            this.bluetoothBtn.disabled = false;
            // Reset status indicator if connection failed
            if (!this.isConnected) {
                this.statusIndicator.className = 'status-indicator status-disconnected';
                this.statusText.textContent = 'Disconnected';
            }
        }
    }

    // Handle Bluetooth disconnection with reconnection logic
    handleBluetoothDisconnection() {
        const currentTime = Date.now();
        
        // Check if we're in a reconnection cooldown period
        if (currentTime - this.lastDisconnectionTime < this.reconnectionCooldown) {
            this.addLog('Bluetooth disconnection detected, but in cooldown period. Skipping reconnection attempt.', 'info');
            return;
        }
        
        this.lastDisconnectionTime = currentTime;
        this.addLog('Handling Bluetooth disconnection...', 'info');
        
        // Stop any existing connection monitoring
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
            this.connectionMonitor = null;
        }
        
        // Update UI to show disconnected state
        this.updateConnectionStatus(false);
        
        // Attempt reconnection if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.bluetoothDevice) {
            this.reconnectAttempts++;
            this.addLog(`Attempting automatic reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, 'info');
            
            // Use progressive backoff - longer wait times for subsequent attempts
            const waitTime = 5000 + (this.reconnectAttempts * 2000); // 5s, 7s, 9s...
            setTimeout(() => {
                this.attemptBluetoothReconnection();
            }, waitTime);
        } else {
            this.addLog('Maximum reconnection attempts reached or no device available', 'warning');
            this.reconnectAttempts = 0;
            
            // Show reconnect button for manual retry
            if (this.reconnectBtn) {
                this.reconnectBtn.style.display = 'inline-flex';
                this.reconnectBtn.disabled = false;
            }
        }
    }

    // Attempt to reconnect to Bluetooth device
    async attemptBluetoothReconnection() {
        if (!this.bluetoothDevice) {
            this.addLog('No Bluetooth device available for reconnection', 'error');
            return;
        }

        try {
            this.addLog('Attempting to reconnect to Bluetooth device...', 'info');
            this.statusIndicator.className = 'status-indicator status-printing';
            this.statusText.textContent = 'Reconnecting...';

            // Use Brady SDK for reconnection instead of manual GATT connection
            if (this.sdk && this.sdk.connect) {
                await this.sdk.connect({ type: 'bluetooth', device: this.bluetoothDevice });
            } else if (this.bluetoothDevice) {
                // Fallback to manual connection if SDK doesn't support it
                const server = await this.bluetoothDevice.gatt.connect();
                this.bluetoothServer = server;
            }
            
            this.updateConnectionStatus(true, 'bluetooth');
            this.addLog('Bluetooth reconnection successful', 'success');
            
            // Reset reconnection attempts on successful connection
            this.reconnectAttempts = 0;
            
            // Start connection monitoring
            this.startConnectionMonitoring();
            
        } catch (error) {
            this.addLog(`Bluetooth reconnection failed: ${error.message}`, 'error');
            this.handleBluetoothDisconnection(); // Try again if we haven't exceeded attempts
        }
    }

    // Start monitoring connection status
    startConnectionMonitoring() {
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
        }
        
        this.addLog('Starting connection monitoring...', 'info');
        
        // Use very gentle monitoring - only check every 30 seconds and be very conservative
        this.connectionMonitor = setInterval(async () => {
            // Only do basic connection monitoring, avoid aggressive health checks
            if (this.isConnected && this.connectionType === 'bluetooth') {
                // For Bluetooth, just check if we still think we're connected
                // Don't call SDK methods that might interfere with connection
                if (this.sdk && typeof this.sdk.isConnected === 'function') {
                    try {
                        // Quick non-blocking check
                        const connected = await Promise.race([
                            this.sdk.isConnected(),
                            new Promise(resolve => setTimeout(() => resolve(true), 2000)) // Timeout after 2 seconds
                        ]);
                        
                        if (connected === false) {
                            this.addLog('Connection monitoring detected disconnection', 'warning');
                            this.updateConnectionStatus(false);
                        }
                        // Reset failure count on any successful check
                        this.consecutiveHealthFailures = 0;
                    } catch (error) {
                        // Don't treat SDK errors as connection failures
                        // The connection might still be fine
                    }
                }
            }
        }, 30000); // Check every 30 seconds instead of aggressive checking
    }

    // Stop connection monitoring
    stopConnectionMonitoring() {
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
            this.connectionMonitor = null;
        }
    }

    // Initialize Brady SDK w Bluteooth device
    async initializeBradySDKWithBluetooth(device) {
        try {
            this.addLog('Brady SDK ready for Bluetooth operations', 'info');
            
            // Don't try to connect the Brady SDK to the Bluetooth device
            // Instead, we'll use the Brady SDK methods with our established GATT connection
            // The Brady SDK should handle its own Bluetooth connection management
            
            this.addLog('Brady SDK prepared for Bluetooth operations', 'success');
            
        } catch (error) {
            this.addLog(`Failed to prepare Brady SDK for Bluetooth: ${error.message}`, 'error');
            throw error;
        }
    }

    // Setup SDK event listeners separately to avoid initialization conflicts
    setupSDKEventListeners() {
        // Keep SDK event listeners minimal to avoid connection interference
        this.addLog('Setting up minimal SDK event listeners', 'info');
        
        if (!this.sdk) return;
        
        try {
            // Only setup essential event listeners, avoid connection status checks
            if (typeof this.sdk.on === 'function') {
                this.sdk.on('printerStatusChanged', this.printerUpdatesCallback.bind(this));
                this.addLog('Brady SDK event listeners configured', 'info');
            }
        } catch (error) {
            this.addLog(`SDK event listener setup failed: ${error.message}`, 'warning');
        }
    }

    // Disconnect Bluetooth
    async disconnectBluetooth() {
        try {
            // Stop connection monitoring
            this.stopConnectionMonitoring();
            
            // Reset reconnection attempts
            this.reconnectAttempts = 0;
            
            if (this.bluetoothServer && this.bluetoothServer.connected) {
                await this.bluetoothServer.disconnect();
                this.addLog('Bluetooth disconnected', 'success');
            }
            if (this.sdk && this.sdk.disconnect) {
                await this.sdk.disconnect();
            }
            
            // Clear device reference
            this.bluetoothDevice = null;
            this.bluetoothServer = null;
            
            this.updateConnectionStatus(false);
        } catch (error) {
            this.addLog(`Disconnect error: ${error.message}`, 'error');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BradyPrinterController();
});

// Export for potential external use
window.BradyPrinterController = BradyPrinterController;
