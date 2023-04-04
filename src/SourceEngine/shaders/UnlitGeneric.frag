varying vec2 vUv;

uniform sampler2D u_basetexture;

void main() {
    gl_FragColor = texture2D(u_basetexture, vUv);
}