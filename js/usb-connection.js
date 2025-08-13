import { processData } from './dataprocess.js';

/**
 * Handles USB connections for Brady Printers
 */
class USBConnection {
    constructor() {
        this.device = null;
        this.interface = null;
        this.dataProcessor = new processData();

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
        } catch (error) {
            console.error('Error connecting to USB device:', error);
        }
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
            default:
                throw new Error('Unknown command: ' + command);
        }

        if (cmdData) {
            return await this.sendRawData(cmdData);
        }
    }

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

    async sendRawData(cmdData) {
        try {
            const outEndpoint = this.interface.alternate.endpoints.find(
                endpoint => endpoint.direction === 'out'
            );

            if(!outEndpoint) {
                throw new Error('No OUT endpoint found');
            }

            const result = await this.device.transferOut(outEndpoint.endpointNumber, cmdData);
            console.log(`Command sent, result: ${result.bytesWritten} bytes`);
            return result;
        } catch (error) {
            console.error('Error sending command to USB device:', error);
            throw error;
        }
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