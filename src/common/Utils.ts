


type DimensionalArray = Array<DimensionalArray>;



const downloadElement = document.createElement('a');
downloadElement.style.display = 'none';
downloadElement.id = 'Utils download element';



namespace Utils {

    export function wait(ms: number=1000): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    }



    export function createNthDimensionalArray(dimensions: number[] = []): DimensionalArray | null {

        if(dimensions.length == 0) return null;

        // @ts-ignore
        return new Array(dimensions[0]).fill(null).map(() => {
            return Utils.createNthDimensionalArray(dimensions.slice(1));
        });

    }


    
    export function assert(check: boolean, message?: string): asserts check {
        if(!check) {
            if(message === undefined) {
                throw new Error('Assert failed.');
            } else {
                throw new Error(`Assert failed: ${message}`);
            }
        }
    }



    export type DataBuffer = 
        ArrayBuffer |
        Uint8Array |
        Uint8ClampedArray |
        Int8Array |
        Uint16Array |
        Int16Array |
        Uint32Array |
        Int32Array |
        BigUint64Array |
        BigInt64Array |
        Float32Array |
        Float64Array;

    export function getBuffer(array: Utils.DataBuffer): ArrayBuffer {
        return (array instanceof ArrayBuffer ? array : array.buffer);
    }



    /**
     * Create an initial array with set of elements mapped based on index.  
     */
    export function initArray<T>(length: number, map: (index: number) => T): T[] {
        let arr = new Array(length);
        for(let i=0; i < length; i++) {
            arr[i] = map(i);
        }
        return arr;
    }

    /**
     * Asynchronously map elements to create an initial array with set of elements mapped based on index.  
     */
    export async function initArrayAsync<T>(length: number, map: (index: number) => Promise<T>): Promise<T[]> {
        return Promise.all(initArray(length, map));
    }

    /**
     * Synchronously map elements to create an initial array with set of elements mapped based on index.  
     */
    export async function initArrayAwait<T>(length: number, map: (index: number) => Promise<T>): Promise<T[]> {
        let arr = new Array(length);
        for(let i=0; i < length; i++) {
            arr[i] = await map(i);
        }
        return arr;
    }

    export function getImageCanvas(img: ImageData, imageRendering: 'auto' | 'smooth' | 'high-quality' | 'crisp-edges' | 'pixelated' = 'auto'): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.imageRendering = imageRendering;
        const ctx = canvas.getContext('2d');
        ctx?.putImageData(img, 0, 0);
        return canvas;
    }

    export function download(data: Utils.DataBuffer | BlobPart, filename: string = 'data.bin') {

        const blob = new Blob([ data ], { type: 'octet/stream' });

        const url = URL.createObjectURL(blob);

        downloadElement.href = url;
        downloadElement.download = filename;
        downloadElement.click();
        
        URL.revokeObjectURL(url);

    }

}



export { Utils };
