varying vec3 vColor;
varying vec2 vLuv;

uniform sampler2D u_lightmap;

void main() {
#ifdef LIGHTMAP
    gl_FragColor = vec4(vColor, 1.0) * texture2D(u_lightmap, vLuv) * 2.0;
#else
    gl_FragColor = vec4(vColor, 1.0);
#endif
}