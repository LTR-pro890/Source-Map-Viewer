
import { StringUtils } from "./StringUtils";



const FILEPATH_SLASH_REGEX: RegExp = /[\\/]/g;



function fixPath(path: string): string {
    path = path.replace(/\//g, '\\');
    if(path.startsWith('\\')) {
        path = path.slice(1);
    }
    return path;
}



enum DirType {
    /**
     * Unknown entry; Should throw error whenever is seen.
     */
    Unknown,
    /**
     * ALL entries that use this type HAVE to have standard Blob implementations.
     * Except for type, Use common/MimeTypes to derive mimetype from file.
     */
    File,
    /**
     * Directory entry; Has sub directories or files.
     */
    Directory
}





/****************************************************/
/* DirEntry that all directory types should inherit */
/****************************************************/

class DirEntry {

    readonly type: DirType = DirType.Unknown;

    parent: DirectoryBase | null = null;

    get ROOT(): DirEntry {
        return (this.parent !== null ? this.parent.ROOT : this);
    }

    name: string;

    get path(): string {
        return (this.parent !== null ? `${this.parent.path}\\${this.name}` : this.name);
    }

    constructor(name: string = 'NOT_SET', parent: DirectoryBase | null = null) {
        this.name = name;
        this.parent = parent;
    }

}





/************************************/
/* DirEntry that holds file content */
/************************************/

interface FileBase extends DirEntry {
    readonly type: DirType.File;

    init(): Promise<boolean>;

    get size(): number;
    arrayBuffer(): Promise<ArrayBuffer>;
    slice(start?: number | undefined, end?: number | undefined): Blob;
    stream(): ReadableStream<Uint8Array>;
    text(): Promise<string>;
}



class DirFile extends DirEntry implements FileBase {
    readonly type = DirType.File;



    blob: Blob;

    constructor(name: string, blob: Blob, parent: DirectoryBase | null = null) {
        super(name.split(FILEPATH_SLASH_REGEX).pop(), parent);

        this.blob = blob;
    }

    async init(): Promise<boolean> {
        return true;
    }

    /********************************/
    /* DirFile Blob Implementations */
    /********************************/

    get size(): number {
        return this.blob.size;
    }

    async arrayBuffer() {
        return await this.blob.arrayBuffer();
    }

    slice(start?: number | undefined, end?: number | undefined) {
        return this.blob.slice(start, end);
    }

    stream() {
        return this.blob.stream();
    }

    async text() {
        return await this.blob.text();
    }

}





/*************************************************/
/* Directory that holds sub directories or files */
/*************************************************/

interface DirectoryBase extends DirEntry {
    readonly type: DirType.Directory;

    /**
     * Get file at location. (E.g. 'configs\\patch.txt')  
     */
    getFile(path: string): Promise<FileBase | undefined>;
    /**
     * Get files at location with wildcard. (E.g. 'configs\\*.txt')  
     */
    getFiles(path: string): Promise<FileBase[]>;
    /**
     * Get directory at location. (E.g. 'addons\\potato\\')  
     */
    getDir(path: string): Promise<DirectoryBase | undefined>;
    /**
     * Get directories at location with wildcard. (E.g. 'addons\\*\\')  
     */
    getDirs(path: string): Promise<DirectoryBase[]>;
}



class Directory extends DirEntry implements DirectoryBase {
    readonly type = DirType.Directory;

    constructor(name: string = 'ROOT', parent: DirectoryBase | null = null) {
        super(name, parent);
    }

    files: {[key: string]: FileBase} = {};
    dirs: {[key: string]: DirectoryBase} = {};

    async getFile(path: string): Promise<FileBase | undefined> {

        const split = path.split(FILEPATH_SLASH_REGEX);

        const first = split.shift();
        if(first === undefined) return undefined;

        if(split.length == 0) {

            return this.files[first];

        } else {

            return await this.dirs[first]?.getFile(split.join('\\'));

        }

    }

    async getFiles(path: string): Promise<FileBase[]> {

        const split = path.split(FILEPATH_SLASH_REGEX);

        const first = split.shift();
        if(first === undefined) return [];

        let entries = [];

        for(let key in this.files) {
            if(!StringUtils.wildcardMatches(key, first)) continue;

            entries.push(this.files[key]);
        }

        const joined = split.join('\\');

        for(let key in this.dirs) {
            if(!StringUtils.wildcardMatches(key, first)) continue;

            entries.push(...(await this.dirs[key].getFiles(joined)));
        }

        return entries;

    }

    async getDir(path: string): Promise<DirectoryBase | undefined> {

        const split = path.split(FILEPATH_SLASH_REGEX);

        const first = split.shift();
        if(first === undefined) return undefined;

        if(split.length == 0) {

            return this.dirs[first];

        } else {

            return await this.dirs[first]?.getDir(split.join('\\'));

        }

    }

    async getDirs(path: string): Promise<DirectoryBase[]> {
        throw new Error("Method not implemented.");
    }

    /**
     * Set file in directory.  
     */
    async setFile(path: string, file: FileBase): Promise<void> {

        const split = path.split(FILEPATH_SLASH_REGEX);

        const first = split.shift();
        if(first === undefined) return;

        if(split.length == 0) {

            file.parent = this;
            this.files[first] = file;

        } else {

            if(this.dirs[first] === undefined) {
                this.dirs[first] = new Directory(first, this);
            }

            if(this.dirs[first] instanceof Directory) {
                // @ts-ignore
                this.dirs[first].setFile(split.join('\\'), file);
            } else {
                throw new Error('Directory.setFile: Mixed directory types.');
            }
            
        }

    }
    
}





/*****************************************************************************/
/* TransferDirectory is a directory for DataTransfer from drag & drop files. */
/*****************************************************************************/



function fileSystemDirectoryGetEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {

    return new Promise(async (resolve, reject) => {

        const reader = entry.createReader();

        let entries: FileSystemEntry[] = [];

        let readCount = 0;

        do {
            let read: FileSystemEntry[] = [];

            try {
                read = await new Promise((res: FileSystemEntriesCallback, rej: ErrorCallback ) => {
                    reader.readEntries(res, rej);
                });
            } catch(err) {
                reject(err);
            }

            readCount = read.length;
            entries = entries.concat(read);

        } while(readCount > 0);

        resolve(entries);

    });

}

function fileSystemFileGetFile(entry: FileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
}



class TransferDirectory extends Directory {

    transfers?: FileSystemEntry[];

    isDiscovered: boolean = false;

    async discover() {

        if(this.isDiscovered) return;
        if(!this.transfers) return;

        for(const transfer of this.transfers) {

            if(transfer.isDirectory) {

                // @ts-ignore // FileSystemDirectoryEntry doesn't exist.  
                this.dirs[transfer.name] = new TransferDirectory(await fileSystemDirectoryGetEntries(transfer), transfer.name, this);

            } else {

                // @ts-ignore // FileSystemFileEntry doesn't exist.  
                this.files[transfer.name] = new DirFile(transfer.name, await fileSystemFileGetFile(transfer), this);

            }

        }

        // May save memory?
        delete this.transfers;

        this.isDiscovered = true;

    }

    async discoverAll() {

        await this.discover();

        for(const key in this.dirs) {
            const dir = this.dirs[key];
            if(dir instanceof TransferDirectory) {
                await dir.discoverAll();
            }
        }

    }

    readonly type = DirType.Directory;

    constructor(transfer: DataTransfer | FileSystemEntry[], name: string = 'ROOT', parent: DirectoryBase | null = null) {
        super(name, parent);

        if(transfer instanceof DataTransfer) {

            // @ts-ignore // Todo figure out how to not use @ts-ignore here.
            this.transfers = Array.from(transfer.items).map(item => item.webkitGetAsEntry()).filter(item => item !== null);

        } else {

            this.transfers = transfer;

        }
    }

    async getFile(path: string): Promise<FileBase | undefined> {
        await this.discover();
        return await super.getFile(path);
    }

    async getFiles(path: string): Promise<FileBase[]> {
        await this.discover();
        return await super.getFiles(path);
    }

    async getDir(path: string): Promise<DirectoryBase | undefined> {
        await this.discover();
        return await super.getDir(path);
    }

    async getDirs(path: string): Promise<DirectoryBase[]> {
        await this.discover();
        return await super.getDirs(path);
    }

}





export { FileBase, DirectoryBase, DirType, DirEntry, DirFile, Directory, TransferDirectory, fixPath, FILEPATH_SLASH_REGEX };
