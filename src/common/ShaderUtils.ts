


import * as THREE from 'three';



class ShaderUtils {

    static async getShaderMaterialFile(path: string, options: THREE.ShaderMaterialParameters={}) {

        const fragmentShader = await (await fetch(`${path}.frag`)).text();
        const vertexShader = await (await fetch(`${path}.vert`)).text();

        const shader = new THREE.ShaderMaterial({...options, ...{
            fragmentShader,
            vertexShader
        }});

        return shader;

    }

}



export { ShaderUtils };
