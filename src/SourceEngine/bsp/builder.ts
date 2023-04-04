
import { DirFile } from "../../common/Directory";
import { MathUtils } from "../../common/MathUtils";
import { Utils } from "../../common/Utils";
import { SourceAssetDirectoryManager } from "../assetDirectoryManager";
import { VMT } from "../vmt";
import { AtlasNode, HDR_Image, Rectangle } from "./atlas";
import { BSP_Parser, Lumps } from "./parser";
import * as BSP_Types from "./types";
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';



const LIGHTMAP_PADDING = 4;



class LightmapImage extends HDR_Image {
    faceIndex: number = -1;

    static fromLightmapSlice(slice: BSP_Types.ColorRGBExp[], width: number, height: number, ambient: BSP_Types.ColorRGBExp = { r: 200, g: 200, b: 200, exp: 20 }) {

        if(width * height != slice.length) {
            throw new Error('LightmapImage.fromLightmapSlice: Invalid slice size.');
        }

        const image = new LightmapImage(width + LIGHTMAP_PADDING*2, height + LIGHTMAP_PADDING*2);

        const minR = 0.07;
        const minG = 0.07;
        const minB = 0.07;

        const maxR = Infinity;
        const maxG = Infinity;
        const maxB = Infinity;

        for(let x=0; x < image.width; x++) {
            for(let y=0; y < image.height; y++) {

                // Closest sample to pixel.
                const sx = MathUtils.clamp(x, LIGHTMAP_PADDING, image.width-LIGHTMAP_PADDING-1) - LIGHTMAP_PADDING;
                const sy = MathUtils.clamp(y, LIGHTMAP_PADDING, image.height-LIGHTMAP_PADDING-1) - LIGHTMAP_PADDING;
                const sample = slice[sx + sy * width];

                // let edge = !MathUtils.isInRange2(
                //     x, y,
                //     LIGHTMAP_PADDING + 1, image.width - LIGHTMAP_PADDING-1 - 1,
                //     LIGHTMAP_PADDING + 1, image.height - LIGHTMAP_PADDING-1 - 1
                // );

                // if(edge) {
                //     sample.r *= 4;
                //     sample.exp += 2;
                // }

                const ii = (x + y * image.width) * 4;

                const exp = 2 ** sample.exp;
                image.data[ii+0] = MathUtils.clamp((sample.r * exp) / 255, minR, maxR);
                image.data[ii+1] = MathUtils.clamp((sample.g * exp) / 255, minG, maxG);
                image.data[ii+2] = MathUtils.clamp((sample.b * exp) / 255, minB, maxB);
                image.data[ii+3] = 1;

                // if(edge) {
                //     sample.r /= 4;
                //     sample.exp -= 2;
                // }

            }
        }

        return image;

    }
}



type LightmapFace = BSP_Types.Face & {
    lightmapNode?: AtlasNode;
}



class BSP_Builder {

    parser: BSP_Parser;
    dirManager: SourceAssetDirectoryManager;

    constructor(parser: BSP_Parser, dirManager: SourceAssetDirectoryManager) {
        this.parser = parser;
        this.dirManager = dirManager;
    } 



    vertices: BSP_Types.Vertex[] | undefined;
    edges: BSP_Types.Edge[] | undefined;
    surfedges: BSP_Types.Surfedge[] | undefined;
    faces: LightmapFace[] | undefined;
    texInfo: BSP_Types.TexInfo[] | undefined;
    texData: BSP_Types.TexData[] | undefined;
    dispInfo: BSP_Types.DispInfo[] | undefined;
    dispVerts: BSP_Types.DispVert[] | undefined;
    texStrings: BSP_Types.TexDataStringData[] | undefined;
    lighting: Uint8Array | undefined;



    async load(...types: number[]): Promise<void> {

        const typemap: string[] = [];
        typemap[Lumps.VERTEXES] = 'vertices';
        typemap[Lumps.EDGES] = 'edges';
        typemap[Lumps.SURFEDGES] = 'surfedges';
        typemap[Lumps.FACES] = 'faces';
        typemap[Lumps.TEXINFO] = 'texInfo';
        typemap[Lumps.TEXDATA] = 'texData';
        typemap[Lumps.DISPINFO] = 'dispInfo';
        typemap[Lumps.DISP_VERTS] = 'dispVerts';
        typemap[Lumps.TEXDATA_STRING_DATA] = 'texStrings';
        typemap[Lumps.LIGHTING] = 'lighting';

        for(const type of types) {

            if(typemap[type] === undefined) {
                continue;
            }
            // @ts-ignore
            if(this[typemap[type]] !== undefined) {
                continue;
            }

            // @ts-ignore
            this[typemap[type]] = await this.parser.getParsedLump(type);

        }

    }



    async geometry_vertices(): Promise<THREE.BufferGeometry | null> {
        await this.load(Lumps.VERTEXES);
        if(this.vertices === undefined) return null;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(
            this.vertices.map(v => v.toArray()).flat(),
            3
        ));

        return geometry;
    }



    async geometry_edges(): Promise<THREE.BufferGeometry | null> {
        const geometry = await this.geometry_vertices();
        if(geometry === null) return null;
        
        await this.load(Lumps.EDGES);
        if(this.edges === undefined) return null;
        
        geometry.setIndex(this.edges.flat());

        return geometry;
    }



    /**
     * Gets geometry for a face.  
     * Applies displacement.  
     * 
     * Attributes:  
     *     position  
     *     uv  
     *     luv (Lightmap UVs)  
     *     color (Reflectivity color)  
     *     *alpha (Texture mixing for displacements, Exists only for displacements.)  
     */
    async geometry_face(faceIndex: number): Promise<THREE.BufferGeometry | null> {
        await this.load(Lumps.VERTEXES, Lumps.EDGES, Lumps.SURFEDGES, Lumps.FACEIDS, Lumps.TEXINFO, Lumps.TEXDATA, Lumps.DISPINFO, Lumps.DISP_VERTS);
        if(this.vertices === undefined
         || this.edges === undefined
         || this.surfedges === undefined
         || this.faces === undefined
         || this.texInfo === undefined
         || this.texData === undefined
         || this.dispInfo === undefined
         || this.dispVerts === undefined) return null;



        const face = this.faces[faceIndex];
        let positions: THREE.Vector3[] = [];
        let colors: THREE.Color[] = [];
        let indices: [ number, number, number ][] = [];
        let alphas: number[] | undefined = undefined;



        // Get base vertices for face.
        const verts = [];

        for(let i=0; i < face.numEdges; i++) {
            const surfedge = this.surfedges[face.firstEdge + i];
            const edge = this.edges[Math.abs(surfedge)];
            const vertex = this.vertices[edge[surfedge < 0 ? 1 : 0]];

            verts.push(vertex);
        }



        // texture information.
        const texInfo = this.texInfo[face.texInfo];
        const texData = this.texData[texInfo.texData];
        const color = texData.reflectivity;



        if(face.dispInfo == -1) {

            // Face is not a displacement.
            // Just push vertices to the geometry.

            for(const vert of verts) {
                positions.push(vert);
                colors.push(color);
            }

            for(let i=0; i < verts.length-2; i++) {
                indices.push([ i+2, i+1, 0 ]);
            }

        } else {

            // Face is a displacement.
            // Subdivide face,
            // Offset vertices in displacement direction,
            // Push vertices to the geometry.

            Utils.assert(verts.length == 4, 'Invalid displacement.');

            
            const dispInfo = this.dispInfo[face.dispInfo];


            
            const orientation = verts.findIndex(vert => (dispInfo.startPos.distanceTo(vert) < 0.1));

            const v0 = verts[(orientation + 0) % 4];
            const v1 = verts[(orientation + 1) % 4];
            const v2 = verts[(orientation + 2) % 4];
            const v3 = verts[(orientation + 3) % 4];



            const size = Math.pow(2, dispInfo.power);

            alphas = [];

            // Generate vertices
            for(let i=0; i < size+1; i++) {
                for(let j=0; j < size+1; j++) {
                    const u = i / size;
                    const v = j / size;

                    const dispVertIndex = i * (size + 1) + j;
                    const dispVert = this.dispVerts[dispInfo.dispVertStart + dispVertIndex];

                    const vertex = new THREE.Vector3().lerpVectors(
                        new THREE.Vector3().lerpVectors(v0, v1, u),
                        new THREE.Vector3().lerpVectors(v3, v2, u),
                        v
                    );
                    
                    vertex.add(new THREE.Vector3().copy(dispVert.vec).multiplyScalar(dispVert.dist));

                    positions.push(vertex);
                    colors.push(color);
                    alphas.push(dispVert.alpha / 255);
                }
            }

            // Generate indices
            for(let i=0; i < size; i++) {
                for(let j=0; j < size; j++) {
                    const i0 = i * (size+1) + j;
                    const i1 = (i+1) * (size+1) + j;
                    const i2 = (i+1) * (size+1) + j+1;
                    const i3 = i * (size+1) + j+1;

                    indices.push(
                        [ i2, i1, i0 ],
                        [ i3, i2, i0 ]
                    );
                }
            }

        }



        function constructUVs(positions: THREE.Vector3[], vecs: BSP_Types.TexVec, width: number, height: number, mins: [number, number] = [0, 0]) {
            const s = new THREE.Vector3(vecs[0][0], vecs[0][1], vecs[0][2]);
            const t = new THREE.Vector3(vecs[1][0], vecs[1][1], vecs[1][2]);
            const xOffset = vecs[0][3];
            const yOffset = vecs[1][3];
            
            let uvs: THREE.Vector2[] = [];

            for(const vert of positions) {
                uvs.push(new THREE.Vector2(
                    (s.dot(vert) + xOffset - mins[0]) / width,
                    (t.dot(vert) + yOffset - mins[1]) / height
                ));
            }

            return uvs;
        }



        const uvs = constructUVs(positions, texInfo.textureVecs, texData.width, texData.height);
        const luvs = constructUVs(positions, texInfo.lightmapVecs, face.lightmapTextureSizeInLuxels[0], face.lightmapTextureSizeInLuxels[1], face.lightmapTextureMinsInLuxels);



        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions.map(v => v.toArray()).flat(), 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(colors.map(v => v.toArray()).flat(), 3));
        geom.setIndex(indices.flat());
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.map(uv => uv.toArray()).flat(), 2));
        geom.setAttribute('luv', new THREE.Float32BufferAttribute(luvs.map(luv => luv.toArray()).flat(), 2));
        if(alphas !== undefined) geom.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
        else geom.setAttribute('alpha', new THREE.Float32BufferAttribute(positions.length, 1));

        return geom;

    }

    /**
     * Merges all faces into 1 geometry.  
     * Use geometry_face(index) if need non-merged geometries.  
     */
    async geometry_faces(): Promise<THREE.BufferGeometry | null> {
        await this.load(Lumps.FACES);
        if(this.faces === undefined) return null;

        const geoms = [];
        for(let i=0; i < this.faces.length; i++) {
            const geom = await this.geometry_face(i);
            if(geom === null) continue;

            if(geom.hasAttribute('alpha')) {
                geom.deleteAttribute('alpha');
            }

            geoms.push(geom);
        }

        return BufferGeometryUtils.mergeBufferGeometries(geoms);

    }



    async material(index: number = 0): Promise<THREE.ShaderMaterial | null> {
        await this.load(Lumps.TEXDATA_STRING_DATA);
        if(this.texStrings === undefined) return null;

        const path = `materials\\${this.texStrings[index].toLowerCase()}.vmt`;
        const vmtFile = await this.dirManager.getFile(path);
        if(vmtFile === undefined) {
            console.warn(`BSP_Builder.material: Could not find material "${path}"`);
            return null;
        }

        const vmt = new VMT(vmtFile);
        await vmt.init();

        const material = await vmt.getMaterial(this.dirManager);

        return material;
    }

    async materials(): Promise<(THREE.ShaderMaterial | null)[]> {
        await this.load(Lumps.TEXDATA_STRING_DATA);
        if(this.texStrings === undefined) return [];

        return Utils.initArrayAsync(this.texStrings.length, i => this.material(i));
    }



    async mesh_faces(): Promise<THREE.Mesh[]> {
        await this.load(Lumps.FACES, Lumps.TEXDATA, Lumps.TEXINFO);
        if(this.faces === undefined
         || this.texData === undefined
         || this.texInfo === undefined) return [];

        const materials = await this.materials();

        const faces = new Array(this.faces.length);

        for(let i=0; i < this.faces.length; i++) {
            const geom = await this.geometry_face(i);
            if(geom === null) continue;

            const face = this.faces[i];
            const texInfo = this.texInfo[face.texInfo];
            const texData = this.texData[texInfo.texData];

            const mat = materials[texData.nameStringTableID];
            if(mat === null) continue;

            faces[i] = new THREE.Mesh(
                geom,
                mat
            );
        }

        return faces;
    }




    getLuxel(byteOffset: number): BSP_Types.ColorRGBExp {
        if(this.lighting === undefined) return { r: 0, g: 0, b: 0, exp: 0 };
        return {
            r: this.lighting[byteOffset + 0],
            g: this.lighting[byteOffset + 1],
            b: this.lighting[byteOffset + 2],
            exp: (this.lighting[byteOffset + 3] << 24) >> 24 // To int8
        }
    }

    getLuxelSlice(byteOffset: number, count: number): BSP_Types.ColorRGBExp[] {
        const arr = new Array(count);

        for(let i=0; i < count; i++) {
            arr[i] = this.getLuxel(byteOffset + i * 4);
        }

        return arr;
    }

    async lightmap_atlas(): Promise<AtlasNode | null> {
        await this.load(Lumps.FACES, Lumps.LIGHTING);
        if(this.faces === undefined
         || this.lighting === undefined) return null;



        let luxelCount = 0;
        let lightmaps: LightmapImage[] = [];

        for(let i=0; i < this.faces.length; i++) {
            const face = this.faces[i];

            const width = face.lightmapTextureSizeInLuxels[0] + 1;
            const height = face.lightmapTextureSizeInLuxels[1] + 1;

            const numStyles = face.styles.reduce((numStyles, style) => style != 255 ? numStyles + 1 : numStyles, 0);
            const numLuxels = width * height;
            const luxelOffset = face.lightOffset;

            for(let style=0; style < numStyles; style++) {

                const slice = this.getLuxelSlice(luxelOffset + numLuxels*4 * style, numLuxels);
                const image = LightmapImage.fromLightmapSlice(slice, width, height);

                image.faceIndex = i;

                lightmaps.push(image);

                luxelCount += image.width * image.height;
                
            }
        }



        // Larged to smallest
        lightmaps.sort((a, b) => {
            // const aSize = a.width * a.height;
            // const bSize = b.width * b.height;
            const aSize = Math.max(a.width, a.height);
            const bSize = Math.max(b.width, b.height);
            return bSize - aSize;
        });



        // TODO: Refactor.
        let size = Math.sqrt(luxelCount * 1.2);
        if(size < 256) size *= 1.2;
        if(size < 128) size = 128;
        // IDK: https://gamedev.stackexchange.com/questions/7927/should-i-use-textures-not-sized-to-a-power-of-2
        // I've tried both and I cannot tell the difference.
        // size = MathUtils.nearestPowerOf2(size);
        size = Math.ceil(size);

        console.info(`Creating merged lightmap of ${size}x${size}`);

        const atlas = new AtlasNode(new Rectangle(0, 0, size, size));

        for(const lightmap of lightmaps) {
            const node = atlas.insert(lightmap);

            if(node == null) {
                throw new Error(`BSP_Builder.lightmap_atlas: Could not build lightmap, Resolution too small.`);
            }

            node.image = lightmap;
            this.faces[lightmap.faceIndex].lightmapNode = node;
        }

        return atlas;

    }

    async mesh_faces_light(): Promise<THREE.Mesh[]> {
        await this.load(Lumps.FACES, Lumps.TEXDATA, Lumps.TEXINFO);
        if(this.faces === undefined
         || this.texData === undefined
         || this.texInfo === undefined) return [];


        
        const atlas = await this.lightmap_atlas();
        if(atlas == null) {
            console.warn('Could not create lightmap atlas, Using fullbright.');
            return await this.mesh_faces();
        }
        const atlasImage = atlas.getHDRImage();
        const atlasTexture = new THREE.DataTexture(atlasImage.data, atlasImage.width, atlasImage.height, THREE.RGBAFormat, THREE.FloatType);
        atlasTexture.generateMipmaps = false;
        atlasTexture.magFilter = THREE.LinearFilter;
        atlasTexture.minFilter = THREE.LinearFilter;
        atlasTexture.needsUpdate = true;



        // document.body.appendChild(Utils.getImageCanvas(atlasImage.getImageData(), 'pixelated'));



        const materials = await this.materials();



        // Apply lightmap to materials.
        materials.forEach(material => {
            if(material == null) return;

            if(material.uniforms == undefined) material.uniforms = {};
            material.uniforms.u_lightmap = {
                value: atlasTexture
            }
            if(material.defines == undefined) material.defines = {};
            material.defines.LIGHTMAP = true;

            material.needsUpdate = true;
        });



        const faces = new Array(this.faces.length);

        for(let i=0; i < this.faces.length; i++) {
            const geom = await this.geometry_face(i);
            if(geom === null) continue;

            const face = this.faces[i];
            const texInfo = this.texInfo[face.texInfo];
            const texData = this.texData[texInfo.texData];

            const mat = materials[texData.nameStringTableID];
            if(mat === null) continue;



            const lightmapNode = face.lightmapNode;

            if(lightmapNode != undefined) {
                const nodeXmin = (lightmapNode.rect.x + LIGHTMAP_PADDING) / atlas.rect.width;
                const nodeXmax = (lightmapNode.rect.x + lightmapNode.rect.width - LIGHTMAP_PADDING) / atlas.rect.width;
                const nodeYmin = (lightmapNode.rect.y + LIGHTMAP_PADDING) / atlas.rect.height;
                const nodeYmax = (lightmapNode.rect.y + lightmapNode.rect.height - LIGHTMAP_PADDING) / atlas.rect.height;

                // @ts-ignore
                const luv: THREE.Float32BufferAttribute = geom.getAttribute('luv');

                luv.applyMatrix3(new THREE.Matrix3().setUvTransform(
                    nodeXmin, nodeYmin,
                    nodeXmax - nodeXmin, nodeYmax - nodeYmin,
                    0, 0, 0
                ));

                luv.needsUpdate = true;
            }



            faces[i] = new THREE.Mesh(
                geom,
                mat
            );
        }

        return faces;
    }

}



export { BSP_Builder };
