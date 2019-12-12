precision highp float;
// uniform vec2 u_dim;
uniform sampler2D uDataSampler;
uniform sampler2D uColorSampler;
uniform vec2 uDataDomain;
varying vec2 vTexCoord;
void main() {
  float val = texture2D(uDataSampler, vTexCoord).a;
  if (val < 0.0) {
    // gl_FragColor = vec4(0.0, 0.0, 0.0, 0.5);
    discard;
  } else {
    float alpha = (val - uDataDomain[0]) / (uDataDomain[1] - uDataDomain[0]);
    vec3 rgb = texture2D(uColorSampler, vec2(alpha, 0.0)).rgb;
    gl_FragColor = vec4(rgb, 1.0);
  }
}