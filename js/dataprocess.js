class processData {
    constructor() {
        this.data = [];
    }

    async convertImageToBitmap(imageSource) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const maxWidth = 384;
                const maxHeight = 300;

                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                canvas.width = Math.floor(img.width * scale);
                canvas.height = Math.floor(img.height * scale);
                
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const bitmapData = this.convertToBitmap(ctx, canvas.width, canvas.height);
                resolve(bitmapData);
            };

            img.onerror = () => reject(new Error('Failed to load image'));

            if(typeof imageSource === 'string') {
                img.src = imageSource;
            } else if(imageSource instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => img.src = e.target.result;
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(imageSource);
            } else {
                reject(new Error('Unsupported image source type'));
            }
        });
    }

    convertToBitmap(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        const bytesPerRow = Math.ceil(width / 8);
        const bitmapData = new Uint8Array(bytesPerRow * height);

        let byteIndex = 0;
        let bitIndex = 0;
        let currentByte = 0;

        for(let y = 0; y < height; y++) {
            for(let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];

                const grayscale = (r + g + b) / 3;
                const isBlack = grayscale < 128 ? 1 : 0;

                currentByte |= (isBlack << (7 - bitIndex));
                bitIndex++;

                if(bitIndex === 8 || x === width - 1) {
                    bitmapData[byteIndex] = currentByte;
                    byteIndex++;
                    currentByte = 0;
                    bitIndex = 0;
                }
            }
        }
        return { data: bitmapData, width, height, bytesPerRow };
    }

    generateImageCommands(bitmapData) {
        const commands = [];

        // Printer initialization
        commands.push(0x1B, 0x40);

        // Set image mode - ESC/POS raster bit image command
        // GS v 0 m xL xH yL yH d1...dk (Raster bit image)
        commands.push(0x1D, 0x76, 0x30, 0x00);

        const widthBytes = bitmapData.bytesPerRow;
        const height = bitmapData.height;

        commands.push(widthBytes & 0xFF, (widthBytes >> 8) & 0xFF); // width in bytes
        commands.push(height & 0xFF, (height >> 8) & 0xFF); // height in bytes

        // remainder of bitmap data
        commands.push(...bitmapData.data);

        // print and feed
        commands.push(0x0A);

        return new Uint8Array(commands);
    }

    async processCurrentFile() {
        if(!window.fileUploadAPI) {
            throw new Error('File upload API not available');
        }

        let imageSource;
        if(window.fileUploadAPI.hasConvertedImage()) {
            imageSource = window.fileUploadAPI.getConvertedImage();
        } else if (window.fileUploadAPI.getCurrentFile()) {
            imageSource = window.fileUploadAPI.getCurrentFile();
        } else {
            throw new Error('No file uploaded');
        }

        try {
            const bitmapData = await this.convertImageToBitmap(imageSource);
            const commands = this.generateImageCommands(bitmapData);
            return commands;
        } catch (error) {
            console.error('Error processing current file:', error);
            throw error;
        }
    }

    // Legacy method for backward compatibility
    async processUploadedFile() {
        return await this.processCurrentFile();
    }

    async getPrintData() {
        return await this.processUploadedFile();
    }
}

export { processData };