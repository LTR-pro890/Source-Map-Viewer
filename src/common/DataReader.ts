
import { Utils } from "./Utils";



type ViewType = 
    'Uint8' |
    'Int8' |
    'Uint16' |
    'Int16' |
    'Uint32' | 
    'Int32' |
    'BigUint64' |
    'BigInt64' |
    'Float32' | 
    'Float64';

const ViewTypeSizes = {
    'Uint8': 1,
    'Int8': 1,
    'Uint16': 2,
    'Int16': 2,
    'Uint32': 4,
    'Int32': 4,
    'BigUint64': 8,
    'BigInt64': 8,
    'Float32': 4,
    'Float64': 8,
}



type ReaderCustomType = (reader: DataReader, ...args: any) => any;



class DataReader {

    buffer: ArrayBuffer = new ArrayBuffer(0);
    view: DataView = new DataView(this.buffer);
    pointer: number = 0;

    get length() {
        return this.buffer.byteLength;
    }

    get eof() {
        return (this.pointer >= this.length);
    }

    loadData(buffer: ArrayBuffer | Utils.DataBuffer): void {
        this.buffer = Utils.getBuffer(buffer);
        this.view = new DataView(buffer);
        this.pointer = 0;
    }



    customTypes: Map<string, ReaderCustomType> = new Map();



    setType(func: ReaderCustomType): void;
    setType(name: string, func: ReaderCustomType): void;
    setType(funcs: Array<ReaderCustomType>): void;
    setType(funcs: {[key: string]: ReaderCustomType}): void;
    setType(): void {
        if(arguments.length == 0) {
            throw new Error('DataReader.setType: No arguments.');
        }

        if(arguments.length == 1) {

            const arg = arguments[0];

            if(typeof arg == 'function') {
                if(arg.name == '') {
                    throw new Error('DataReader.setType: Invalid function.');
                }
        
                return this.setType(arg.name, arg);
            }

            if(arg instanceof Array) {
                
                if(!arg.every(f => typeof f == 'function')) {
                    throw new Error(`DataReader.setType: Array argument isn't all functions.`);
                }

                for(const value of arg) {
                    this.setType(value);
                }

                return;

            }

            if(typeof arg == 'object') {

                if(!Object.values(arg).every(f => typeof f == 'function')) {
                    throw new Error(`DataReader.setType: Object argument isn't all functions.`);
                }

                for(const key in arg) {
                    this.setType(key, arg[key]);
                }

                return;

            }

        } else if(arguments.length == 2) {

            const arg1 = arguments[0];
            const arg2 = arguments[1];

            if(typeof arg1 == 'string' && typeof arg2 == 'function') {

                if(this.customTypes.has(arg1)) {
                    console.warn(`DataReader.setType: Overwritting type "${arg1}".`);
                }

                this.customTypes.set(arg1, arg2);

                return;

            }

        }

        throw new Error('DataReader.setType: Too many arguments.');

    }



    static BIG_ENDIAN = false;
    static LITTLE_ENDIAN = true;

    endianness = DataReader.LITTLE_ENDIAN;



    /**
     * TODO: Figure out if theres a way to allow type to be customTypes for typescript.
     * So I can remove the ' | string' and ts-ignore.  
     */
    read(type: ViewType | string, ...args: any): number | bigint | any {

        // @ts-ignore
        if(this.view[`get${type}`] !== undefined) {
            // @ts-ignore
            const num: number | bigint = this.view[`get${type}`](this.pointer, this.endianness);
            // @ts-ignore
            this.pointer += ViewTypeSizes[type];
            return num;
        }

        if(this.customTypes.has(type)) {
            // @ts-ignore
            return this.customTypes.get(type)(this, ...args);
            // Custom types are expected to increment the pointer.
        }

        throw new Error(`DataReader.read: Could not find type ${type}`);

    }

}



export { DataReader, ReaderCustomType };
