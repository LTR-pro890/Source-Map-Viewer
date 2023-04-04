
/*

    https://blackpawn.com/texts/lightmaps/default.html

*/

import { MathUtils } from "../../common/MathUtils";
import * as BSP_Types from "./types";



class Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}



class HDR_Image {
    data: Float32Array = new Float32Array(0);
    width: number = 0;
    height: number = 0;

    constructor(width: number, height: number);
    constructor(data: Float32Array, width: number, height: number);

    constructor() {
        if(arguments.length == 2) {
            this.width = arguments[0];
            this.height = arguments[1];
            this.data = new Float32Array(this.width * this.height * 4);
        } else if(arguments.length == 3) {
            this.data = arguments[0];
            this.width = arguments[1];
            this.height = arguments[2];
        }
    }



    getImageData() {
        const image = new ImageData(this.width, this.height);
        for(let i=0; i < this.data.length; i++) {
            image.data[i] = MathUtils.clamp(this.data[i] * 255, 0, 255);
        }
        return image;
    }

    putImage(image: HDR_Image, offsetX: number, offsetY: number) {

        // TODO: Optimize this!
        // Instead of doing each pixel 1 by 1,
        // Do each horizontal slice.

        for(let x=0; x < image.width; x++) {
            for(let y=0; y < image.height; y++) {

                const ti = ((x + offsetX) + (y + offsetY) * this.width) * 4;
                const ii = (x + y * image.width) * 4;

                this.data[ti+0] = image.data[ii+0];
                this.data[ti+1] = image.data[ii+1];
                this.data[ti+2] = image.data[ii+2];
                this.data[ti+3] = image.data[ii+3];
            }
        }

    }

}



class AtlasNode {

    children: [ (AtlasNode|null), (AtlasNode|null) ] = [ null, null ];

    rect: Rectangle = new Rectangle(0, 0, 1024, 1024);

    image: HDR_Image | null = null;

    constructor(rect: Rectangle = new Rectangle(0, 0, 1024, 1024)) {
        this.rect = rect;
    }

    insert(image: HDR_Image): AtlasNode | null {

        if(this.children[0] != null && this.children[1] != null) {

            const newNode = this.children[0].insert(image);
            if(newNode != null) return newNode;

            return this.children[1].insert(image);

        }

        if(this.image != null) return null;

        if(image.width > this.rect.width || image.height > this.rect.height) {
            return null;
        }

        if(image.width == this.rect.width && image.height == this.rect.height) {
            return this;
        }

        const dw = this.rect.width - image.width;
        const dh = this.rect.height - image.height;

        if(dw > dh) {

            this.children[0] = new AtlasNode(new Rectangle(
                this.rect.x, this.rect.y,
                image.width, this.rect.height
            ));

            this.children[1] = new AtlasNode(new Rectangle(
                this.rect.x + image.width, this.rect.y,
                this.rect.width - image.width, this.rect.height
            ));

        } else {

            this.children[0] = new AtlasNode(new Rectangle(
                this.rect.x, this.rect.y,
                this.rect.width, image.height
            ));
            
            this.children[1] = new AtlasNode(new Rectangle(
                this.rect.x, this.rect.y + image.height,
                this.rect.width, this.rect.height - image.height
            ));

        }

        return this.children[0].insert(image);

    }

    forEachNode(callbackfn: (node: AtlasNode) => void = () => {}) {
        callbackfn(this);

        if(this.children[0] != null) {
            this.children[0].forEachNode(callbackfn);
        }

        if(this.children[1] != null) {
            this.children[1].forEachNode(callbackfn);
        }

    }

    getHDRImage(): HDR_Image {

        const image = new HDR_Image(this.rect.width, this.rect.height);

        this.forEachNode(node => {
            if(node.image == null) return;
            image.putImage(node.image, node.rect.x, node.rect.y);
        });

        return image;

    }

}



export { Rectangle, HDR_Image, AtlasNode };
