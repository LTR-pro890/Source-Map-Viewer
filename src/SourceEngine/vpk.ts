
import { DataReader, ReaderCustomType } from "../common/DataReader";
import { DataReaderCommonTypes } from "../common/DataReaderCommonTypes";
import { DirEntry, DirFile, DirType, DirectoryBase, FILEPATH_SLASH_REGEX, FileBase, fixPath } from "../common/Directory";
import { Utils } from "../common/Utils";



const MULTI_VPK_REGEX = /(_dir.vpk)|(_\d\d\d.vpk)$/;
const VPK_KEY_REGEX = /_((?:dir)|(?:\d\d\d)).vpk$/



type VPKEntry = {
    crc: number;
    preloadBytes: number;
    archiveIndex: number;
    entryOffset: number;
    entryLength: number;
    preload: ArrayBuffer;
}



class VPK extends DirEntry implements DirectoryBase {
    readonly type = DirType.Directory;



    vpkFile: FileBase;
    vpks?: {[key: string]: FileBase};
    vpkEntries: Map<string, VPKEntry> = new Map();

    constructor(vpkFile: FileBase, parent: DirectoryBase | null = null) {
        super(vpkFile.name, parent);
        this.vpkFile = vpkFile;
    }



    /**
     * Get all vpk files for the vpk directory.  
     * 
     * ```TypeScript
     * textures_dir.vpk -> {
     *     dir: textures_dir.vpk,
     *     0: textures_000.vpk,
     *     1: textures_001.vpk,
     *     2: textures_002.vpk
     * }
     * ```
     */
    static async resolveVPKs(vpkFile: FileBase): Promise<{[key: string]: FileBase}> {

        if(!vpkFile.name.endsWith('.vpk')) {
            throw new Error(`VPK.resolveVPKs: Not a .vpk file! ${vpkFile.name}`);
        }

        if(MULTI_VPK_REGEX.test(vpkFile.name)) {

            const vpksDir = vpkFile.parent;

            if(vpksDir == undefined) {
                throw new Error(`VPK.resolveVPKs: .vpk that has multiple .vpks doesn't have parent directory.`);
            }

            const vpksName = vpkFile.name.replace(MULTI_VPK_REGEX, '');

            const vpks: {[key: string]: FileBase} = {};

            (await vpksDir.getFiles(`${vpksName}_*.vpk`)).forEach(file => {

                const indexStr = file.name.match(VPK_KEY_REGEX)?.[1];
                if(indexStr === undefined) return;

                if(Number.isNaN(parseInt(indexStr))) {
                    vpks[indexStr] = file;
                } else {
                    const index = parseInt(indexStr);
                    vpks[index] = file;
                }

            });

            return vpks;

        } else {

            return { 0: vpkFile };

        }

    }



    async init(): Promise<boolean> {

        this.vpks = await VPK.resolveVPKs(this.vpkFile);



        const mainVPK = this.vpks['dir'] || this.vpks[0];
        if(mainVPK === undefined) {
            console.error('VPK.init: Invalid dir vpk.');
            return false;
        }



        for(const vpk in this.vpks) {
            if(!(await this.vpks[vpk].init())) {
                console.error(`VPK.init: could not load vpk_${vpk} file.`);
                return false;
            }
        }



        const reader = new DataReader();
        reader.setType(DataReaderCommonTypes);
        // 12 or 28
        reader.loadData(await mainVPK.slice(0, 28).arrayBuffer());



        if(reader.read('Uint32') != 0x55AA1234) {
            console.error('VPK.init: Invalid signature.');
            return false;
        }

        const version = reader.read('Uint32');

        const treeSize = reader.read('Uint32');

        if(version == 1) {

            reader.loadData(await mainVPK.slice(12, 12 + treeSize).arrayBuffer());

        } else if(version == 2) {

            // Other information like file data size and checksums.

            reader.loadData(await mainVPK.slice(28, 28 + treeSize).arrayBuffer());

        } else {

            console.error('VPK.init: Invalid dir vpk header version.');
            return false;
            
        }



        reader.setType(function VPKEntry(reader): VPKEntry | undefined {
            // @ts-ignore
            const entry: VPKEntry = {
                crc: reader.read('Uint32'),
                preloadBytes: reader.read('Uint16'),
                archiveIndex: reader.read('Uint16'),
                entryOffset: reader.read('Uint32'),
                entryLength: reader.read('Uint32')
            }

            if(reader.read('Uint16') != 0xFFFF) {
                console.error('VPK.init: Invalid VPK entry terminator.');
                return undefined;
            }

            entry.preload = reader.read('Buffer', entry.preloadBytes);

            return entry;
        } as ReaderCustomType)



        while(true) {
            const extension: string = reader.read('NullString');
            if(extension.length == 0) break;

            while(true) {
                const path: string = reader.read('NullString');
                if(path.length == 0) break;

                while(true) {
                    const name: string = reader.read('NullString');
                    if(name.length == 0) break;

                    const entry: VPKEntry | undefined = reader.read('VPKEntry');

                    if(entry === undefined) {
                        return false;
                    }

                    this.vpkEntries.set(fixPath(`${path}\\${name}.${extension}`), entry);
                }
            }
        }



        return true;

    }
    


    constructFile(path: string): FileBase | undefined {
        if(this.vpks === undefined) {
            throw new Error('VPK.constructFile: Must init vpk before accessing files.');
        }

        const entry = this.vpkEntries.get(path);
        if(entry === undefined) return;
        
        const vpk = this.vpks[entry.archiveIndex == 0x7FFF ? 'dir' : entry.archiveIndex];
        if(vpk === undefined) {
            throw new Error('VPK.getFile: Invalid vpk archive index.');
        }

        let blob = new Blob([ entry.preload, vpk.slice(entry.entryOffset, entry.entryOffset + entry.entryLength) ]);

        const file = new DirFile(path, blob, null);
        return file;
    }

    
    async getFile(path: string): Promise<FileBase | undefined> {
        path = fixPath(path);
        return this.constructFile(path);
    }
    getFiles(path: string): Promise<FileBase[]> {
        throw new Error("Method not implemented.");
    }
    getDir(path: string): Promise<DirectoryBase | undefined> {
        throw new Error("Method not implemented.");
    }
    getDirs(path: string): Promise<DirectoryBase[]> {
        throw new Error("Method not implemented.");
    }


}



export { VPK };
