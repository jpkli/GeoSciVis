uniform mat4 uMatrix;
attribute vec2 aPos;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  gl_Position = uMatrix * vec4(aPos, 0.0, 1.0);
  vTexCoord = aTexCoord;
}