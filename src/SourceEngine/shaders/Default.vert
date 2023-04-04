attribute vec3 color;
varying vec3 vColor;
attribute vec2 luv;
varying vec2 vLuv;

void main() {
    vColor = color;
    vLuv = luv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}