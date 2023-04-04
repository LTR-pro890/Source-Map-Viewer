varying vec2 vUv;
varying vec2 vLuv;

uniform sampler2D u_basetexture;

uniform sampler2D u_lightmap;

void main() {
#ifdef LIGHTMAP
    gl_FragColor = texture2D(u_basetexture, vUv) * texture2D(u_lightmap, vLuv) * 2.0;
#else
    gl_FragColor = texture2D(u_basetexture, vUv);
#endif
}