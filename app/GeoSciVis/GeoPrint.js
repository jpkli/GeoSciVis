import vertexSource from 'raw-loader!./GeoPrint.vs.glsl';
import fragmentSource from 'raw-loader!./GeoPrint.fs.glsl';
import * as chromatic from 'd3-scale-chromatic';

export default class GeoPrint {
  constructor ({
    bound,
    width,
    height,
    data,
    dataDomain,
    colorMap,
    coordinateMap
  }) {
    this.bound = this.getBoundCoords(bound);

    this.width = width;
    this.height = height;
    this.data = data;
    this.dataDomain = dataDomain;
    this.colorMap = colorMap;
    this.coordinateMap = coordinateMap;
  }

  init (gl) {
    this.gl = gl
    gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_float_linear');
    let vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    this.aPos = gl.getAttribLocation(this.program, "aPos");
    this.aPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.aPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.coordsToPixels(), gl.STATIC_DRAW);
    this.aTexCoord = gl.getAttribLocation(this.program, "aTexCoord");
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
    this.dataTexObj = this.createDataTexture()
    this.colorTexObj = this.createColorTexture();
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
    let coords = new Float32Array(this.bound.length * 2)
    this.bound.forEach( (b, i) => {
      let coord = (typeof this.coordinateMap === 'function')
        ? this.coordinateMap(b)
        : ((b) => { return {x: b.lng, y: b.lat} })(b);
      coords[i*2] = coord.x;
      coords[i*2+1] = coord.y;
    })
    return coords;
  }

  createDataTexture () {
    let gl = this.gl
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, this.width, this.height, 0, gl.ALPHA, gl.FLOAT,
      new Float32Array(this.data))
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
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

  render (matrix) {
    let gl = this.gl
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uMatrix"), false, matrix);
    gl.uniform2fv(gl.getUniformLocation(this.program, "uDataDomain"), new Float32Array(this.dataDomain));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.aPosBuffer);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.aTexCoordBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

    let uDataSamplerLocation = gl.getUniformLocation(this.program, "uDataSampler");
    let uColorSamplerLocation = gl.getUniformLocation(this.program, "uColorSampler");

    gl.uniform1i(uDataSamplerLocation, 0);
    gl.uniform1i(uColorSamplerLocation, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexObj);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexObj)

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}