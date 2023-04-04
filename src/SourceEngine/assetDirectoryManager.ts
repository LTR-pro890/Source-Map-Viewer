
import { DirEntry, DirFile, Directory, DirectoryBase, FileBase, TransferDirectory, fixPath } from "../common/Directory";
import { ObjectUtils } from "../common/ObjectUtils";
import { KeyValues } from "./keyvalues";
import { VPK } from "./vpk";



const GAMEINFOS: {[key: number]: string} = {
    440: 'tf\\gameinfo.txt'
}



type GameInfo = {
    game: string;
    type: 'multiplayer_only' | 'singleplayer_only' | undefined;
    FileSystem: {
        SteamAppId: number;
        SearchPaths: {[key: string]: string};
    };
}



async function locateAppIdFile(dir: DirectoryBase): Promise<FileBase | undefined> {
    const f1 = await dir.getFile('steam_appid.txt');
    if(!Array.isArray(f1) && f1 instanceof DirFile) return f1;

    const f2s = await dir.getFiles('*\\steam_appid.txt');
    if(Array.isArray(f2s) && f2s[0] instanceof DirFile) return f2s[0];

    return undefined;
}



class SourceAssetDirectoryManager {

    baseDir: DirectoryBase;

    constructor(baseDir: DirectoryBase) {
        this.baseDir = baseDir;
    }



    gameDir: DirectoryBase | undefined;
    gameInfo: GameInfo | undefined;
    directories: DirectoryBase[] = [];

    async init(): Promise<boolean> {

        const appIdFile = await locateAppIdFile(this.baseDir);
        if(appIdFile == undefined) {
            console.error('SourceAssetDirectoryManager.init: Could not find AppId file.');
            return false;
        }
        if(appIdFile.parent == null) {
            return false;
        }

        this.gameDir = appIdFile.parent;

        const appId = parseInt(await appIdFile.text());
        if(Number.isNaN(appId) || GAMEINFOS[appId] == undefined) {
            throw new Error('SourceAssetDirectoryManager.init: AppId invalid.');
        }

        const gameInfoFile = await this.gameDir.getFile(GAMEINFOS[appId]);
        if(gameInfoFile === undefined) {
            console.error('SourceAssetDirectoryManager.init: Could not find GameInfo file.');
            return false;
        }

        // @ts-ignore
        this.gameInfo = KeyValues.parse(await gameInfoFile.text())?.GameInfo;
        if(this.gameInfo === undefined) {
            console.error('SourceAssetDirectoryManager.init: Could not parse GameInfo file.');
            return false;
        }

        console.log(this.gameInfo);



        for(let [uses, path] of ObjectUtils.kvIter(this.gameInfo.FileSystem.SearchPaths)) {

            // Filter
            if(!uses.includes('game')) continue; // Disable non-game content.
            if(uses.includes('download')) continue; // Disable downloaded content.

            // Fix path
            path = path.replace('|all_source_engine_paths|', ''); // ???
            path = path.replace('|gameinfo_path|', gameInfoFile.path.split('\\').slice(0, -1).join('\\')); // Relative path to gameinfo.txt
            path = path.replace(/(?<!_dir)\.vpk/, '_dir.vpk'); // .vpks are to _dir.vpks

            if(path.includes('*')) {
                console.warn(`SourceAssetDirectoryManager.init: Wildcard for locating directories not supported yet. ${path}`);
                continue;
            }

            // Load content path into directories list
            if(path.endsWith('.vpk')) {

                const vpkFile = await this.gameDir.getFile(path);
                if(vpkFile === undefined) continue;

                const vpk = new VPK(vpkFile, vpkFile.parent);
                await vpk.init();

                this.directories.push(vpk);

            } else {

                const dir = await this.gameDir.getDir(path);
                if(dir === undefined) continue;

                this.directories.push(dir);

            }

        }


        
        return true;

    }



    async getFile(path: string): Promise<FileBase | undefined> {
        path = fixPath(path);

        for(const dir of this.directories) {
            const file = await dir.getFile(path);
            if(file === undefined) continue;
            return file;
        }

        return undefined;
    }

}



export { SourceAssetDirectoryManager };
