varying vec2 vUv;
attribute vec2 luv;
varying vec2 vLuv;

void main() {
    vUv = uv;
    vLuv = luv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}