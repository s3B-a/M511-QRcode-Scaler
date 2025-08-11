import BradySdk from 'brady-web-sdk';

/**
 * Brady Printer Controller class
 * Handles communication with the Brady printer SDK and the front end of the website
 */
class BradyPrinterController {
    constructor() {
        this.sdk = null;
        this.isConnected = false;
        this.currentFile = null;
        
        // Initialize UI elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.discoverBtn = document.getElementById('discoverBtn');
        this.printBtn = document.getElementById('printBtn');
        this.feedBtn = document.getElementById('feedBtn');
        this.cutBtn = document.getElementById('cutBtn');
        
        this.initializeSDK();
        this.initializeEventListeners();
        this.addLog('Brady Printer Controller initialized');
    }

    // Method to initialize the Brady SDK for use
    initializeSDK() {
        try {
            this.sdk = new BradySdk(this.printerUpdatesCallback.bind(this));
            this.sdk.initializeEventListeners();
            this.addLog('Brady SDK initialized successfully', 'success');
        } catch (error) {
            this.addLog(`Error initializing Brady SDK: ${error.message}`, 'error');
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
    updateConnectionStatus(connected) {
        this.isConnected = connected;
        
        if (connected) {
            this.statusIndicator.className = 'status-indicator status-connected';
            this.statusText.textContent = 'Connected';
            this.addLog('Printer connected successfully', 'success');
        } else {
            this.statusIndicator.className = 'status-indicator status-disconnected';
            this.statusText.textContent = 'Disconnected';
            this.addLog('Printer disconnected', 'warning');
        }
        
        // Enable/disable control buttons based on connection status
        this.printBtn.disabled = !connected || !this.currentFile;
        this.feedBtn.disabled = !connected;
        this.cutBtn.disabled = !connected;
    }

    // Method for printer discovery
    async discoverPrinter() {
        this.addLog('Searching for Brady printers...');
        this.discoverBtn.disabled = true;
        this.statusIndicator.className = 'status-indicator status-printing';
        this.statusText.textContent = 'Discovering...';
        
        try {
            await this.sdk.discoverPrinters();
            this.addLog('Printer discovery completed', 'success');
            // Note: Connection status will be updated via callback
        } catch (error) {
            this.addLog(`Discovery failed: ${error.message}`, 'error');
            this.updateConnectionStatus(false);
        } finally {
            this.discoverBtn.disabled = false;
        }
    }

    // Method to print the uploaded image
    async printImage() {
        if (!this.currentFile) {
            this.addLog('No file selected for printing', 'error');
            return;
        }

        if (!this.isConnected) {
            this.addLog('Printer not connected. Please discover printer first.', 'error');
            return;
        }

        this.addLog(`Starting print job for: ${this.currentFile.name}`);
        this.printBtn.disabled = true;
        this.statusIndicator.className = 'status-indicator status-printing';
        this.statusText.textContent = 'Printing...';

        try {
            // Create image element from file
            const imageElement = await this.createImageElement(this.currentFile);
            await this.sdk.printImage(imageElement);
            this.addLog('Print job completed successfully', 'success');
        } catch (error) {
            this.addLog(`Print failed: ${error.message}`, 'error');
        } finally {
            this.printBtn.disabled = false;
            this.updateConnectionStatus(this.isConnected);
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

    // Feed the label to the printer
    async feedLabel() {
        if (!this.isConnected) {
            this.addLog('Printer not connected', 'error');
            return;
        }

        this.addLog('Feeding label...');
        this.feedBtn.disabled = true;

        try {
            await this.sdk.feedLabel();
            this.addLog('Label fed successfully', 'success');
        } catch (error) {
            this.addLog(`Feed failed: ${error.message}`, 'error');
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
            await this.sdk.cutLabel();
            this.addLog('Label cut successfully', 'success');
        } catch (error) {
            this.addLog(`Cut failed: ${error.message}`, 'error');
        } finally {
            this.cutBtn.disabled = false;
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Button event listeners
        this.discoverBtn.addEventListener('click', () => this.discoverPrinter());
        this.printBtn.addEventListener('click', () => this.printImage());
        this.feedBtn.addEventListener('click', () => this.feedLabel());
        this.cutBtn.addEventListener('click', () => this.cutLabel());

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
        setInterval(checkForFile, 500);

        // SDK event listeners
        if (this.sdk) {
            this.sdk.on('printerStatusChanged', this.printerUpdatesCallback.bind(this));
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