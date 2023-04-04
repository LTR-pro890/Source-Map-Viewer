
import * as THREE from "three";
import { FileBase } from "../common/Directory";
import { ObjectUtils } from "../common/ObjectUtils";
import { ShaderUtils } from "../common/ShaderUtils";
import { SourceAssetDirectoryManager } from "./assetDirectoryManager";
import { KeyValues } from "./keyvalues";
import { VTF } from "./vtf";
import { Utils } from "../common/Utils";




async function getTexture(dirManager: SourceAssetDirectoryManager, path: string): Promise<VTF | undefined> {
    const sPath = `materials\\${path.toLowerCase()}.vtf`;

    const file = await dirManager.getFile(sPath);
    if(file === undefined) {
        console.warn(`getTexture: Could not find texture. "${sPath}"`);
        return;
    }

    const vtf = new VTF(file);
    await vtf.init();

    return vtf;
}



let defaultMaterial: THREE.ShaderMaterial | undefined;



type VMTShader = {
    $basetexture?: string;
    $basetexture2?: string;
    $surfaceprop?: string;
    $translucent?: '0' | '1';
}



class VMT {

    vmtFile: FileBase;

    constructor(vmtFile: FileBase) {
        this.vmtFile = vmtFile;
    }



    shader: string = '';
    data: VMTShader = {};



    async init(): Promise<boolean> {

        /*
            "LightmappedGeneric" {
                "$basetexture" "customdev\grid"
            }
        */

        if(!(await this.vmtFile.init())) {
            console.warn('VMT.init: Could not load .vmt file.');
            return false;
        }



        let data: {[key: string]: VMTShader} | undefined = KeyValues.parse(await this.vmtFile.text(), true);
        if(data === undefined) {
            console.warn('VMT.init: Invalid KeyValues.');
            return false;
        }

        const keys = Object.keys(data);
        if(keys.length != 1) {
            console.warn('VMT.init: Invalid KeyValues.');
            return false;
        }



        const shader = keys[0];

        this.shader = shader.toLowerCase();
        this.data = data[shader];

        

        return true;

    }



    static async getDefaultMaterial(): Promise<THREE.ShaderMaterial> {
        if(defaultMaterial === undefined) {
            defaultMaterial = await ShaderUtils.getShaderMaterialFile('\\shaders\\Default');
        }

        return defaultMaterial;
    }

    async getMaterial(dirManager: SourceAssetDirectoryManager): Promise<THREE.ShaderMaterial> {

        switch(this.shader) {

            case 'unlitgeneric': {

                if(this.data.$basetexture === undefined) break;
                const baseTexture = await getTexture(dirManager, this.data.$basetexture);
                if(baseTexture === undefined) break;

                return await ShaderUtils.getShaderMaterialFile('\\shaders\\UnlitGeneric', {
                    uniforms: {
                        u_basetexture: {
                            value: baseTexture.getTexture()
                        }
                    },
                    transparent: this.data.$translucent === '1'
                });

                break; }

            case 'lightmappedgeneric': {

                if(this.data.$basetexture === undefined) break;
                const baseTexture = await getTexture(dirManager, this.data.$basetexture);
                if(baseTexture === undefined) break;

                return await ShaderUtils.getShaderMaterialFile('\\shaders\\LightMappedGeneric', {
                    uniforms: {
                        u_basetexture: {
                            value: baseTexture.getTexture()
                        }
                    },
                    transparent: this.data.$translucent === '1'
                });

                break; }

            case 'worldvertextransition': {

                if(this.data.$basetexture === undefined || this.data.$basetexture2 === undefined) break;
                const baseTexture1 = await getTexture(dirManager, this.data.$basetexture);
                const baseTexture2 = await getTexture(dirManager, this.data.$basetexture2);
                if(baseTexture1 === undefined || baseTexture2 === undefined) break;

                return await ShaderUtils.getShaderMaterialFile('\\shaders\\WorldVertexTransition', {
                    uniforms: {
                        u_basetexture1: {
                            value: baseTexture1.getTexture()
                        },
                        u_basetexture2: {
                            value: baseTexture2.getTexture()
                        }
                    },
                    transparent: this.data.$translucent === '1'
                });

                break; }

            default: {

                console.warn(`VMT.getMaterial: TODO: Implement shader ${this.shader}`);

                break; }

        }

        console.warn('VMT.getMaterial: Unable to create material, Using default.', this);
        
        return await VMT.getDefaultMaterial();

    }

}



export { VMT };
