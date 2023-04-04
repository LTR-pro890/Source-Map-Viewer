
import * as THREE from 'three';
import { DirFile, FileBase } from '../../common/Directory';
import { BSP_Parser, Lumps } from './parser';
import { BSP_Builder } from './builder';
import { SourceAssetDirectoryManager } from '../assetDirectoryManager';
import { ObjectUtils } from '../../common/ObjectUtils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ThreeUtils } from '../../common/ThreeUtils';



class BSP_Renderer {

    file: FileBase;
    dirManager: SourceAssetDirectoryManager;
    parser: BSP_Parser;

    constructor(file: FileBase, dirManager: SourceAssetDirectoryManager) {
        this.file = file;
        this.dirManager = dirManager;
        this.parser = new BSP_Parser(file);
    }

    async init() {

        await this.parser.init();

        // Add pakfile to directory manager

        const pakFile = await this.parser.getParsedLump(Lumps.PAKFILE);

        if(pakFile != null) {
            this.dirManager.directories.unshift(pakFile);
        }

    }



    renderer: THREE.WebGLRenderer | undefined;

    createRenderer(canvas: HTMLCanvasElement | THREE.OffscreenCanvas | undefined, options: THREE.WebGLRendererParameters = {}) {

        const opt: THREE.WebGLRendererParameters = {
            canvas,
            antialias: true
        }

        this.renderer = new THREE.WebGLRenderer({ ...opt, ...options });

    }

    scene: THREE.Scene | undefined;

    async createScene(mode: 'vertices' | 'wireframe' | 'reflectivity' | 'fullbright' | 'lighting' | 'materiallist' = 'vertices') {

        this.scene = new THREE.Scene();

        const builder = new BSP_Builder(this.parser, this.dirManager);

        console.log(builder);

        console.time(`BSP_Renderer.createScene("${mode}"): Create time`);

        switch(mode) {

            case 'vertices': {

                const geom = await builder.geometry_vertices();
                if(geom === null) return;
                const mesh = new THREE.Points(
                    geom,
                    new THREE.PointsMaterial({
                        color: new THREE.Color(1, 1, 1)
                    })
                );
                this.scene.add(mesh);

                break; }

            case 'wireframe': {

                const geom = await builder.geometry_edges();
                if(geom === null) return;
                const mesh = new THREE.LineSegments(
                    geom,
                    new THREE.LineBasicMaterial({
                        color: new THREE.Color(1, 1, 1)
                    })
                );
                this.scene.add(mesh);

                break; }

            case 'reflectivity': {

                const geom = await builder.geometry_faces();
                if(geom === null) return;
                const mesh = new THREE.Mesh(
                    geom,
                    new THREE.MeshBasicMaterial({
                        vertexColors: true
                    })
                );
                this.scene.add(mesh);

                break; }

            case 'fullbright': {

                // @ts-ignore
                const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = (await builder.mesh_faces())
                    .filter(mesh => mesh !== undefined);

                const mergedMeshes = ThreeUtils.mergeMeshesWithSameMaterial(meshes);

                for(const mergedMesh of mergedMeshes) {
                    this.scene.add(mergedMesh);
                }

                break; }

            case 'lighting': {

                // @ts-ignore
                const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = (await builder.mesh_faces_light())
                    .filter(mesh => mesh !== undefined);

                const mergedMeshes = ThreeUtils.mergeMeshesWithSameMaterial(meshes);

                for(const mergedMesh of mergedMeshes) {
                    this.scene.add(mergedMesh);
                }

                break; }

            case 'materiallist': {

                const materials = await builder.materials();

                let count = 0;
                for(const material of materials) {
                    if(material === null) continue;

                    const geom = new THREE.PlaneGeometry(100, 100);
                    geom.setAttribute('uv', new THREE.Float32BufferAttribute([ 0, 0, 1, 0, 0, 1, 1, 1 ], 2));
                    geom.translate(count++ * 100, 0, 0);

                    const mesh = new THREE.Mesh(
                        geom,
                        material
                    );

                    this.scene.add(mesh);
                }

                break; }

            default: {
                throw new Error(`BSP_Renderer.createScene("${mode}"): Mode is invalid.`);
                break; }

        }

        console.timeEnd(`BSP_Renderer.createScene("${mode}"): Create time`);

    }



    static createCamera(fov: number = 80) {
        const camera = new THREE.PerspectiveCamera(fov, 1, 10, 100000);
        camera.up = new THREE.Vector3(0, 0, 1);
        return camera;
    }



    render(camera: THREE.Camera, target: THREE.WebGLRenderTarget | null = null): THREE.WebGLRenderTarget | null {

        if(this.renderer === undefined)
            throw new Error('BSP_Renderer.render: Set up renderer to render.');
        if(this.scene === undefined)
            throw new Error('BSP_Renderer.render: Set up scene to render.');

        if(target !== null) {
            console.error('BSP_Renderer.render: TODO: Render target.');
        }

        this.renderer.setSize(this.renderer.domElement.width, this.renderer.domElement.height);
        this.renderer.render(this.scene, camera);

        return this.renderer.getRenderTarget();

    }

}



export { BSP_Renderer };
