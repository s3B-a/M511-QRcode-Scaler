// File upload handling functionality
class FileUploadHandler {
    constructor() {
        this.uploadArea      = document.getElementById('uploadArea');
        this.fileInput       = document.getElementById('fileInput');
        this.previewArea     = document.getElementById('previewArea');
        this.previewImage    = document.getElementById('previewImage');
        this.fileInfo        = document.getElementById('fileInfo');
        this.fileDetails     = document.getElementById('fileDetails');
        this.printBtn        = document.getElementById('printBtn');
        this.logArea         = document.getElementById('logArea');

        this.currentFile     = null;
        this.convertedImage  = null; // Store converted image for non-image files

        this.initializeEventListeners();
        this.loadPDFJS(); // Load PDF.js library
        this.addLog('File upload system ready');
    }

    // Load PDF.js library dynamically
    loadPDFJS() {
        if (typeof pdfjsLib !== 'undefined') {
            this.addLog('PDF.js already loaded', 'info');
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            this.addLog('PDF.js from cdnjs loaded successfully', 'success');
        };
        script.onerror = () => {
            this.addLog('Failed to load PDF.js - PDF conversion will not be available', 'warning');
        };
        document.head.appendChild(script);
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
    async handleFile(file) {
        this.currentFile = file;
        this.convertedImage = null; // Reset converted image
        this.addLog(`File selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        
        // Show file info
        this.fileDetails.innerHTML = `
            <strong>Name:</strong> ${file.name}<br>
            <strong>Size:</strong> ${(file.size / 1024).toFixed(1)} KB<br>
            <strong>Type:</strong> ${file.type}<br>
            <strong>Last Modified:</strong> ${new Date(file.lastModified).toLocaleString()}
        `;
        this.fileInfo.style.display = 'block';

        try {
            // Handle different file types
            if (file.type.startsWith('image/')) {
                // Direct image handling
                await this.handleImageFile(file);
            } else if (file.type === 'application/pdf') {
                // Convert PDF to image
                this.addLog('Converting PDF to image...', 'info');
                await this.convertPDFToImage(file);
            } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                // Convert TXT to image
                this.addLog('Converting text file to image...', 'info');
                await this.convertTextToImage(file);
            } else {
                // Unsupported file type
                this.previewArea.style.display = 'none';
                this.addLog('Unsupported file type - please use images, PDFs, or text files', 'warning');
                if (this.printBtn) {
                    this.printBtn.disabled = true;
                }
                return;
            }
        } catch (error) {
            this.addLog(`Error processing file: ${error.message}`, 'error');
            this.previewArea.style.display = 'none';
            if (this.printBtn) {
                this.printBtn.disabled = true;
            }
        }
    }

    // Handle image files directly
    async handleImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewImage.src = e.target.result;
                this.previewArea.style.display = 'block';
                if (this.printBtn) {
                    this.printBtn.disabled = false;
                }
                this.addLog('Image preview loaded - ready to print', 'success');
                resolve();
            };
            reader.onerror = () => {
                reject(new Error('Failed to read image file'));
            };
            reader.readAsDataURL(file);
        });
    }

    // Convert PDF to image
    async convertPDFToImage(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js not loaded - cannot convert PDF files');
        }

        const arrayBuffer   = await file.arrayBuffer();
        const pdf           = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        // Get first page
        const page          = await pdf.getPage(1);
        const scale         = 2; // Higher scale for better quality
        const viewport      = page.getViewport({ scale });

        // Create canvas
        const canvas        = document.createElement('canvas');
        const context       = canvas.getContext('2d');
        canvas.height       = viewport.height;
        canvas.width        = viewport.width;

        // Render page to canvas
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;

        // Convert to image and display
        const imageDataUrl  = canvas.toDataURL('image/png');
        this.convertedImage = imageDataUrl;
        
        this.previewImage.src = imageDataUrl;
        this.previewArea.style.display = 'block';
        if (this.printBtn) {
            this.printBtn.disabled = false;
        }
        
        this.addLog(`PDF converted to image (${Math.round(canvas.width)}x${Math.round(canvas.height)}) - ready to print`, 'success');
    }

    // Convert text file to image
    async convertTextToImage(file) {
        const text = await file.text();
        
        // Create canvas for text rendering
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size (standard label size)
        const width     = 800;
        const height    = 600;
        canvas.width    = width;
        canvas.height   = height;
        
        // Set background to white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        
        // Set text properties
        ctx.fillStyle       = 'black';
        ctx.font            = '16px Arial';
        ctx.textAlign       = 'left';
        ctx.textBaseline    = 'top';
        
        // Split text into lines that fit the canvas width
        const lines = this.wrapText(ctx, text, width - 40); // 20px margin on each side
        
        // Draw text lines
        const lineHeight = 20;
        let y = 20; // Start with top margin
        
        for (let i = 0; i < lines.length && y < height - 20; i++) {
            ctx.fillText(lines[i], 20, y); // 20px left margin
            y += lineHeight;
        }
        
        // If text is too long, add "..." at the bottom
        if (lines.length * lineHeight > height - 40) {
            ctx.fillText('...', 20, height - 40);
        }
        
        // Convert to image and display
        const imageDataUrl = canvas.toDataURL('image/png');
        this.convertedImage = imageDataUrl;
        
        this.previewImage.src = imageDataUrl;
        this.previewArea.style.display = 'block';
        if (this.printBtn) {
            this.printBtn.disabled = false;
        }
        
        this.addLog(`Text converted to image (${lines.length} lines) - ready to print`, 'success');
    }

    // Helper function to wrap text to fit canvas width
    wrapText(ctx, text, maxWidth) {
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

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
    
    // Export API for printer controller with enhanced functionality
    window.fileUploadAPI = {
        getCurrentFile: () => fileUploadHandler.getCurrentFile(),
        addLog: (message, type) => fileUploadHandler.addLog(message, type),
        updatePrintButton: (enabled) => fileUploadHandler.updatePrintButton(enabled),
        getConvertedImage: () => fileUploadHandler.convertedImage,
        hasConvertedImage: () => !!fileUploadHandler.convertedImage
    };
    
    // Export the file upload handler instance for direct access
    window.fileUploadHandler = fileUploadHandler;
});
