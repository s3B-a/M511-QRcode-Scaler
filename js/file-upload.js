// File upload handling functionality
class FileUploadHandler {
    constructor() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.previewArea = document.getElementById('previewArea');
        this.previewImage = document.getElementById('previewImage');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileDetails = document.getElementById('fileDetails');
        this.printBtn = document.getElementById('printBtn');
        this.logArea = document.getElementById('logArea');
        
        this.currentFile = null;
        
        this.initializeEventListeners();
        this.addLog('File upload system ready');
    }

    // Method to add logs to the log panel
    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        logEntry.innerHTML = `[${timestamp}] ${icon} ${message}`;
        this.logArea.appendChild(logEntry);
        this.logArea.scrollTop = this.logArea.scrollHeight;
    }

    // Method to initialize event listeners
    initializeEventListeners() {
        // Drag and drop functionality
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });
    }

    // Method to handle file uploads
    handleFile(file) {
        this.currentFile = file;
        this.addLog(`File selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        
        // Show file info
        this.fileDetails.innerHTML = `
            <strong>Name:</strong> ${file.name}<br>
            <strong>Size:</strong> ${(file.size / 1024).toFixed(1)} KB<br>
            <strong>Type:</strong> ${file.type}<br>
            <strong>Last Modified:</strong> ${new Date(file.lastModified).toLocaleString()}
        `;
        this.fileInfo.style.display = 'block';

        // Preview image if it's an image file
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewImage.src = e.target.result;
                this.previewArea.style.display = 'block';
                if (this.printBtn) {
                    this.printBtn.disabled = false;
                }
                this.addLog('Image preview loaded - ready to print', 'success');
            };
            reader.readAsDataURL(file);
        } else {
            this.previewArea.style.display = 'none';
            this.addLog('File uploaded (non-image files will be processed when printing)', 'warning');
        }
    }

    // Returns the current uploaded file
    getCurrentFile() {
        return this.currentFile;
    }

    // Updates the state of the print button
    updatePrintButton(enabled) {
        if (this.printBtn) {
            this.printBtn.disabled = !enabled;
        }
    }
}

// Initialize the file upload handler and export API
let fileUploadHandler;

document.addEventListener('DOMContentLoaded', () => {
    fileUploadHandler = new FileUploadHandler();
    
    // Export API for printer controller
    window.fileUploadAPI = {
        getCurrentFile: () => fileUploadHandler.getCurrentFile(),
        addLog: (message, type) => fileUploadHandler.addLog(message, type),
        updatePrintButton: (enabled) => fileUploadHandler.updatePrintButton(enabled)
    };
});
