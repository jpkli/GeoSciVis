import drawVertSource from 'raw-loader!./DrawVert.vs.glsl';
import drawFragSource from 'raw-loader!./DrawFrag.fs.glsl';
import screenFragSource from 'raw-loader!./ScreenFrag.fs.glsl';
import updateFragSource from 'raw-loader!./UpdateFrag.fs.glsl';
import quadVertSource from 'raw-loader!./QuadVert.vs.glsl';
import * as chromatic from 'd3-scale-chromatic';


function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);

    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

// function createProgram(gl, vertexSource, fragmentSource) {
//     var program = gl.createProgram();

//     var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
//     var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

//     gl.attachShader(program, vertexShader);
//     gl.attachShader(program, fragmentShader);

//     gl.linkProgram(program);
//     if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
//         throw new Error(gl.getProgramInfoLog(program));
//     }

//     var wrapper = {program: program};

//     var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
//     for (var i = 0; i < numAttributes; i++) {
//         var attribute = gl.getActiveAttrib(program, i);
//         wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
//     }
//     var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
//     for (var i$1 = 0; i$1 < numUniforms; i$1++) {
//         var uniform = gl.getActiveUniform(program, i$1);
//         wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
//     }

//     return wrapper;
// }

function createTexture(gl, filter, data, width, height) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    if (data instanceof Uint8Array) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

function bindTexture(gl, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

function createBuffer(gl, data) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

function bindAttribute(gl, buffer, attribute, numComponents) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

function bindFramebuffer(gl, framebuffer, texture) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    if (texture) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}

var defaultRampColors = {
    0.0: '#3288bd',
    0.1: '#66c2a5',
    0.2: '#abdda4',
    0.3: '#e6f598',
    0.4: '#fee08b',
    0.5: '#fdae61',
    0.6: '#f46d43',
    1.0: '#d53e4f'
};

export default class GeoPrint {
  constructor ({
    bound,
    width,
    height,
    dataspd,
    datavel,
    dataDomain,
    colorMap,
    coordinateMap
  }) {
    this.bound_specs = bound;
    this.bound = this.getBoundCoords(bound);
    this.width = width;
    this.height = height;
    this.dataspd = dataspd;
    this.datavel = datavel;
    this.dataDomain = dataDomain;
    this.colorMap = colorMap;
    this.coordinateMap = coordinateMap;
  }

  init (gl) {
    this.gl = gl

    this.fadeOpacity = 0.996; // how fast the particle trails fade on each frame
    this.speedFactor = 0.25; // how fast the particles move
    this.dropRate = 0.003; // how often the particles move to a random place
    this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
    this.numParticles = 50000;

    gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_float_linear');
    let drawVert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(drawVert, drawVertSource);
    gl.compileShader(drawVert);

    let drawFrag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(drawFrag, drawFragSource);
    gl.compileShader(drawFrag);

    let screenFrag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(screenFrag, screenFragSource);
    gl.compileShader(screenFrag);

    let updateFrag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(updateFrag, updateFragSource);
    gl.compileShader(updateFrag);

    let quadVert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(quadVert, quadVertSource);
    gl.compileShader(quadVert);

    this.drawProgram = gl.createProgram();
    gl.attachShader(this.drawProgram, drawVert);
    gl.attachShader(this.drawProgram, drawFrag);
    gl.linkProgram(this.drawProgram)

    gl.validateProgram(this.drawProgram);
    if ( !gl.getProgramParameter( this.drawProgram, gl.LINK_STATUS) ) {
        var info = gl.getProgramInfoLog(this.drawProgram);
        throw 'Could not compile WebGL program. \n\n' + info;
    }

    this.screenProgram = gl.createProgram();
    gl.attachShader(this.screenProgram, quadVert);
    gl.attachShader(this.screenProgram, screenFrag);
    gl.linkProgram(this.screenProgram)

    this.aTexCoord = gl.getAttribLocation(this.screenProgram, "a_tex_coord");
    this.aTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.aTexCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0, 0, 1, 1, 0,
        1, 0, 0, 1, 1, 1
      ]),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.validateProgram(this.screenProgram);
    if ( !gl.getProgramParameter( this.screenProgram, gl.LINK_STATUS) ) {
        info = gl.getProgramInfoLog(this.screenProgram);
        throw 'Could not compile WebGL program. \n\n' + info;
    }

    this.updateProgram = gl.createProgram();
    gl.attachShader(this.updateProgram, quadVert);
    gl.attachShader(this.updateProgram, updateFrag);
    gl.linkProgram(this.updateProgram)

    gl.validateProgram(this.updateProgram);
    if ( !gl.getProgramParameter( this.updateProgram, gl.LINK_STATUS) ) {
        info = gl.getProgramInfoLog(this.updateProgram);
        throw 'Could not compile WebGL program. \n\n' + info;
    }

    this.quadBuffer = createBuffer(gl, this.coordsToPixels());
    this.framebuffer = gl.createFramebuffer();

    this.setColorRamp(defaultRampColors);
    this.resize();
    this.initParticles();
    this.initWind();
  }

    getBoundCoords (bound) {
    return [
      {lng: bound.left, lat: bound.top},
      {lng: bound.left, lat: bound.bottom},
      {lng: bound.right, lat: bound.top},
      {lng: bound.right, lat: bound.top},
      {lng: bound.left, lat: bound.bottom},
      {lng: bound.right, lat: bound.bottom}
    ]
  }

  coordsToPixels () {
    let coords = new Float32Array(this.bound.length * 2);
    console.log(this.bound);
    this.bound.forEach( (b, i) => {
      let coord = (typeof this.coordinateMap === 'function') 
        ? this.coordinateMap(b)
        : ((b) => { return {x: b.lng, y: b.lat} })(b);
      coords[i*2] = coord.x;
      coords[i*2+1] = coord.y;
    })
    return coords;
  }

  setColorRamp(colors) {
    // lookup texture for colorizing the particles according to their speed
    this.colorRampTexture = createTexture(this.gl, this.gl.LINEAR, this.getColorRamp(colors), 16, 16);
  }

  resize() {
    var gl = this.gl;
    var emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    // screen textures to hold the drawn screen for the previous and the current frame
    this.backgroundTexture = createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
    this.screenTexture = createTexture(gl, gl.NEAREST, emptyPixels, gl.canvas.width, gl.canvas.height);
  }

  initParticles() {
    var gl = this.gl;

    // we create a square texture where each pixel will hold a particle position encoded as RGBA
    var particleRes = this.particleStateResolution = Math.ceil(Math.sqrt(this.numParticles));
    this._numParticles = particleRes * particleRes;

    var particleState = new Uint8Array(this._numParticles * 4);
    for (var i = 0; i < particleState.length; i++) {
        particleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
    }
    // textures to hold the particle state for the current and the next frame
    this.particleStateTexture0 = createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);
    this.particleStateTexture1 = createTexture(gl, gl.NEAREST, particleState, particleRes, particleRes);

    var particleIndices = new Float32Array(this._numParticles);
    for (var i$1 = 0; i$1 < this._numParticles; i$1++) { particleIndices[i$1] = i$1; }
    this.particleIndexBuffer = createBuffer(gl, particleIndices);
  }

  initWind() {
    var gl = this.gl;

    let texture = gl.createTexture();
    let colorBuf = new Uint8ClampedArray(4 * this.width * this.height);
    for (let j = 0; j < this.height; j++) {
        for (let i = 0; i < this.width; i++) {
            colorBuf[(j * this.width + i) * 4 + 2] = 0;
            colorBuf[(j * this.width + i) * 4 + 3] = 255;
            if (this.datavel[(j * this.width + i) * 2] < this.dataDomain[0][0] || this.datavel[(j * this.width + i) * 2] > this.dataDomain[0][1]) {
                colorBuf[(j * this.width + i) * 4] = 0;
                colorBuf[(j * this.width + i) * 4 + 3] = 0;
            }
            else {
                colorBuf[(j * this.width + i) * 4] = Math.floor(255 * (this.datavel[(j * this.width + i) * 2] - this.dataDomain[0][0]) / (this.dataDomain[0][1] - this.dataDomain[0][0]));
            }

            if (this.datavel[(j * this.width + i) * 2 + 1] < this.dataDomain[1][0] || this.datavel[(j * this.width + i) * 2 + 1] > this.dataDomain[1][1]) {
                colorBuf[(j * this.width + i) * 4 + 1] = 0;
                colorBuf[(j * this.width + i) * 4 + 3] = 0;
            }
            else {
                colorBuf[(j * this.width + i) * 4 + 1] = Math.floor(255 * (this.datavel[(j * this.width + i) * 2 + 1] - this.dataDomain[1][0]) / (this.dataDomain[1][1] - this.dataDomain[1][0]));
            }
            
        }
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorBuf)
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.windTexture = texture;
  }

  getColorRamp(colors) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = 256;
    canvas.height = 1;

    var gradient = ctx.createLinearGradient(0, 0, 256, 0);
    for (var stop in colors) {
        gradient.addColorStop(+stop, colors[stop]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
  }

  createColorTexture (resolution = 512) {
    let gl = this.gl
    let texture = gl.createTexture();
    let colorBuf = new Uint8Array(3 * resolution)
    let colorMap = chromatic['interpolate' + this.colorMap] || chromatic.interpolateTurbo;
    for (let i = 0; i < resolution; i++) {
      let rgb = colorMap(i / resolution).slice(4,-1).split(',').map(d => parseInt(d));
      // .map(d => parseInt(d));
      // console.log(rgb)
      colorBuf[i * 3] = rgb[0];
      colorBuf[i * 3 + 1] = rgb[1];
      colorBuf[i * 3 + 2] = rgb[2];
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, resolution, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, colorBuf)
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture
  }

  setMatrix(matrix) {
    this.matrix = matrix;
  }

  draw() {
    var gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.particleStateTexture0, 1);
    this.drawScreen();
    this.updateParticles();
  }

  drawScreen() {
    var gl = this.gl;
    // draw the screen into a temporary framebuffer to retain it as the background on the next frame
    //bindFramebuffer(gl, this.framebuffer, this.screenTexture);
    //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    //this.drawTexture(this.backgroundTexture, this.fadeOpacity);
    //this.drawParticles();
    
    //bindFramebuffer(gl, null);
    //gl.viewport(this.bound_specs.left, this.bound_specs.bottom, Math.abs(this.bound_specs.right - this.bound_specs.left), Math.abs(this.bound_specs.bottom - this.bound_specs.top));
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // enable blending to support drawing on top of an existing background (e.g. a map)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.drawTexture(this.windTexture, 1.0);
    gl.disable(gl.BLEND);

    //gl.viewport(this.bound_specs.left, this.bound_specs.bottom, Math.abs(this.bound_specs.right - this.bound_specs.left), Math.abs(this.bound_specs.bottom - this.bound_specs.top));

    // save the current screen as the background for the next frame
    var temp = this.backgroundTexture;
    this.backgroundTexture = this.screenTexture;
    this.screenTexture = temp;
  }

  drawTexture(texture, opacity) {
    var gl = this.gl;
    var program = this.screenProgram;
    gl.useProgram(program);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMatrix"), false, this.matrix);
    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);
    bindTexture(gl, texture, 2);
    gl.uniform1i(gl.getUniformLocation(program, "u_screen"), 2);
    gl.uniform1f(gl.getUniformLocation(program, "u_opacity"), opacity);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.aTexCoordBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawParticles() {
    var gl = this.gl;
    var program = this.drawProgram;
    gl.useProgram(program);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMatrix"), false, this.matrix);
    bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);
    bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(gl.getUniformLocation(program, "u_wind"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "u_particles"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "u_color_ramp"), 2);

    gl.uniform1f(gl.getUniformLocation(program, "u_particles_res"), this.particleStateResolution);
    gl.uniform2f(gl.getUniformLocation(program, "u_wind_min"), this.dataDomain[0][0], this.dataDomain[1][0]);
    gl.uniform2f(gl.getUniformLocation(program, "u_wind_max"), this.dataDomain[0][1], this.dataDomain[1][1]);
    gl.uniform2f(gl.getUniformLocation(program, "u_bound_min"), this.bound_specs.left, this.bound_specs.bottom);
    gl.uniform2f(gl.getUniformLocation(program, "u_bound_max"), this.bound_specs.right, this.bound_specs.top);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }

  updateParticles() {
    var gl = this.gl;
    bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
    gl.viewport(0, 0, this.particleStateResolution, this.particleStateResolution);

    var program = this.updateProgram;
    gl.useProgram(program);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uMatrix"), false, this.matrix);
    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(program.u_wind_res, this.width, this.height);
    gl.uniform2f(program.u_wind_min, this.dataDomain[0][0], this.dataDomain[1][0]);
    gl.uniform2f(program.u_wind_max, this.dataDomain[0][1], this.dataDomain[1][1]);
    gl.uniform1f(program.u_speed_factor, this.speedFactor);
    gl.uniform1f(program.u_drop_rate, this.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);
-
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // swap the particle state textures so the new one becomes the current one
    var temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;
  }

}