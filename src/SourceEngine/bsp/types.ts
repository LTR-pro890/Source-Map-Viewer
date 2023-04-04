
import { AtlasNode } from "./atlas";



/**
 * An infinite plane pointing at a direction at a distance.  
 */
export type Plane = {
    normal: THREE.Vector3;
    dist: number;
    type: number;
}



/**
 * A position in 3d space.  
 */
export type Vertex = THREE.Vector3;



/**
 * An edge connecting 2 vertices.  
 * Index into vertices array.  
 */
export type Edge = [ number, number ];



/**
 * Index into edge array.  
 * If is negative it will use second vertex of the edge instead of the first.  
 */
export type Surfedge = number;



export type Face = {
    /** The plane this face is on. */
    planeNum: number;
    side: number;
    onNode: boolean;
    /** First surfedge of this face. */
    firstEdge: number;
    /** Number of surfedges on this face. */
    numEdges: number;
    /** Texture information. */
    texInfo: number;
    /** Displacement information. (-1 for not a displacement.) */
    dispInfo: number;
    surfaceFogVolumeID: number;
    /** Switchable lighting information. */
    styles: [ number, number, number, number ];
    /** Light offset into LIGHTING lump (Offset not index.) */
    lightOffset: number;
    /** Area of face in units^2 */
    area: number;
    lightmapTextureMinsInLuxels: [ number, number ];
    lightmapTextureSizeInLuxels: [ number, number ];
    /** Original face this was split from (-1 for none.) */
    origFace: number;
    numPrimitives: number;
    firstPrimitiveID: number;
    smoothingGroups: number;
}



export type TexVec = [ [ number, number, number, number ], [ number, number, number, number ] ];

export type TexInfo = {
    textureVecs: TexVec;
    lightmapVecs: TexVec;
    flags: number;
    /** Texture data (Texture path, reflectivity) */
    texData: number;
}



export type TexData = {
    /** Reflectivity color for lighting. */
    reflectivity: THREE.Color;
    nameStringTableID: number;
    width: number;
    height: number;
    view_width: number;
    view_height: number;
}



/** Offsets into the TexDataStringTable lump for material paths. */
export type TexDataStringTable = number;



/** Material paths seperated by null bytes. (path.toLowerCase() is required.) */
export type TexDataStringData = string;



export type DispSubNeighbor = {
    neighbor: number;
    neighborOrientation: number;
    span: number;
    neighborSpan: number;
}



export type DispNeighbor = [ DispSubNeighbor, DispSubNeighbor ];



export type DispCornerNeighbor = {
    neighbors: [ number, number, number, number ];
    numNeighbors: number;
}



export type DispInfo = {
    startPos: THREE.Vector3;
    /** Starting displacement vertex. */
    dispVertStart: number;
    /** Starting displacement triangle. */
    dispTriStart: number;
    /** Power of displacement (2 ^ power) */
    power: number;
    minTess: number;
    smoothingAngle: number;
    contents: number;
    /** Face of this displacement. */
    mapFace: number;
    lightmapAlphaStart: number;
    lightmapSamplePositionStart: number;
    edgeNeighbors: [ DispNeighbor, DispNeighbor ];
    cornerNeighbors: [ DispCornerNeighbor, DispCornerNeighbor, DispCornerNeighbor, DispCornerNeighbor ];
    allowedVerts: number[];
}



export type DispVert = {
    vec: THREE.Vector3;
    dist: number;
    alpha: number;
}



export type ColorRGBExp = {
    r: number;
    g: number;
    b: number;
    exp: number;
}


