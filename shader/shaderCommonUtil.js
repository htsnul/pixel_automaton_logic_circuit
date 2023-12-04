const vertexShaderForEntireSurfaceSource = `#version 300 es

  void main() {
    gl_Position = vec4(0.0, 0.0, 0.0, 1);
    gl_PointSize = 512.0;
  }
`;

const commonUtilSource = `
  const int CellKindNone = 0;
  const int CellKindWire = 1;
  const int CellKindIn = 2;
  const int CellKindOut = 3;
  const int CellWireKindNormal = 0;
  const int CellWireKindCross = 1;
  const int CellWireKindOne = 2;
  const int CellInKindAnd = 0;
  const int CellInKindOr = 1;
  const int CellInKindXor = 2;
  const int CellOutKindNormal = 0;
  const int CellOutKindNot = 1;

  int cellValueFromColorComponent(float col) { return int(255.0 * col + 0.5); }
  float cellValueToColorComponent(int val) { return float(val) / 255.0; }

  int getCellKind(int val) { return (val >> 6) & 0x3; }
  int getCellSubKind(int val) { return (val >> 4) & 0x3; }
  bool getCellSignalT(int val) { return bool((val >> 3) & 0x1); }
  bool getCellSignalR(int val) { return bool((val >> 2) & 0x1); }
  bool getCellSignalB(int val) { return bool((val >> 1) & 0x1); }
  bool getCellSignalL(int val) { return bool((val >> 0) & 0x1); }

  int makeCellValue(
    int kind, int subKind,
    bool signalT, bool signalR, bool signalB, bool signalL
  ) {
    return (
      kind * 64 +
      subKind * 16 +
      (signalT ? 8 : 0) +
      (signalR ? 4 : 0) +
      (signalB ? 2 : 0) +
      (signalL ? 1 : 0)
    );
  }
`;

export const shaderCommonUtil = {
  vertexShaderForEntireSurfaceSource,
  commonUtilSource,
  createProgram: (gl, vertexShaderSource, fragmentShaderSource) => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(fragmentShader));
    }
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const linkErrLog = gl.getProgramInfoLog(program);
      alert(linkErrLog);
    }
    return program;
  }
};

