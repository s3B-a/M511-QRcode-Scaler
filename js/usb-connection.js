import { processData } from './dataprocess.js';

/**
 * Handles USB connections for Brady Printers
 */
class USBConnection {
    constructor() {
        this.device = null;
        this.interface = null;
        this.dataProcessor = new processData();
        this.responseTimeout = 5000;

        this.bradyVendorId = 0x0e2e;
        
        this.bradyProductIds = {
            0x010d: 'M511',
            0x010e: 'M611',
            0x010f: 'M711',
            0x0101: 'BBP31',
            0x0102: 'BBP33',
            0x0103: 'BBP35',
            0x0104: 'BBP37',
            0x0201: 'BMP21-PLUS',
            0x0202: 'BMP41',
            0x0203: 'BMP51',
            0x0204: 'BMP61',
            0x0301: 'S3100',
            0x0401: 'i3300',
            0x0402: 'i5300'
        };
    }

    // Attempt a connection with the printer
    async connect() {
        try {
            this.device = await navigator.usb.requestDevice({ filters: [{ vendorId: this.bradyVendorId }]});

            const printerModel = this.printerModel();
            console.log(`Selected device: ${printerModel} 
                        (VID: ${this.getVendorID().toString(16)}, 
                        PID: ${this.getProductID().toString(16)})`);

            this.interface = this.device.configuration.interfaces[0];
            await this.device.open();
            await this.device.selectConfiguration(1);
            await this.device.claimInterface(this.interface);
            console.log(`USB device connected and interface claimed: ${this.getInterface()}`);

            this.startResponseListener();
        } catch (error) {
            console.error('Error connecting to USB device:', error);
        }
    }

    // Disconnect from the USB device
    async disconnect() {
        if(this.device && this.device.opened) {
            try {
                await this.device.releaseInterface(this.interface.interfaceNumber);
                await this.device.close();
                console.log('USB device disconnected');
            } catch (error) {
                console.error('Error disconnecting USB device:', error);
            }
        }
        this.device = null;
        this.interface = null;
    }

    // Send a command to the USB device while converting it to a Uint8Array (Hex format)
    async sendCommand(command) {
        if (!this.device || !this.interface) {
            throw new Error('USB device is not connected!');
        }
        if(!command) {
            throw new Error('Command doesn\'t exist!');
        }

        let cmdData;
        switch(command) {
            case 'print':
                if(window.fileUploadAPI && (window.fileUploadAPI.getCurrentFile() || window.fileUploadAPI.hasConvertedImage())) {
                    console.log('Processing uploaded file for printing...');
                    return await this.printUploadedFile();
                } else {
                    cmdData = new Uint8Array([0x1B, 0x40, 0x1D, 0x6B, 0x01, 0x00]); // print
                    console.log(`attempting to print ${cmdData}`);
                }
                break;
            case 'cut':
                cmdData = new Uint8Array([0x1D, 0x69, 0x00]); // cut
                console.log(`attempting to cut ${cmdData}`);
                break;
            case 'feed':
                cmdData = new Uint8Array([0x1D, 0x4C, 0x00]); // feed
                console.log(`attempting to feed ${cmdData}`);
                break;
            case 'status':
                // Request printer status and wait for response
                return await this.sendCommandWithResponse('status');
            default:
                throw new Error('Unknown command: ' + command);
        }

        if(cmdData) {
            const result = await this.sendRawData(cmdData);
            
            // For certain commands, automatically read response
            if(['print', 'cut', 'feed'].includes(command)) {
                setTimeout(async () => {
                    await this.readResponse();
                }, 100); // Small delay to allow printer to process
            }
            
            return result;
        }
    }

    // Send the uploaded file to the printer
    async printUploadedFile() {
        try {
            let imageSource;

            if(window.fileUploadAPI.hasConvertedImage()) {
                imageSource = window.fileUploadAPI.getConvertedImage();
                console.log('Using converted image for printing');
            } else if (window.fileUploadAPI.getCurrentFile()) {
                imageSource = window.fileUploadAPI.getCurrentFile();
                console.log('Using uploaded file for printing');
            } else {
                throw new Error('No file available for printing');
            }

            const bitmapData = await this.dataProcessor.convertImageToBitmap(imageSource);
            const printCommands = this.dataProcessor.generateImageCommands(bitmapData);

            console.log(`Generated ${printCommands.length} bytes of print data`);

            return await this.sendRawData(printCommands);
        } catch (error) {
            console.error('Error printing uploaded file:', error);
            throw error;
        }
    }

    // Send raw data to the USB device
    async sendRawData(cmdData) {
        try {
            // Find the OUT endpoint for sending data
            const outEndpoint = this.interface.alternate.endpoints.find(
                endpoint => endpoint.direction === 'out'
            );

            if(!outEndpoint) {
                throw new Error('No OUT endpoint found');
            }

            const result = await this.device.transferOut(outEndpoint.endpointNumber, cmdData);
            console.log(`Data sent: ${result.bytesWritten} bytes`);
            return result;
        } catch (error) {
            console.error('Error sending command to USB device:', error);
            throw error;
        }
    }

    // Start listening for responses from the printer
    async startResponseListener() {
        if(!this.device || !this.interface) return;

        const inEndpoint = this.interface.alternate.endpoints.find(
            endpoint => endpoint.direction === 'in'
        );

        if(!inEndpoint) {
            console.warn('No IN endpoint found for USB device');
            return;
        }
        this.listenForResponses(inEndpoint);
    }

    // Listen for responses from the printer
    async listenForResponses(endpoint) {
        while(this.device && this.device.opened) {
            try {
                const result = await this.device.transferIn(endpoint.endpointNumber, 64);
                if(result.data && result.data.byteLength > 0) {
                    this.handlePrinterResponse(result.data);
                }
            } catch (error) {
                if (!error.message.includes('timeout') && !error.message.includes('LIBUSB_ERROR_TIMEOUT')) {
                    console.warn('Response listener error:', error);
                }
                await this.delay(100);
            }
        }
    }

    // handle printer responses
    handlePrinterResponse(data) {
        const response = new Uint8Array(data);
        const responseHex = Array.from(response).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`Printer response: [${response.length} bytes] ${responseHex}`);

        const status = this.parsePrinterStatus(response);
        if(status) {
            console.log(`Printer status: ${status}`);
        }

        window.dispatchEvent(new CustomEvent('printerResponse', {
            detail: {
                data: response,
                hex: responseHex,
                status: status
            }
        }));
    }

    // Parse through the printer status
    parsePrinterStatus(response) {
        if(response.length === 0) return null;

        switch(response[0]) {
            case 0x12: // DLE
                if(response.length >= 2) {
                    switch(response[1]) {
                        case 0x04: return 'Real-time status';
                        case 0x05: return 'Real-time printer status';
                        case 0x06: return 'Real-time paper status';
                        default: return `DLE command: 0x${response[1].toString(16)}`;
                    }
                }
                break;
            case 0x10: // Data Link Escape
                return 'Status response';
            case 0x00:
                return 'Ready';
            case 0x01:
                return 'Paper out';
            case 0x02:
                return 'Cover open';
            case 0x04:
                return 'Cutter error';
            case 0x08:
                return 'Print error';
            default:
                return `Unknown status: 0x${response[0].toString(16)}`;
        }
        return null;
    }

    // read responses from the printer with a specified timeout
    async readResponse(expectedBytes = 64, timeout = this.responseTimeout) {
        if(!this.device || !this.interface) {
            throw new Error('USB device or interface not available');
        }

        const inEndpoint = this.interface.alternate.endpoints.find(
            endpoint => endpoint.direction === 'in'
        );

        if(!inEndpoint) {
            throw new Error('No IN endpoint found');
        }

        try {
            const result = await Promise.race([
                this.device.transferIn(inEndpoint.endpointNumber, expectedBytes),
                this.timeoutPromise(timeout)
            ]);

            if(result.data && result.data.byteLength > 0) {
                const response = new Uint8Array(result.data);
                console.log(`Response received: [${response.length} bytes] 
                            ${Array.from(response).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
                return response;
            }
            return null;
        } catch (error) {
            if(error.message === 'timeout') {
                console.warn('No response received (timed out)');
                return null;
            }
            throw error;
        }
    }

    // send a command, this is different from the sendCommand() method as this uses both
    // the command and the uploaded file sent from the user
    async sendCommandWithResponse(command) {
        if(!this.device || !this.interface) {
            throw new Error('USB device or interface not available');
        }
        if(!command) {
            throw new Error('Invalid command');
        }

        let cmdData
        switch(command) {
            case 'status':
                // Request printer status
                cmdData = new Uint8Array([0x10, 0x04, 0x01]); // DLE EOT 1
                break;
            case 'print':
                if(window.fileUploadAPI && (window.fileUploadAPI.getCurrentFile() || window.fileUploadAPI.hasConvertedImage())) {
                    console.log('Processing uploaded file for printing...');
                    return await this.printUploadedFileWithResponse();
                } else {
                    cmdData = new Uint8Array([0x1B, 0x40, 0x1D, 0x6B, 0x01, 0x00]);
                }
                break;
            case 'cut':
                cmdData = new Uint8Array([0x1D, 0x69, 0x00]);
                break;
            case 'feed':
                cmdData = new Uint8Array([0x1D, 0x4C, 0x00]);
                break;
            default:
                throw new Error(`Unknown command: ${command}`);
        }

        if(cmdData) {
            await this.sendRawData(cmdData);
            const response = await this.readResponse();
            return response;
        }
    }

    // Print the uploaded file and await a response
    async printUploadedFileWithResponse() {
        try {
            const result = await this.printUploadedFile();
            const response = await this.readResponse();
            return { result, response };
        } catch (error) {
            console.error('Error printing uploaded file:', error);
            throw error;
        }
    }

    timeoutPromise(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), ms) // Reject after the specified timeout
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Determine the printer model based on the received productID
    printerModel() {
        if (!this.device) return null;
        return this.bradyProductIds[this.device.productId] || 'Unknown Model';
    }

    getDeviceName() {
        return this.device ? this.device.productName : null;
    }

    getInterface() {
        return this.interface ? this.interface.interfaceNumber : null;
    }

    getVendorID() {
        return this.device ? this.device.vendorId : null;
    }

    getProductID() {
        return this.device ? this.device.productId : null;
    }
}

export { USBConnection };