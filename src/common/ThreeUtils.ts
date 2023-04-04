
import * as THREE from "three";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';



namespace ThreeUtils {

    export function mergeMeshesWithSameMaterial(meshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]): THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] {

        const geometriesMaterials: Map<THREE.Material, THREE.BufferGeometry[]> = new Map();

        for(const mesh of meshes) {

            const material = mesh.material;
            const geometry = mesh.geometry;

            if(geometriesMaterials.get(material) === undefined) {
                geometriesMaterials.set(material, []);
            }

            geometriesMaterials.get(material)?.push(geometry);

        }



        const mergedMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];

        for(const [ material, geometries ] of geometriesMaterials) {

            const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);

            const mesh = new THREE.Mesh(
                mergedGeometry,
                material
            );

            mergedMeshes.push(mesh);

        }



        return mergedMeshes;

    }

}



export { ThreeUtils };
