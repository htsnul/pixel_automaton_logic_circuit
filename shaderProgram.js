const vertexShaderForEntireSurfaceSource = `#version 300 es

  void main() {
    gl_Position = vec4(0.0, 0.0, 0.0, 1);
    gl_PointSize = 512.0;
  }
`;

const commonUtilSource = `
  const int CellKindNone = 0;
  const int CellKindWire = 1;
  const int CellKindComponent = 2;
  const int CellKindOut = 3;
  const int CellWireKindWire = 0;
  const int CellWireKindCross = 1;
  const int CellWireKindOne = 2;
  const int CellComponentKindAnd = 0;
  const int CellComponentKindOr = 1;
  const int CellComponentKindXor = 2;
  const int CellOutKindOut = 0;
  const int CellOutKindInvOut = 1;

  int cellValueFromColorComponent(float col) { return int(255.0 * col + 0.5); }
  float cellValueToColorComponent(int val) { return float(val) / 255.0; }

  int getCellKind(int val) { return val / 64; }
  int getCellSubKind(int val) { return val / 16 % 4; }
  bool getCellSignalT(int val) { return bool(val / 8 % 2); }
  bool getCellSignalR(int val) { return bool(val / 4 % 2); }
  bool getCellSignalB(int val) { return bool(val / 2 % 2); }
  bool getCellSignalL(int val) { return bool(val % 2); }

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

const fragmentShaderForUpdateSource = `#version 300 es
  precision mediump float;

  uniform sampler2D uSampler;
  out vec4 fragColor;

  ${commonUtilSource}

  void main() {
    const float texW = 512.0f;
    vec4 col = texture(uSampler, gl_FragCoord.xy / texW);
    int cellVal = cellValueFromColorComponent(col[0]);
    int kind = getCellKind(cellVal);
    if (kind == CellKindNone) {
      fragColor[0] = 0.0;
      return;
    }
    int subKind = getCellSubKind(cellVal);
    vec4 colT = texture(uSampler, (gl_FragCoord.xy + vec2(+0.0, +1.0)) / texW);
    vec4 colR = texture(uSampler, (gl_FragCoord.xy + vec2(+1.0, +0.0)) / texW);
    vec4 colB = texture(uSampler, (gl_FragCoord.xy + vec2(+0.0, -1.0)) / texW);
    vec4 colL = texture(uSampler, (gl_FragCoord.xy + vec2(-1.0, +0.0)) / texW);
    int cellValT = cellValueFromColorComponent(colT[0]);
    int cellValR = cellValueFromColorComponent(colR[0]);
    int cellValB = cellValueFromColorComponent(colB[0]);
    int cellValL = cellValueFromColorComponent(colL[0]);
    int tKind = getCellKind(cellValT);
    int tSubKind = getCellSubKind(cellValT);
    bool tSignalB = getCellSignalB(cellValT);
    int rKind = getCellKind(cellValR);
    int rSubKind = getCellSubKind(cellValR);
    bool rSignalL = getCellSignalL(cellValR);
    int bKind = getCellKind(cellValB);
    int bSubKind = getCellSubKind(cellValB);
    bool bSignalT = getCellSignalT(cellValB);
    int lKind = getCellKind(cellValL);
    int lSubKind = getCellSubKind(cellValL);
    bool lSignalR = getCellSignalR(cellValL);
    if (kind == CellKindWire && subKind == CellWireKindWire) {
      bool signaled = tSignalB || bSignalT || rSignalL || lSignalR;
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind,
        signaled && !tSignalB,
        signaled && !rSignalL,
        signaled && !bSignalT,
        signaled && !lSignalR
      ));
      return;
    }
    if (kind == CellKindWire && subKind == CellWireKindCross) {
      bool signaledV = tSignalB || bSignalT;
      bool signaledH = rSignalL || lSignalR;
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind,
        signaledV && !tSignalB,
        signaledH && !rSignalL,
        signaledV && !bSignalT,
        signaledH && !lSignalR
      ));
      return;
    }
    if (kind == CellKindWire && subKind == CellWireKindOne) {
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind, true, true, true, true
      ));
      return;
    }
    if (kind == CellKindComponent) {
      bool signaled = false;
      if (subKind == CellComponentKindAnd) {
        signaled = (
          (tKind == CellKindWire ? tSignalB : true) &&
          (bKind == CellKindWire ? bSignalT : true) &&
          (rKind == CellKindWire ? rSignalL : true) &&
          (lKind == CellKindWire ? lSignalR : true)
        );
      } else if (subKind == CellComponentKindOr) {
        signaled = (
          (tKind == CellKindWire && tSignalB) ||
          (bKind == CellKindWire && bSignalT) ||
          (rKind == CellKindWire && rSignalL) ||
          (lKind == CellKindWire && lSignalR)
        );
      } else if (subKind == CellComponentKindXor) {
        signaled = (
          ((tKind == CellKindWire && tSignalB) ? 1 : 0) +
          ((bKind == CellKindWire && bSignalT) ? 1 : 0) +
          ((rKind == CellKindWire && rSignalL) ? 1 : 0) +
          ((lKind == CellKindWire && lSignalR) ? 1 : 0)
        ) % 2 == 1;
      }
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind,
        signaled && tKind == CellKindOut,
        signaled && rKind == CellKindOut,
        signaled && bKind == CellKindOut,
        signaled && lKind == CellKindOut
      ));
      return;
    }
    if (kind == CellKindOut) {
      bool signaled = (
        (tKind == CellKindComponent && tSignalB) ||
        (bKind == CellKindComponent && bSignalT) ||
        (rKind == CellKindComponent && rSignalL) ||
        (lKind == CellKindComponent && lSignalR)
      );
      bool signal = (subKind == CellOutKindInvOut) ? !signaled : signaled;
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind,
        signal && tKind == CellKindWire,
        signal && rKind == CellKindWire,
        signal && bKind == CellKindWire,
        signal && lKind == CellKindWire
      ));
      return;
    }
  }
`;

const fragmentShaderForEditSource = `#version 300 es
  precision mediump float;

  uniform sampler2D uSampler;
  uniform vec2 uPosition;
  uniform int uCellValue;
  out vec4 fragColor;

  ${commonUtilSource}

  void main() {
    const float texW = 512.0f;
    vec4 col = texture(uSampler, gl_FragCoord.xy / texW);
    int cellVal = cellValueFromColorComponent(col[0]);
    if (gl_FragCoord.xy != uPosition) {
      fragColor[0] = cellValueToColorComponent(cellVal);
      return;
    }
    fragColor[0] = cellValueToColorComponent(uCellValue);
  }
`;

const fragmentShaderForRenderSource = `#version 300 es
  precision mediump float;

  uniform sampler2D uSampler;
  uniform float uWidth;
  uniform vec2 uPosition;
  uniform float uScale;

  out vec4 fragColor;

  ${commonUtilSource}

  void main() {
    vec4 col = texture(
      uSampler,
      (gl_FragCoord.xy - 0.5 * uWidth) / (uWidth * uScale) - uPosition / uWidth
    );
    int cellVal = cellValueFromColorComponent(col[0]);
    int kind = getCellKind(cellVal);
    int subKind = getCellSubKind(cellVal);
    bool signaling = (
      getCellSignalT(cellVal) ||
      getCellSignalR(cellVal) ||
      getCellSignalB(cellVal) ||
      getCellSignalL(cellVal)
    );
    vec4 normalColor = vec4(0.2, 0.2, 0.2, 1.0);
    vec4 signalColor = vec4(0.2, 0.2, 0.2, 1.0);
    if (kind == CellKindWire && subKind == CellWireKindWire) {
      normalColor = vec4(0.5, 0.5, 0.5, 1.0);
      signalColor = vec4(0.75, 0.75, 0.75, 1.0);
    } else if (kind == CellKindWire && subKind == CellWireKindCross) {
      normalColor = vec4(0.4, 0.7, 0.4, 1.0);
      signalColor = vec4(0.8, 0.9, 0.8, 1.0);
    } else if (kind == CellKindWire && subKind == CellWireKindOne) {
      normalColor = vec4(0.6, 0.6, 0.6, 1.0);
      signalColor = vec4(1.0, 1.0, 1.0, 1.0);
    } else if (kind == CellKindComponent && subKind == CellComponentKindAnd) {
      normalColor = vec4(1.0, 0.8, 0.5, 1.0);
      signalColor = normalColor;
    } else if (kind == CellKindComponent && subKind == CellComponentKindOr) {
      normalColor = vec4(0.3, 0.7, 1.0, 1.0);
      signalColor = normalColor;
    } else if (kind == CellKindComponent && subKind == CellComponentKindXor) {
      normalColor = vec4(1.0, 0.25, 1.0, 1.0);
      signalColor = normalColor;
    } else if (kind == CellKindOut && subKind == CellOutKindOut) {
      normalColor = vec4(0.4, 0.4, 1.0, 1.0);
      signalColor = normalColor;
    } else if (kind == CellKindOut && subKind == CellOutKindInvOut) {
      normalColor = vec4(0.8, 0.4, 0.4, 1.0);
      signalColor = normalColor;
    }
    fragColor = mix(normalColor, signalColor, signaling ? 1.0 : 0.0);
  }
`;

class ShaderProgram {
  programForUpdate = undefined;
  programForEdit = undefined;
  programForRender = undefined;
  initialize(gl) {
    this.programForUpdate = this.#createProgram(
      gl,
      vertexShaderForEntireSurfaceSource,
      fragmentShaderForUpdateSource
    );
    this.programForEdit = this.#createProgram(
      gl,
      vertexShaderForEntireSurfaceSource,
      fragmentShaderForEditSource
    );
    this.programForRender = this.#createProgram(
      gl,
      vertexShaderForEntireSurfaceSource,
      fragmentShaderForRenderSource
    );
  }
  #createProgram(gl, vertexShaderSource, fragmentShaderSource) {
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

export const shaderProgram = new ShaderProgram();


