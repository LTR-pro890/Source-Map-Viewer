
import { DataReader } from "../common/DataReader";
import { DataReaderCommonTypes } from "../common/DataReaderCommonTypes";
import { FileBase } from "../common/Directory";
import * as THREE from 'three';
import { Utils } from "../common/Utils";





enum Resources {
    lowResImageData = '\x01\0\0',
    highResImageData = '\x30\0\0',
    animatedParticleSheet = '\x10\0\0',
    crc = 'CRC',
    LOD_Control = 'LOD',
    gameExtendedFlags = 'TSO',
    keyValues = 'KVD'
}



enum TextureFormat {
    NONE = -1,
    RGBA8888 = 0,
    ABGR8888 = 1,
    RGB888 = 2,
    BGR888 = 3,
    RGB565 = 4,
    I8 = 5,
    IA88 = 6,
    P8 = 7,
    A8 = 8,
    RGB888_BLUESCREEN = 9,
    BGR888_BLUESCREEN = 10,
    ARGB8888 = 11,
    BGRA8888 = 12,
    DXT1 = 13,
    DXT3 = 14,
    DXT5 = 15,
    BGRX8888 = 16,
    BGR565 = 17,
    BGRX5551 = 18,
    BGRA4444 = 19,
    DXT1_ONEBITALPHA = 20,
    BGRA5551 = 21,
    UV88 = 22,
    UVWQ8888 = 23,
    RGBA16161616F = 24,
    RGBA16161616 = 25,
    UVLX8888 = 26
}



enum TextureFlags {
    POINTSAMPLE =      0x00000001,
    TRILINEAR =        0x00000002,
    CLAMPS =           0x00000004,
    CLAMPT =           0x00000008,
    ANISOTROPIC =      0x00000010,
    HINT_DXT5 =        0x00000020,
    PWL_CORRECTED =    0x00000040,
    NORMAL =           0x00000080,
    NOMIP =            0x00000100,
    NOLOD =            0x00000200,
    ALL_MIPS =         0x00000400,
    PROCEDURAL =       0x00000800,
    ONEBITALPHA =      0x00001000,
    EIGHTBITALPHA =    0x00002000,
    ENVMAP =           0x00004000,
    RENDERTARGET =     0x00008000,
    DEPTHRENDERTARGET =0x00010000,
    NODEBUGOVERRIDE =  0x00020000,
    SINGLECOPY =       0x00040000,
    PRE_SRGB =         0x00080000,
    UNUSED_00100000 =  0x00100000,
    UNUSED_00200000 =  0x00200000,
    UNUSED_00400000 =  0x00400000,
    NODEPTHBUFFER =    0x00800000,
    UNUSED_01000000 =  0x01000000,
    CLAMPU =           0x02000000,
    VERTEXTEXTURE =    0x04000000,
    SSBUMP =           0x08000000,
    UNUSED_10000000 =  0x10000000,
    BORDER =           0x20000000,
    UNUSED_40000000 =  0x40000000,
    UNUSED_80000000 =  0x80000000
}



function bcNearestSize(size: number): number {
    if(size < 4) return 4;
    return Math.ceil(size / 4) * 4;
}



function getImageByteSize(format: TextureFormat, width: number, height: number): number {
    switch(format) {
        case TextureFormat.RGBA8888:
        case TextureFormat.BGRA8888:
            return width * height * 4;
        case TextureFormat.BGR888:
            return width * height * 3;
        case TextureFormat.DXT1:
        case TextureFormat.DXT1_ONEBITALPHA:
            return (bcNearestSize(width) * bcNearestSize(height)) / 2;
        case TextureFormat.DXT3:
        case TextureFormat.DXT5:
            return bcNearestSize(width) * bcNearestSize(height);
        default:
            throw new Error(`Unimplemented texture type. ${TextureFormat[format]}`);
    }
}



type forEachTextureCallbackfn = (mipmap: number, frame: number, face: number, slice: number, buffer: ArrayBuffer) => void;



class VTF {

    file: FileBase;

    constructor(file: FileBase) {
        this.file = file;
    }



    version?: [ number, number ];
    isAtleastVersion(major: number, minor: number): boolean {
        if(this.version === undefined) return false;
        if(major > this.version[0]) return false;
        if(major < this.version[0]) return true;
        if(minor > this.version[1]) return false;
        return true;
    }

    width: number = 0;
    height: number = 0;

    mipmaps: number = 0;
    frames: number = 0;
    faces: number = 0;
    slices: number = 0;

    format: TextureFormat = TextureFormat.NONE;

    firstFrame: number = 0;

    flags: number = 0;

    reflectivity: THREE.Color = new THREE.Color(0.0, 0.0, 0.0);

    bumpmapScale: number = 1;



    /** mipmap (Biggest to smallest) -> frame -> face -> slice */
    textures: ArrayBuffer[][][][] = [];



    async init(): Promise<boolean> {

        if(!await this.file.init()) {
            return false;
        }

        

        const reader = new DataReader();
        reader.setType(DataReaderCommonTypes);
        reader.loadData(await this.file.arrayBuffer());

        if(reader.read('String', 4) != 'VTF\x00') {
            console.error('VTF.load: Invalid signature.');
            return false;
        }



        this.version = [ reader.read('Uint32'), reader.read('Uint32') ];

        const headerSize: number = reader.read('Uint32');

        this.width = reader.read('Uint16');
        this.height = reader.read('Uint16');

        this.flags = reader.read('Uint32');

        this.frames = reader.read('Uint16');
        this.firstFrame = reader.read('Uint16');

        this.faces = (this.flags & TextureFlags.ENVMAP ? (this.firstFrame == 0xFFFF ? 7 : 6) : 1);

        reader.pointer += 4;

        this.reflectivity = new THREE.Color(reader.read('Float32'), reader.read('Float32'), reader.read('Float32'));

        reader.pointer += 4;

        this.bumpmapScale = reader.read('Float32');

        this.format = reader.read('Uint32');
        if(!(this.format in TextureFormat)) {
            console.error(`VTF.init: Invalid texture format. ${this.format}`);
            return false;
        }

        this.mipmaps = reader.read('Uint8');

        const lowResFormat: TextureFormat = reader.read('Uint32');
        if(!(lowResFormat in TextureFormat)) {
            console.error(`VTF.init: Invalid texture format. ${lowResFormat}`);
            return false;
        }
        const lowResWidth: number = reader.read('Uint8');
        const lowResHeight: number = reader.read('Uint8');

        this.slices = 1;
        if(this.isAtleastVersion(7, 2)) {
            this.slices = reader.read('Uint16');
        }

        let isResourceFormat: boolean = false;
        let resources: {[key: string]: { flags: number, offset: number }} = {};

        if(this.isAtleastVersion(7, 3)) {
            isResourceFormat = true;

            reader.pointer += 3;

            const numResources: number = reader.read('Uint32');

            reader.pointer += 8;

            for(let i=0; i < numResources; i++) {
                const tag = reader.read('String', 3);

                if(!(Object.values(Resources).includes(tag))) {
                    console.warn(`VTF.init: Invalid resource tag "${tag}"`);
                }
                if(resources[tag] !== undefined) {
                    console.warn(`VTF.init: Multiple of the same tag "${tag}", Overwriting.`);
                }

                resources[tag] = {
                    flags: reader.read('Uint8'),
                    offset: reader.read('Uint32')
                }
            }


    
            if(reader.pointer > headerSize) {
                console.error('VTF.load: Resource entries exceed header size.');
                return false;
            }

        }



        if(reader.pointer > headerSize) {
            console.error('VTF.init: Header size is invalid.');
            return false;
        }

        if(isResourceFormat && resources[Resources.highResImageData] === undefined) {
            console.error('VTF.load: No high resolution image data.');
            return false;
        }



        if(isResourceFormat) {
            reader.pointer = resources[Resources.highResImageData].offset;
        } else {
            reader.pointer = headerSize + getImageByteSize(lowResFormat, lowResWidth, lowResHeight);
        }



        // @ts-ignore
        this.textures = Utils.createNthDimensionalArray([ this.mipmaps, this.frames, this.faces, this.slices ]);


        this.forEachTexture((mipmap, frame, face, slice) => {

            const invMipmap = (this.mipmaps - mipmap - 1);

            const size = this.getTextureSize(invMipmap);

            const byteSize = getImageByteSize(this.format, size.width, size.height);

            this.textures[invMipmap][frame][face][slice] = reader.read('Buffer', byteSize);

        });



        return true;

    }



    getTextureSize(mipmap: number) {
        return {
            width: this.width >> mipmap,
            height: this.height >> mipmap
        }
    }

    forEachTexture(callbackfn: forEachTextureCallbackfn) {
        for(let mipmap=0; mipmap < this.mipmaps; mipmap++) {
            for(let frame=0; frame < this.frames; frame++) {
                for(let face=0; face < this.faces; face++) {
                    for(let slice=0; slice < this.slices; slice++) {
                        callbackfn(mipmap, frame, face, slice, this.textures[mipmap][frame][face][slice]);
                    }
                }
            }
        }
    }



    getMipmaps(frame: number = 0): { data: Uint8Array, width: number, height: number }[] {
        return Utils.initArray(this.mipmaps, i => {
            const size = this.getTextureSize(i);
            return {
                data: new Uint8Array(this.textures[i][frame][0][0]),
                width: size.width,
                height: size.height
            }
        }).filter(mip => {
            return (mip.width > 0 && mip.height > 0);
        });
    }

    getTexture(): THREE.CompressedTexture | THREE.DataTexture | null {

        const FormatMap: {[key: number]: number} = {};
        FormatMap[TextureFormat.DXT1] = THREE.RGB_S3TC_DXT1_Format;
        FormatMap[TextureFormat.DXT1_ONEBITALPHA] = THREE.RGBA_S3TC_DXT1_Format;
        FormatMap[TextureFormat.DXT3] = THREE.RGBA_S3TC_DXT3_Format;
        FormatMap[TextureFormat.DXT5] = THREE.RGBA_S3TC_DXT5_Format;
        FormatMap[TextureFormat.RGBA8888] = THREE.RGBAFormat;
        FormatMap[TextureFormat.BGRA8888] = THREE.RGBAFormat;
        // FormatMap[TextureFormat.BGR888] = THREE.RGBFormat; // TODO: Add conversion for not supported formats.



        let texture: THREE.CompressedTexture | THREE.DataTexture | null = null;

        if(
            [
                TextureFormat.DXT1,
                TextureFormat.DXT1_ONEBITALPHA,
                TextureFormat.DXT3,
                TextureFormat.DXT5
            ].includes(this.format)
        ) {

            texture = new THREE.CompressedTexture(
                // @ts-ignore
                this.getMipmaps(0),
                this.width,
                this.height,
                FormatMap[this.format]
            );

        } else {

            if(FormatMap[this.format] === undefined) {
                console.warn('VTF.getTexture: Unimplemented texture format.', this.format);
                return null;
            }

            texture = new THREE.DataTexture(
                undefined,
                this.width,
                this.height,
                FormatMap[this.format]
            );

            texture.mipmaps = this.getMipmaps(0);

        }



        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.generateMipmaps = false; // Mipmaps are in .vtf
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        // texture.anisotropy = this.flags & TextureFlags.ANISOTROPIC ? 16 : 1;



        texture.needsUpdate = true;

        return texture;

    }


}



export { VTF };
