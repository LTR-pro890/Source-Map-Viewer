varying vec2 vUv;
varying vec2 vLuv;

uniform sampler2D u_basetexture1;
uniform sampler2D u_basetexture2;

varying float fAlpha;

uniform sampler2D u_lightmap;

void main() {
    vec4 col1 = texture2D(u_basetexture1, vUv);
    vec4 col2 = texture2D(u_basetexture2, vUv);
    
#ifdef LIGHTMAP
    gl_FragColor = mix(col1, col2, fAlpha) * texture2D(u_lightmap, vLuv) * 2.0;
#else
    gl_FragColor = mix(col1, col2, fAlpha);
#endif
}