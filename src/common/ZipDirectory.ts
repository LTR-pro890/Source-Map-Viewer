
import * as Pako from "pako";
import { DataReader, ReaderCustomType } from "./DataReader";
import { DataReaderCommonTypes } from "./DataReaderCommonTypes";
import { DirEntry, DirType, DirectoryBase, FileBase, fixPath } from "./Directory";
import * as LZMA from "./codecs/lzma";
import { Utils } from "./Utils";



enum GeneralFlags {
    encrypted = 0b0000000000000001,
    dataDescriptor = 0b0000000000001000,
    compressedPatched = 0b0000000000100000,
    strongEncryption = 0b0000000001000000,
    languageEncoding = 0b0000100000000000,
    encryptedLocalHeaders = 0b0010000000000000,
    // Compression
    implode_is8k = 0b0000000000000010,
    implode_is3trees = 0b0000000000000100,
    deflate_mode = 0b0000000000000110,
    lzma_iseospresent = 0b0000000000000010,
    deflate_enhanced = 0b0000000000010000,
    pkware_enhanced = 0b0001000000000000
}



enum CompressionMethods {
    store = 0,
    shrunk = 1,
    reduce_f1 = 2,
    reduce_f2 = 3,
    reduce_f3 = 4,
    reduce_f4 = 5,
    implode = 6,
    RESERVED_tokenizing = 7,
    deflate = 8,
    enhanced_deflate = 9,
    pkware_implode = 10,
    RESERVED_pkware_1 = 11,
    BZIP2 = 12,
    RESERVED_pkware_2 = 13,
    LZMA = 14,
    RESERVED_pkware_3 = 15,
    CMPSC = 16,
    RESERVED_pkware_4 = 17,
    TERSE = 18,
    LZ77 = 19,
    DEPRECATED_zstd = 20,
    zstd = 93,
    mp3 = 94,
    xz = 95,
    jpeg = 96,
    wavpack = 97,
    PPMd = 98,
    AEx_EncryptionMarker = 99
}



class ZipFile extends DirEntry implements FileBase {
    readonly type = DirType.File;

    get size(): number {
        throw new Error("Method not implemented.");
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        if(this.uncompressedBlob === undefined) {
            throw new Error('ZipFile.arrayBuffer: Must call ZipFile.init first!');
        }

        return await this.uncompressedBlob.arrayBuffer();
    }

    slice(start?: number | undefined, end?: number | undefined): Blob {
        if(this.uncompressedBlob === undefined) {
            throw new Error('ZipFile.slice: Must call ZipFile.init first!');
        }

        return this.uncompressedBlob.slice(start, end);
    }

    stream(): ReadableStream<Uint8Array> {
        if(this.uncompressedBlob === undefined) {
            throw new Error('ZipFile.stream: Must call ZipFile.init first!');
        }

        return this.uncompressedBlob.stream();
    }

    async text(): Promise<string> {
        if(this.uncompressedBlob === undefined) {
            throw new Error('ZipFile.text: Must call ZipFile.init first!');
        }

        return await this.uncompressedBlob.text();
    }



    archive: FileBase;
    flags: number;
    compressionMethod: CompressionMethods;
    crc32: number;
    compressedSize: number;
    uncompressedSize: number;
    offset: number;
    


    constructor(archive: FileBase, localFileHeader: LocalFileHeader, offset: number) {
        super(fixPath(localFileHeader.fileName), null);

        this.archive = archive;
        this.flags = localFileHeader.flags;
        this.compressionMethod = localFileHeader.compressionMethod;
        this.crc32 = localFileHeader.crc32;
        this.compressedSize = localFileHeader.compressedSize;
        this.uncompressedSize = localFileHeader.uncompressedSize;
        this.offset = offset;
    }

    uncompressedBlob: Blob | undefined;

    async init(): Promise<boolean> {
        const slice = this.archive.slice(this.offset, this.offset + this.compressedSize);

        // console.debug(`Decompressing "${this.name}" with method ${CompressionMethods[this.compressionMethod]} at a ${Math.floor(this.compressedSize / this.uncompressedSize * 100)}% compression ratio.`);

        switch(this.compressionMethod) {

            case CompressionMethods.store: {

                this.uncompressedBlob = slice;

                break; }

            case CompressionMethods.LZMA: {
                
                const buffer = await slice.arrayBuffer();

                const reader = new DataReader();
                reader.setType(DataReaderCommonTypes.Buffer);
                reader.loadData(buffer);

                const versionMajor: number = reader.read('Uint8');
                const versionMinor: number = reader.read('Uint8');
                const propsLength: number = reader.read('Uint16');

                const props: ArrayBuffer = reader.read('Buffer', propsLength);

                const uncompressed = LZMA.decompress(
                    buffer.slice(reader.pointer),
                    LZMA.decodeLZMAProperties(props),
                    this.uncompressedSize
                );

                this.uncompressedBlob = new Blob([ uncompressed ]);

                break; }

            case CompressionMethods.deflate: {

                const buffer = await slice.arrayBuffer();

                const uncompressed = Pako.inflate(buffer);

                this.uncompressedBlob = new Blob([ uncompressed ]);

                break; }

        }

        if(this.uncompressedBlob === undefined) {
            console.warn('ZipFile.getUncompressed: Could not decompress file.', this);
            return false;
        }

        return true;
    }

}





enum Chunks {
    EndOfCentralDirectoryRecord = 0x06054B50,
    CentralDirectoryHeader      = 0x02014B50,
    DigitalSignature            = 0x05054B50,
    LocalFileHeader             = 0x04034B50,
    DataDescriptor              = 0x08074B50
}



async function locateEndOfCentralDirectoryRecord(archive: FileBase): Promise<number | -1> {

    const START_SIZE = 128;
    const MAX_SIZE = 65536 + 22; // Max comment length + End of central directory record length.

    const scans = [
        archive.slice(Math.max(0, archive.size - START_SIZE), archive.size),
        archive.slice(Math.max(0, archive.size - MAX_SIZE), archive.size)
    ];

    for(const scan of scans) {

        const dv = new DataView(await scan.arrayBuffer());

        for(let i = dv.byteLength-4; i > 0; i--) {

            if(dv.getUint32(i, true) === Chunks.EndOfCentralDirectoryRecord) {
                return archive.size - scan.size + i;
            }

        }

    }

    return -1;

}



class ZipDirectory extends DirEntry implements DirectoryBase {



    archive: FileBase;

    isInitialized: boolean = false;



    constructor(archive: FileBase, name: string = 'NOT_SET', parent: DirectoryBase | null = null) {
        super(name, parent);

        this.archive = archive;
    }



    entries: Map<string, ZipFile> = new Map();



    async init() {
        if(this.isInitialized) return;
        this.isInitialized = true;



        await this.archive.init();



        const reader = new DataReader();
        reader.setType(ZIP_READERS);
        
        let offset: number = 0;
        const getBlob = (size: number) => {
            const blob = this.archive.slice(offset, offset + size);
            offset += size;
            return blob;
        }
        async function load(size: number) {
            reader.loadData(await getBlob(size).arrayBuffer());
        }



        offset = await locateEndOfCentralDirectoryRecord(this.archive);

        // Some very old zips don't have end of central directory record.
        // So as a TODO just locate all central directory headers instead.
        if(offset == -1) {
            throw new Error('ZipDirectory.init: Could not locate end of central directory record.');
        }

        await load(22);
        const endOfCentralDirectoryRecord: EndOfCentralDirectoryRecord = reader.read('EndOfCentralDirectoryRecord');
        await load(endOfCentralDirectoryRecord.commentLength);
        reader.read('EndOfCentralDirectoryRecordVariableLength', endOfCentralDirectoryRecord);



        offset = endOfCentralDirectoryRecord.centralDirectoryOffset;
        await load(endOfCentralDirectoryRecord.centralDirectorySize);

        let centralDirectoryHeaders: CentralDirectoryHeader[] = [];

        while(!reader.eof) {

            const centralDirectoryHeader: CentralDirectoryHeader = reader.read('CentralDirectoryHeader');

            centralDirectoryHeaders.push(centralDirectoryHeader);

        }



        for(const centralDirectoryHeader of centralDirectoryHeaders) {

            offset = centralDirectoryHeader.localHeaderOffset;
            await load(30);

            const localFileHeader: LocalFileHeader = reader.read('LocalFileHeader');
            await load(localFileHeader.fileNameLength + localFileHeader.extraFieldLength);
            reader.read('LocalFileHeaderVariableLength', localFileHeader);

            // TODO: Encryption check.

            const path = fixPath(localFileHeader.fileName);

            const file = new ZipFile(this.archive, localFileHeader, offset);

            this.entries.set(path, file);

        }



        

    }
    


    readonly type = DirType.Directory;

    async getFile(path: string): Promise<FileBase | undefined> {
        await this.init();

        path = fixPath(path);

        return this.entries.get(path);
    }

    async getFiles(path: string): Promise<FileBase[]> {
        await this.init();
        throw new Error("Method not implemented.");
    }
    
    async getDir(path: string): Promise<DirectoryBase | undefined> {
        await this.init();
        throw new Error("Method not implemented.");
    }

    async getDirs(path: string): Promise<DirectoryBase[]> {
        await this.init();
        throw new Error("Method not implemented.");
    }

}



type EndOfCentralDirectoryRecord = {
    disk: number;
    diskWithStart: number;
    numEntriesOnThisDisk: number;
    numEntries: number;
    centralDirectorySize: number;
    centralDirectoryOffset: number;
    commentLength: number;
    comment: string;
}



type CentralDirectoryHeader = {
    versionMadeBy: number;
    versionNeeded: number;
    flags: number;
    compressionMethod: CompressionMethods;
    modificationDateRaw: number;
    crc32: number;
    compressedSize: number;
    uncompressedSize: number;
    fileName: string;
    extraField: ArrayBuffer;
    fileComment: string;
    diskNumStart: number;
    internalFileAttributes: number;
    externalAttributes: number;
    localHeaderOffset: number;
}



type LocalFileHeader = {
    versionNeeded: number;
    flags: number;
    compressionMethod: number;
    modificationDateRaw: number;
    crc32: number;
    compressedSize: number;
    uncompressedSize: number;
    fileNameLength: number;
    extraFieldLength: number;
    fileName: string;
    extraField: ArrayBuffer;
}



const ZIP_READERS = {

    'String': DataReaderCommonTypes.String,
    'Buffer': DataReaderCommonTypes.Buffer,



    'EndOfCentralDirectoryRecord': function EndOfCentralDirectoryRecord(reader): EndOfCentralDirectoryRecord {

        if(reader.read('Uint32') != Chunks.EndOfCentralDirectoryRecord) {
            throw new Error('Invalid end of central directory record identifier.');
        }

        // @ts-ignore
        return {
            disk: reader.read('Uint16'),
            diskWithStart: reader.read('Uint16'),
            numEntriesOnThisDisk: reader.read('Uint16'),
            numEntries: reader.read('Uint16'),
            centralDirectorySize: reader.read('Uint32'),
            centralDirectoryOffset: reader.read('Uint32'),
            commentLength: reader.read('Uint16'),
        }

    } as ReaderCustomType,

    'EndOfCentralDirectoryRecordVariableLength': function EndOfCentralDirectoryRecordVariableLength(reader, endOfCentralDirectoryRecord: EndOfCentralDirectoryRecord) {

        endOfCentralDirectoryRecord.comment = reader.read('String', endOfCentralDirectoryRecord.commentLength);

    } as ReaderCustomType,

    'CentralDirectoryHeader': function CentralDirectoryHeader(reader): CentralDirectoryHeader {
        
        if(reader.read('Uint32') != Chunks.CentralDirectoryHeader) {
            throw new Error('Invalid central directory header identifier.');
        }

        // @ts-ignore
        const header: CentralDirectoryHeader = {
            versionMadeBy: reader.read('Uint16'),
            versionNeeded: reader.read('Uint16'),
            flags: reader.read('Uint16'),
            compressionMethod: reader.read('Uint16'),
            modificationDateRaw: reader.read('Uint32'),
            crc32: reader.read('Uint32'),
            compressedSize: reader.read('Uint32'),
            uncompressedSize: reader.read('Uint32')
        }

        const fileNameLength = reader.read('Uint16');
        const extraFieldLength = reader.read('Uint16');
        const fileCommentLength = reader.read('Uint16');

        header.diskNumStart = reader.read('Uint16');
        header.internalFileAttributes = reader.read('Uint16');
        header.externalAttributes = reader.read('Uint32');
        header.localHeaderOffset = reader.read('Uint32');

        header.fileName = reader.read('String', fileNameLength);
        header.extraField = reader.read('Buffer', extraFieldLength);
        header.fileComment = reader.read('String', fileCommentLength);

        return header;

    } as ReaderCustomType,

    'LocalFileHeader': function LocalFileHeader(reader): LocalFileHeader {

        if(reader.read('Uint32') != Chunks.LocalFileHeader) {
            throw new Error('Invalid local file header indentifier.');
        }

        // @ts-ignore
        return {
            versionNeeded: reader.read('Uint16'),
            flags: reader.read('Uint16'),
            compressionMethod: reader.read('Uint16'),
            modificationDateRaw: reader.read('Uint32'),
            crc32: reader.read('Uint32'),
            compressedSize: reader.read('Uint32'),
            uncompressedSize: reader.read('Uint32'),
            fileNameLength: reader.read('Uint16'),
            extraFieldLength: reader.read('Uint16')
        }

    } as ReaderCustomType,

    'LocalFileHeaderVariableLength': function LocalFileHeaderVariableLength(reader, localFileHeader: LocalFileHeader) {

        localFileHeader.fileName = reader.read('String', localFileHeader.fileNameLength);
        localFileHeader.extraField = reader.read('Buffer', localFileHeader.extraFieldLength);

    } as ReaderCustomType

}



export { ZipDirectory };
