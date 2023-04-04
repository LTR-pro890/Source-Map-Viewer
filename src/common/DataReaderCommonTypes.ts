
import { DataReader, ReaderCustomType } from "./DataReader.js";



const _Array = Array;



export const DataReaderCommonTypes = {

    /**
     * Read ArrayBuffer.  
     */
    Buffer: function Buffer(reader, byteLength: number): ArrayBuffer {

        const buffer = reader.buffer.slice(reader.pointer, reader.pointer + byteLength);
        reader.pointer += byteLength;

        return buffer;

    } as ReaderCustomType,

    /**
     * Read a string in any encoding.  
     */
    String: function String(reader, byteLength: number, label: string = 'ascii'): string {

        /*
            Read string of any length and any encoding.
            The length is in bytes not characters.
        */
    
        if(reader.pointer + byteLength > reader.length) {
            throw new Error('DataReader.read("String"): Index out of bounds.');
        }
    
        const buffer: ArrayBuffer = reader.buffer.slice(reader.pointer, reader.pointer + byteLength);
        reader.pointer += byteLength;
    
        return new TextDecoder(label).decode(buffer);
    
    } as ReaderCustomType,

    /**
     * Read a string ending in null (0x00)  
     * May break with encodings other than ascii and utf-8.  
     *   
     * https://stackoverflow.com/questions/6907297/can-utf-8-contain-zero-byte  
     */
    NullString: function NullString(reader, label: string = 'ascii'): string {

        const start = reader.pointer;
    
        while(reader.read('Uint8') != 0);
    
        const buffer: ArrayBuffer = reader.buffer.slice(start, reader.pointer - 1);
    
        return new TextDecoder(label).decode(buffer);
    
    } as ReaderCustomType,

    /**
     * Read an array of the specified type.  
     *   
     * Usage:  
     * ```TypeScript
     * const mat4x4_1d: number[] = reader.read('Array', 'Float32', 16);
     * const mat4x4_2d: number[][] = reader.read('Array', 'Array', 4, 'Float32', 4);
     * ```
     */
    Array: function Array(reader: DataReader, type: string, length: number, ...args: any) {

        /*
            Reads an array of the specified type.
        */

        let arr = new _Array(length);

        for(let i=0; i < length; i++) {
            arr[i] = reader.read(type, ...args);
        }

        return arr;
    
    } as ReaderCustomType,

    /**
     * Pad start of read by number of bytes.  
     */
    PadStart: function PadStart(reader, bytes=0, type: string, ...args: any) {

        reader.pointer += bytes;
        return reader.read(type, ...args);

    } as ReaderCustomType,

    /**
     * Pad end of read by number of bytes.  
     */
    PadEnd: function PadEnd(reader, bytes: number | ((reader: DataReader, value: any) => number), type: string, ...args: any) {

        const value = reader.read(type, ...args);

        if(typeof bytes == 'number') {
            reader.pointer += bytes;
        } else {
            reader.pointer += bytes(reader, value);
        }

        return value;

    } as ReaderCustomType

}


