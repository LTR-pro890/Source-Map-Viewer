
import { DirEntry, DirFile, DirType, TransferDirectory } from "./common/Directory";
import { Utils } from "./common/Utils";


// Testing imports DELETE LATER.
import { BSP_Parser, Lumps } from "./SourceEngine/bsp/parser";
import * as THREE from 'three';
import { BSP_Renderer } from "./SourceEngine/bsp/renderer";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { KeyValues } from "./SourceEngine/keyvalues";
import { SourceAssetDirectoryManager } from "./SourceEngine/assetDirectoryManager";
import { VPK } from "./SourceEngine/vpk";
import { VTF } from "./SourceEngine/vtf";
import { DataReader } from "./common/DataReader";



// @ts-ignore
const rendererContainer: HTMLDivElement = document.querySelector('#renderer-container');
// @ts-ignore
const rendererCanvas: HTMLCanvasElement = rendererContainer.querySelector('#renderer-canvas');
// @ts-ignore
const rendererInfo: HTMLDivElement = rendererContainer.querySelector('#renderer-info');
// @ts-ignore
const rendererInfoDrawCalls: HTMLDivElement = rendererInfo.querySelector('#renderer-info-drawCalls');
// @ts-ignore
const rendererInfoFrame: HTMLDivElement = rendererInfo.querySelector('#renderer-info-frame');
// @ts-ignore
const rendererInfoMaxFPS: HTMLDivElement = rendererInfo.querySelector('#renderer-info-maxFPS');



async function CreateViewer(dataTransfer: DataTransfer) {
    
    const transferDir = new TransferDirectory(dataTransfer);

    

    const manager = new SourceAssetDirectoryManager(transferDir);
    if(!await manager.init()) {
        return;
    }



    // const bspFile = await transferDir.getFile('Team Fortress 2\\tf\\maps\\video_test1.bsp');
    const bspFile = await transferDir.getFile('Team Fortress 2\\tf\\maps\\pl_upward.bsp');
    if(bspFile === undefined) {
        throw new Error('Could not find file.');
    }

    

    const renderer = new BSP_Renderer(bspFile, manager);
    await renderer.init();
    renderer.createRenderer(rendererCanvas);
    await renderer.createScene('lighting');



    // {

    //     // <unsigned char>[]
    //     const data = await renderer.parser.getLumpRawData(Lumps.DISP_LIGHTMAP_SAMPLE_POSITIONS);

    //     console.log(data);

    //     console.log(await renderer.parser.getParsedLump(Lumps.DISPINFO));

    // }



    console.log(renderer);



    const camera = BSP_Renderer.createCamera();
    // Would love to use pointerlockcontrols but that doesn't take in account for camera.up
    // So for now I'll just use this until I make a better controls.
    const controls = new OrbitControls(camera, rendererCanvas);
    controls.zoomSpeed = 3;
    camera.position.set(200, 0, 0);
    controls.update();

    let lastUpdate = 0;
    let drawDelay = 1000 / 60;
    function update() {
        // TODO: Fix this ignoring last update.
        if(lastUpdate + drawDelay > Date.now()) return;
        lastUpdate = Date.now();

        renderer.render(camera);

        rendererInfoDrawCalls.innerText = `Draw Calls: ${renderer.renderer?.info.render.calls}`;
        rendererInfoFrame.innerText = `Frames: ${renderer.renderer?.info.render.frame}`;
        rendererInfoMaxFPS.innerText = `Max FPS: ${Math.round(1000 / drawDelay)}`;
    }

    controls.addEventListener('change', update);

    new ResizeObserver(() => {
        rendererCanvas.width = rendererCanvas.clientWidth;
        rendererCanvas.height = rendererCanvas.clientHeight;

        camera.aspect = rendererCanvas.width / rendererCanvas.height;
        camera.updateProjectionMatrix();

        update();
    }).observe(rendererCanvas);

}





// @ts-ignore
const dropzone: HTMLDivElement = document.querySelector('#dropzone');



function isDataTransferFiles(dataTransfer: DataTransfer | null): boolean {
    if(dataTransfer == null) return false;
    return (dataTransfer.types.length == 1 && dataTransfer.types[0] == 'Files');
}



document.body.addEventListener('drop', async ev => {
    ev.preventDefault();
    dropzone.classList.remove('dropzoneVisible');

    if(ev.dataTransfer == null) return;
    if(!isDataTransferFiles(ev.dataTransfer)) return;



    CreateViewer(ev.dataTransfer);
});


// @ts-ignore
const dropzonefileList: HTMLDivElement = document.querySelector('#dropzone-fileList');

document.body.addEventListener('dragover', ev => {
    if(ev.dataTransfer == null) return;
    if(!isDataTransferFiles(ev.dataTransfer)) return;

    dropzonefileList.innerText = `${ev.dataTransfer.items.length} item${ev.dataTransfer.items.length > 1 ? 's' : ''}`;
    ev.preventDefault();
    dropzone.classList.add('dropzoneVisible');
});

document.body.addEventListener('dragleave', ev => {
    // @ts-ignore
    if(ev.fromElement == null) dropzone.classList.remove('dropzoneVisible');
});

