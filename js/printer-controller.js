import BradySdk from 'brady-web-sdk';
import { USBConnection } from './usb-connection.js';

/**
 * Brady Printer Controller class with enhanced debugging
 * Handles communication with the Brady printer SDK and the front end of the website
 */
class BradyPrinterController {
    constructor() {
        // Initialize SDK and connection variables
        this.sdk                        = new BradySdk(); // Initialize the SDK
        this.isConnected                = false;
        this.currentFile                = null;
        this.bluetoothDevice            = null;
        this.bluetoothServer            = null;
        this.usbDevice                  = null;
        this.connectionType             = null; // 'network', 'bluetooth', 'usb'
        this.debugMode                  = false; // Enable detailed logging
        
        // Initialize UI elements
        this.statusIndicator    = document.getElementById('statusIndicator');
        this.statusText         = document.getElementById('statusText');
        this.bluetoothBtn       = document.getElementById('bluetoothBtn');
        this.reconnectBtn       = document.getElementById('reconnectBtn');
        this.usbBtn             = document.getElementById('usbBtn');
        this.printBtn           = document.getElementById('printBtn');
        this.feedBtn            = document.getElementById('feedBtn');
        this.cutBtn             = document.getElementById('cutBtn');
        this.statusBtn          = document.getElementById('statusBtn');

        // Initialize SDK safely
        this.initializeSDK();
        this.createListeners();
        this.buttonStatus();
        this.addLog('Brady Printer Controller initialized');
    }

    // Initialize the Brady SDK
    initializeSDK() {
        // Check if Brady SDK is loaded globally
        if (typeof window.BradySdk !== 'undefined') {
            this.sdk = new window.BradySdk();
            this.addLog('Brady SDK initialized successfully', 'success');
        } else if (typeof BradySdk !== 'undefined') {
            this.sdk = new BradySdk();
            this.addLog('Brady SDK initialized successfully', 'success');
        } else {
            this.addLog('Brady SDK not yet loaded, retrying...', 'warning');
            // Retry after a short delay
            setTimeout(() => this.initializeSDK(), 100);
        }
    }

    // Enable or disable buttons based on connection status
    buttonStatus(buttonName, status) {
        const interactionButtons = [
            this.feedBtn,
            this.cutBtn,
            this.statusBtn
        ];

        switch(buttonName, status) {
            case 'all', true:
                interactionButtons.forEach(button => button.disabled = false);
                break;
            case 'usb', true:
                this.buttonStatus('all', true);
                break;
            case 'bluetooth', true:
                this.buttonStatus('all', true);
                break;
            case 'all', false:
                interactionButtons.forEach(button => button.disabled = true);
                break;
            case 'usb', false:
                this.buttonStatus('all', false);
                break;
            case 'bluetooth', false:
                this.buttonStatus('all', false);
                break;
        }
    }

    // Create event listeners for UI elements
    createListeners() {
        this.bluetoothBtn.addEventListener('click', () => this.connectBluetooth());
        this.usbBtn.addEventListener('click', () => this.connectUSB());
        this.printBtn.addEventListener('click', () => this.sendCommandUSB('print'));
        this.feedBtn.addEventListener('click', () => this.sendCommandUSB('feed'));
        this.cutBtn.addEventListener('click', () => this.sendCommandUSB('cut'));
        this.statusBtn.addEventListener('click', () => this.checkStatus());
    }

    // Connect to the USB printer via usb-connection.js
    connectUSB() {
        this.addLog('Attempting USB connection...', 'info');

        this.usb = new USBConnection();
        this.usb.connect().then(() => {
            this.addLog(`Connected! ${this.usb.getDeviceName()}`, 'success');
            this.connectionType = 'usb';

            this.buttonStatus(this.connectionType, true);
            this.statusText.textContent = `Connected to ${this.usb.getDeviceName()}`;
            this.statusIndicator.style.backgroundColor = 'green';
        }).catch((error) => {
            this.addLog('Connection failed: ' + error, 'error');
            this.isConnected = false;
        });
    }

    // Send a command to the USB printer via usb-connection.js
    async sendCommandUSB(command) {
        if (this.usb) {
            try {
                this.addLog(`Sending USB command: ${command}`, 'info');
                
                if (command === 'print') {
                    if (window.fileUploadAPI && (window.fileUploadAPI.getCurrentFile() 
                                                || window.fileUploadAPI.hasConvertedImage())) {
                        this.addLog('Processing uploaded file for printing...', 'info');
                    } else {
                        this.addLog('No file uploaded - sending default print command', 'warning');
                    }
                }
                
                await this.usb.sendCommand(command);
                this.addLog(`Command ${command} sent successfully`, 'success');
            } catch (error) {
                this.addLog(`Failed to send command: ${error.message}`, 'error');
            }
        } else {
            this.addLog('USB connection not established', 'error');
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BradyPrinterController();
});

// Export for potential external use
window.BradyPrinterController = BradyPrinterController;
