import { shaderCommonUtil } from "./shaderCommonUtil.js"

const fragmentShaderSource = `#version 300 es
  precision mediump float;

  uniform sampler2D uSampler;
  out vec4 fragColor;

  ${shaderCommonUtil.commonUtilSource}

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
    if (kind == CellKindWire && subKind == CellWireKindNormal) {
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
    if (kind == CellKindIn) {
      bool signaled = false;
      if (subKind == CellInKindAnd) {
        signaled = (
          (tKind == CellKindWire ? tSignalB : true) &&
          (bKind == CellKindWire ? bSignalT : true) &&
          (rKind == CellKindWire ? rSignalL : true) &&
          (lKind == CellKindWire ? lSignalR : true)
        );
      } else if (subKind == CellInKindOr) {
        signaled = (
          (tKind == CellKindWire && tSignalB) ||
          (bKind == CellKindWire && bSignalT) ||
          (rKind == CellKindWire && rSignalL) ||
          (lKind == CellKindWire && lSignalR)
        );
      } else if (subKind == CellInKindXor) {
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
        (tKind == CellKindIn && tSignalB) ||
        (bKind == CellKindIn && bSignalT) ||
        (rKind == CellKindIn && rSignalL) ||
        (lKind == CellKindIn && lSignalR)
      );
      bool signal = (subKind == CellOutKindNot) ? !signaled : signaled;
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

class UpdateShader {
  program;
  initialize(gl) {
    this.program = shaderCommonUtil.createProgram(
      gl,
      shaderCommonUtil.vertexShaderForEntireSurfaceSource,
      fragmentShaderSource
    );
  }
};

export const updateShader = new UpdateShader();

