precision mediump float;
uniform mat4 uMatrix;
attribute vec2 a_pos;
attribute vec2 a_tex_coord;
varying vec2 v_tex_pos;
void main() {
    v_tex_pos = 1.0 - a_tex_coord;
    gl_Position = uMatrix * vec4(a_pos, 0, 1);
}