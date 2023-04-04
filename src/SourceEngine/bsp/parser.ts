
import { DataReader, ReaderCustomType } from "../../common/DataReader";
import { DirFile, FileBase } from "../../common/Directory";
import { Utils } from "../../common/Utils";
import * as BSP_Types from "./types";
import { decodeLZMAProperties, decompress } from "../../common/codecs/lzma";
import { DataReaderCommonTypes } from "../../common/DataReaderCommonTypes";
import * as THREE from 'three';
import { ZipDirectory } from "../../common/ZipDirectory";



function decompressLZMA(compressedData: ArrayBuffer, uncompressedSize: number): ArrayBuffer {
    const compressedView = new DataView(Utils.getBuffer(compressedData));

    // Parse Valve's lzma_header_t.
    // Utils.assert(readString(compressedData, 0x00, 0x04) === 'LZMA');
    const actualSize = compressedView.getUint32(0x04, true);
    Utils.assert(actualSize === uncompressedSize);
    const lzmaSize = compressedView.getUint32(0x08, true);
    Utils.assert(lzmaSize + 0x11 <= compressedData.byteLength);

    const lzmaProperties = decodeLZMAProperties(compressedData.slice(0x0C));
    const uncompressed = decompress(compressedData.slice(0x11), lzmaProperties, actualSize);

    Utils.assert(actualSize === uncompressed.byteLength);

    return uncompressed;
}



const HEADER_LUMPS = 64;

/**
 * If all is 0 then Lump doesn't exist in .bsp.
 */
type Lump = {
    offset: number;
    length: number;
    version: number;
    /** If lump is already uncompressed this is 0 */
    uncompressedLength: number;
}

enum Lumps {
    ENTITIES = 0,
    PLANES = 1,
    TEXDATA = 2,
    VERTEXES = 3,
    VISIBILITY = 4,
    NODES = 5,
    TEXINFO = 6,
    FACES = 7,
    LIGHTING = 8,
    OCCLUSION = 9,
    LEAFS = 10,
    FACEIDS = 11,
    EDGES = 12,
    SURFEDGES = 13,
    MODELS = 14,
    WORLDLIGHTS = 15,
    LEAFFACES = 16,
    LEAFBRUSHES = 17,
    BRUSHES = 18,
    BRUSHSIDES = 19,
    AREAS = 20,
    AREAPORTALS = 21,
    PORTALS = 22,
    UNUSED0 = 22,
    PROPCOLLISION = 22,
    CLUSTERS = 23,
    UNUSED1 = 23,
    PROPHULLS = 23,
    PORTALVERTS = 24,
    UNUSED2 = 24,
    PROPHULLVERTS = 24,
    CLUSTERPORTALS = 25,
    UNUSED3 = 25,
    PROPTRIS = 25,
    DISPINFO = 26,
    ORIGINALFACES = 27,
    PHYSDISP = 28,
    PHYSCOLLIDE = 29,
    VERTNORMALS = 30,
    VERTNORMALINDICES = 31,
    DISP_LIGHTMAP_ALPHAS = 32,
    DISP_VERTS = 33,
    DISP_LIGHTMAP_SAMPLE_POSITIONS = 34,
    GAME_LUMP = 35,
    LEAFWATERDATA = 36,
    PRIMITIVES = 37,
    PRIMVERTS = 38,
    PRIMINDICES = 39,
    PAKFILE = 40,
    CLIPPORTALVERTS = 41,
    CUBEMAPS = 42,
    TEXDATA_STRING_DATA = 43,
    TEXDATA_STRING_TABLE = 44,
    OVERLAYS = 45,
    LEAFMINDISTTOWATER = 46,
    FACE_MACRO_TEXTURE_INFO = 47,
    DISP_TRIS = 48,
    PHYSCOLLIDESURFACE = 49,
    PROP_BLOB = 49,
    WATEROVERLAYS = 50,
    LIGHTMAPPAGES = 51,
    LEAF_AMBIENT_INDEX_HDR = 51,
    LIGHTMAPPAGEINFOS = 52,
    LEAF_AMBIENT_INDEX = 52,
    LIGHTING_HDR = 53,
    WORLDLIGHTS_HDR = 54,
    LEAF_AMBIENT_LIGHTING_HDR = 55,
    LEAF_AMBIENT_LIGHTING = 56,
    XZIPPAKFILE = 57,
    FACES_HDR = 58,
    MAP_FLAGS = 59,
    OVERLAY_FADES = 60,
    OVERLAY_SYSTEM_LEVELS = 61,
    PHYSLEVEL = 62,
    DISP_MULTIBEND = 63
}

interface LumpTypes {
    [Lumps.ENTITIES]: string; // TODO
    [Lumps.PLANES]: BSP_Types.Plane[];
    [Lumps.VERTEXES]: BSP_Types.Vertex[];
    [Lumps.EDGES]: BSP_Types.Edge[];
    [Lumps.SURFEDGES]: BSP_Types.Surfedge[];
    [Lumps.FACES]: BSP_Types.Face[];
    [Lumps.TEXINFO]: BSP_Types.TexInfo[];
    [Lumps.TEXDATA]: BSP_Types.TexData[];
    [Lumps.DISPINFO]: BSP_Types.DispInfo[];
    [Lumps.DISP_VERTS]: BSP_Types.DispVert[];
    [Lumps.TEXDATA_STRING_TABLE]: BSP_Types.TexDataStringTable[];
    [Lumps.TEXDATA_STRING_DATA]: BSP_Types.TexDataStringData[];
    // [Lumps.LIGHTING]: BSP_Types.ColorRGBExp[];
    [Lumps.LIGHTING]: Uint8Array;
    [Lumps.PAKFILE]: ZipDirectory;
}



class BSP_Parser {

    file: FileBase;
    constructor(file: FileBase) {
        this.file = file;
    }



    /** BSP version */
    version: number = -1;

    lumps: Lump[] = [];

    /** Map Revision (Num times compiled?) */
    revision: number = -1;



    async init() {

        Utils.assert(await this.file.init(), 'BSP_Parser.init: Could not load .bsp file.');



        const reader = new DataReader();
        reader.setType([ DataReaderCommonTypes.String, DataReaderCommonTypes.Array, PARSER_READERS.Lump ]);

        // Read BSP header
        reader.loadData(await this.file.slice(0, 12 + 16 * HEADER_LUMPS).arrayBuffer());

        Utils.assert(reader.read('String', 4) == 'VBSP', 'BSP_Parser.init: Invalid .bsp file identification.');

        this.version = reader.read('Uint32');

        this.lumps = reader.read('Array', 'Lump', HEADER_LUMPS);

        this.revision = reader.read('Uint32');

    }



    static lumpName(index: number): string {
        return Lumps[index];
    }

    lumpExists(index: number): boolean {
        if(index < 0 || index >= HEADER_LUMPS) return false;
        const lump = this.lumps[index];
        if(lump.length != 0) return true;
        if(lump.offset != 0) return true;
        return false;
    }

    async getLumpRawData(index: number): Promise<ArrayBuffer> {
        if(!this.lumpExists(index)) return new ArrayBuffer(0);

        const lump = this.lumps[index];

        const buffer = await this.file.slice(lump.offset, lump.offset + lump.length).arrayBuffer();



        if(lump.uncompressedLength === 0) {
            return buffer;
        }



        return decompressLZMA(buffer, lump.uncompressedLength);

    }

    async getLumpBlob(index: number): Promise<Blob> {
        if(!this.lumpExists(index)) return new Blob([ ]);

        const lump = this.lumps[index];

        const slice = this.file.slice(lump.offset, lump.offset + lump.length);

        if(lump.uncompressedLength === 0) {
            return slice;
        }



        const uncompressed = decompressLZMA(await slice.arrayBuffer(), lump.uncompressedLength);

        return new Blob([  uncompressed ]);

    }

    async getParsedLump<K extends keyof LumpTypes>(type: K): Promise<LumpTypes[K] | null> {
        if(!this.lumpExists(type)) {
            console.warn(`Cannot access lump ${BSP_Parser.lumpName(type)}`);
            return null;
        }

        if(type == Lumps.PAKFILE) {

            const zipFile = new DirFile(
                `${this.file.name}.zip`,
                await this.getLumpBlob(type)
            );

            const zip = new ZipDirectory(zipFile);

            await zip.init();

            // @ts-ignore
            return zip;
            // I have no clue why I need this. . .

        }

        const reader = new DataReader();
        reader.loadData(await this.getLumpRawData(type));
        reader.setType(PARSER_READERS);

        switch(type) {

            case Lumps.ENTITIES: {
                // TODO
                const string = reader.read('String', reader.length, 'ascii');
                return string;
                break; }

            case Lumps.VERTEXES: {
                const count = reader.length / 12;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'Vector', count);
                break; }

            case Lumps.EDGES: {
                const count = reader.length / 4;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'Array', count, 'Uint16', 2);
                break; }

            case Lumps.SURFEDGES: {
                const count = reader.length / 4;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'Int32', count);
                break; }

            case Lumps.FACES: {
                const count = reader.length / 56;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'Face', count);
                break; }

            case Lumps.TEXINFO: {
                const count = reader.length / 72;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'TexInfo', count);
                break; }

            case Lumps.TEXDATA: {
                const count = reader.length / 32;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'TexData', count);
                break; }

            case Lumps.TEXDATA_STRING_TABLE: {
                const count = reader.length / 4;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'Uint32', count);
                break; }

            case Lumps.TEXDATA_STRING_DATA: {
                const offsets = await this.getParsedLump(Lumps.TEXDATA_STRING_TABLE);
                if(offsets === null) return null;

                let strings: BSP_Types.TexDataStringData[] = [];
                for(let i=0; i < offsets.length; i++) {
                    reader.pointer = offsets[i];
                    strings[i] = reader.read('NullString');
                }
                // @ts-ignore
                return strings;
                break; }

            case Lumps.DISPINFO: {
                const count = reader.length / 176;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'DispInfo', count);
                break; }

            case Lumps.DISP_VERTS: {
                const count = reader.length / 20;
                Utils.assert(Number.isInteger(count));
                return reader.read('Array', 'DispVert', count);
                break; }

            case Lumps.LIGHTING: {
                // @ts-ignore WHY DO I NEED THIS HERE?????????
                return new Uint8Array(reader.buffer);
                break; }

        }

        return null;

    }


}



const PARSER_READERS = {

    'String': DataReaderCommonTypes.String,
    'NullString': DataReaderCommonTypes.NullString,
    'Array': DataReaderCommonTypes.Array,
    'PadStart': DataReaderCommonTypes.PadStart,

    'Lump': function Lump(reader): Lump {
        return {
            offset: reader.read('Uint32'),
            length: reader.read('Uint32'),
            version: reader.read('Uint32'),
            uncompressedLength: reader.read('Uint32')
        }
    } as ReaderCustomType,

    'Vector': function Vector(reader): THREE.Vector3 {
        return new THREE.Vector3(
            reader.read('Float32'),
            reader.read('Float32'),
            reader.read('Float32')
        );
    } as ReaderCustomType,

    'Color': function Color(reader): THREE.Color {
        return new THREE.Color(
            reader.read('Float32'),
            reader.read('Float32'),
            reader.read('Float32')
        );
    } as ReaderCustomType,

    'Face': function Face(reader): BSP_Types.Face {
        return {
            planeNum: reader.read('Uint16'),
            side: reader.read('Uint8'),
            onNode: reader.read('Uint8') == 1,
            firstEdge: reader.read('Uint32'),
            numEdges: reader.read('Uint16'),
            texInfo: reader.read('Int16'),
            dispInfo: reader.read('Int16'),
            surfaceFogVolumeID: reader.read('Uint16'),
            styles: reader.read('Array', 'Uint8', 4),
            lightOffset: reader.read('Int32'),
            area: reader.read('Float32'),
            lightmapTextureMinsInLuxels: [ reader.read('Int32'), reader.read('Int32') ],
            lightmapTextureSizeInLuxels: [ reader.read('Uint32'), reader.read('Uint32') ],
            origFace: reader.read('Int32'),
            numPrimitives: reader.read('Uint16'),
            firstPrimitiveID: reader.read('Uint16'),
            smoothingGroups: reader.read('Uint32')
        }
    } as ReaderCustomType,

    'TexInfo': function TexInfo(reader): BSP_Types.TexInfo {
        return {
            textureVecs: reader.read('Array', 'Array', 2, 'Float32', 4),
            lightmapVecs: reader.read('Array', 'Array', 2, 'Float32', 4),
            flags: reader.read('Uint32'),
            texData: reader.read('Uint32')
        }
    } as ReaderCustomType,

    'TexData': function TexData(reader): BSP_Types.TexData {
        return {
            reflectivity: reader.read('Color'),
            nameStringTableID: reader.read('Uint32'),
            width: reader.read('Uint32'),
            height: reader.read('Uint32'),
            view_width: reader.read('Uint32'),
            view_height: reader.read('Uint32')
        }
    } as ReaderCustomType,

    'DispSubNeighbor': function DispSubNeighbor(reader): BSP_Types.DispSubNeighbor {
        return {
            neighbor: reader.read('Uint16'),
            neighborOrientation: reader.read('Uint8'),
            span: reader.read('Uint8'),
            neighborSpan: reader.read('Uint8')
        }
    } as ReaderCustomType,

    'DispNeighbor': function DispNeighbor(reader): BSP_Types.DispNeighbor {
        return reader.read('Array', 'DispSubNeighbor', 2);
    } as ReaderCustomType,

    'DispCornerNeighbor': function DispCornerNeighbor(reader): BSP_Types.DispCornerNeighbor {
        return {
            neighbors: reader.read('Array', 'Int16', 4),
            numNeighbors: reader.read('Uint8')
        }
    } as ReaderCustomType,

    'DispInfo': function DispInfo(reader): BSP_Types.DispInfo {
        return {
            startPos: reader.read('Vector'),
            dispVertStart: reader.read('Uint32'),
            dispTriStart: reader.read('Uint32'),
            power: reader.read('Uint32'),
            minTess: reader.read('Uint32'),
            smoothingAngle: reader.read('Float32'),
            contents: reader.read('Uint32'),
            mapFace: reader.read('Uint16'),
            lightmapAlphaStart: reader.read('Uint32'),
            lightmapSamplePositionStart: reader.read('Uint32'),
            edgeNeighbors: reader.read('Array', 'DispNeighbor', 4),
            cornerNeighbors: reader.read('Array', 'DispCornerNeighbor', 4),
            allowedVerts: reader.read('PadStart', 14, 'Array', 'Uint32', 10)
        }
    } as ReaderCustomType,

    'DispVert': function DispVert(reader): BSP_Types.DispVert {
        return {
            vec: reader.read('Vector'),
            dist: reader.read('Float32'),
            alpha: reader.read('Float32')
        }
    } as ReaderCustomType,

    'ColorRGBExp': function ColorRGBExp(reader): BSP_Types.ColorRGBExp {
        return {
            r: reader.read('Uint8'),
            g: reader.read('Uint8'),
            b: reader.read('Uint8'),
            exp: reader.read('Int8')
        }
    } as ReaderCustomType

}



export { BSP_Parser, Lumps };
