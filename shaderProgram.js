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

  int CommandKindDraw = 0;
  int CommandKindEarth = 1;
  int CommandKindSignal = 2;
  int CommandKindPaste = 3;

  uniform sampler2D uSampler;
  uniform sampler2D uClipboardSampler;
  uniform int uCommandKind;
  uniform vec2 uPosition;
  uniform vec2 uSize;
  uniform int uCellValue;

  out vec4 fragColor;

  ${commonUtilSource}

  void main() {
    const float texW = 512.0f;
    vec4 col = texture(uSampler, gl_FragCoord.xy / texW);
    int cellVal = cellValueFromColorComponent(col[0]);
    if (uCommandKind == CommandKindDraw) {
      if (gl_FragCoord.xy != uPosition) {
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      fragColor[0] = cellValueToColorComponent(uCellValue);
      return;
    }
    if (uCommandKind == CommandKindEarth) {
      int kind = getCellKind(cellVal);
      int subKind = getCellSubKind(cellVal);
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind, false, false, false, false
      ));
      return;
    }
    if (uCommandKind == CommandKindSignal) {
      if (gl_FragCoord.xy != uPosition) {
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      int kind = getCellKind(cellVal);
      int subKind = getCellSubKind(cellVal);
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind, true, true, true, true
      ));
      return;
    }
    if (uCommandKind == CommandKindPaste) {
      if (
        (
          (uPosition.x <= gl_FragCoord.x && gl_FragCoord.x < uPosition.x + uSize.x) ||
          (uPosition.x <= gl_FragCoord.x + texW && gl_FragCoord.x + texW < uPosition.x + uSize.x)
        ) && (
          (uPosition.y <= gl_FragCoord.y && gl_FragCoord.y < uPosition.y + uSize.y) ||
          (uPosition.y <= gl_FragCoord.y + texW && gl_FragCoord.y + texW < uPosition.y + uSize.y)
        )
      ) {
        vec4 col = texture(uClipboardSampler, (gl_FragCoord.xy - uPosition) / texW);
        int cellVal = cellValueFromColorComponent(col[0]);
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      fragColor[0] = cellValueToColorComponent(cellVal);
      return;
    }
  }
`;

const fragmentShaderForRenderSource = `#version 300 es
  precision mediump float;

  uniform sampler2D uSampler;
  uniform sampler2D uClipboardSampler;
  uniform float uWidth;
  uniform vec2 uPosition;
  uniform float uScale;
  uniform bool uOverlayCellIsEnabled;
  uniform vec2 uOverlayCellPosition;
  uniform int uOverlayCellValue;
  uniform bool uSelectionIsEnabled;
  uniform vec2 uSelectionRectPosition;
  uniform vec2 uSelectionRectSize;
  uniform bool uOverlayPasteIsEnabled;
  uniform vec2 uOverlayPastePosition;

  out vec4 fragColor;

  ${commonUtilSource}

  vec2 getPositionInTexture() {
    return (gl_FragCoord.xy - 0.5 * uWidth) / uScale - uPosition;
  }

  void main() {
    vec2 posInTex = getPositionInTexture();
    posInTex = mod(posInTex, uWidth);
    vec4 col = texture(uSampler, posInTex / uWidth);
    int cellVal = cellValueFromColorComponent(col[0]);
    if (uOverlayCellIsEnabled && floor(posInTex) + vec2(0.5) == uOverlayCellPosition) {
      cellVal = uOverlayCellValue;
    }
    vec2 selectionRectBegin = uSelectionRectPosition;
    vec2 selectionRectEnd = uSelectionRectPosition + uSelectionRectSize;
    if (
      uSelectionIsEnabled &&
      (int(posInTex.x) + int(posInTex.y)) % 2 == 0 && (
        (
          (
            floor(posInTex.y) == selectionRectBegin.y ||
            ceil(posInTex.y) == selectionRectEnd.y ||
            floor(posInTex.y + uWidth) == selectionRectBegin.y ||
            ceil(posInTex.y + uWidth) == selectionRectEnd.y
          ) && (
            (
              selectionRectBegin.x <= posInTex.x &&
              posInTex.x <= selectionRectEnd.x
            ) || (
              selectionRectBegin.x <= posInTex.x + uWidth &&
              posInTex.x + uWidth <= selectionRectEnd.x
            )
          )
        ) || (
          (
            floor(posInTex.x) == selectionRectBegin.x ||
            ceil(posInTex.x) == selectionRectEnd.x ||
            floor(posInTex.x + uWidth) == selectionRectBegin.x ||
            ceil(posInTex.x + uWidth) == selectionRectEnd.x
          ) && (
            (
              selectionRectBegin.y <= posInTex.y &&
              posInTex.y <= selectionRectEnd.y
            ) || (
              selectionRectBegin.y <= posInTex.y + uWidth &&
              posInTex.y + uWidth <= selectionRectEnd.y
            )
          )
        )
      )
    ) {
      cellVal = makeCellValue(CellKindWire, CellWireKindWire, true, true, true, true);
    }
    if (uOverlayPasteIsEnabled) {
      vec2 size = uSelectionRectSize;
      if (
        (
          (
            uOverlayPastePosition.x <= floor(posInTex.x) + 0.5 &&
            floor(posInTex.x) + 0.5 <= uOverlayPastePosition.x + size.x
          ) || (
            uOverlayPastePosition.x <= floor(posInTex.x + uWidth) + 0.5 &&
            floor(posInTex.x + uWidth) + 0.5 <= uOverlayPastePosition.x + size.x
          )
        ) && (
          (
            uOverlayPastePosition.y <= floor(posInTex.y) + 0.5 &&
            floor(posInTex.y) + 0.5 <= uOverlayPastePosition.y + size.y
          ) || (
            uOverlayPastePosition.y <= floor(posInTex.y + uWidth) + 0.5 &&
            floor(posInTex.y + uWidth) + 0.5 <= uOverlayPastePosition.y + size.y
          )
        )
      ) {
        vec4 col = texture(uClipboardSampler, (posInTex - uOverlayPastePosition + vec2(0.5)) / uWidth);
        cellVal = cellValueFromColorComponent(col[0]);
      }
    }
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
  doEditCommand(
    gl, fb, tex, kind,
    { position, size, cellValue, clipboardTexture }
  ) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.useProgram(this.programForEdit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const kindInt = (() => {
      switch (kind) {
        case "Draw": return 0;
        case "Earth": return 1;
        case "Signal": return 2;
        case "Paste": return 3;
      }
    })();
    gl.uniform1i(gl.getUniformLocation(this.programForEdit, "uSampler"), 0);
    gl.uniform1i(gl.getUniformLocation(this.programForEdit, "uCommandKind"), kindInt);
    if (position) {
      gl.uniform2fv(gl.getUniformLocation(this.programForEdit, "uPosition"), [position.x, position.y]);
    }
    if (size) {
      gl.uniform2fv(gl.getUniformLocation(this.programForEdit, "uSize"), [size.x, size.y]);
    }
    if (cellValue) {
      gl.uniform1i(gl.getUniformLocation(this.programForEdit, "uCellValue"), cellValue);
    }
    if (clipboardTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, clipboardTexture);
      gl.uniform1i(gl.getUniformLocation(shaderProgram.programForEdit, "uClipboardSampler"), 1);
      gl.activeTexture(gl.TEXTURE0);
    }
    gl.drawArrays(gl.POINTS, 0, 1);
  };
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


