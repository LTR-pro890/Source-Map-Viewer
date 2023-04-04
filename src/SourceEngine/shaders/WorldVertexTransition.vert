varying vec2 vUv;
attribute vec2 luv;
varying vec2 vLuv;

attribute float alpha;
varying float fAlpha;

void main() {
    vUv = uv;
    vLuv = luv;
    fAlpha = alpha;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}