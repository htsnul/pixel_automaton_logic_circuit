import { shaderCommonUtil } from "./shaderCommonUtil.js"

const fragmentShaderSource = `#version 300 es
  precision mediump float;

  uniform sampler2D uSampler;
  uniform sampler2D uClipboardSampler;
  uniform float uWidth;
  uniform vec2 uPosition;
  uniform float uScale;
  uniform bool uOverlayCellIsEnabled;
  uniform vec2 uOverlayCellPosition;
  uniform int uOverlayCellValue;
  uniform bool uOverlaySignalIsEnabled;
  uniform vec2 uOverlaySignalPosition;
  uniform bool uSelectionIsEnabled;
  uniform vec2 uSelectionRectPosition;
  uniform vec2 uSelectionRectSize;
  uniform bool uOverlayPasteIsEnabled;
  uniform vec2 uOverlayPastePosition;

  out vec4 fragColor;

  ${shaderCommonUtil.commonUtilSource}

  vec2 getPositionInTexture() {
    return (gl_FragCoord.xy - 0.5 * uWidth) / uScale - uPosition;
  }

  void main() {
    vec2 posInTex = getPositionInTexture();
    posInTex = mod(posInTex, uWidth);
    vec4 col = texture(uSampler, posInTex / uWidth);
    int cellVal = cellValueFromColorComponent(col[0]);
    if (uOverlayCellIsEnabled && floor(posInTex) == floor(uOverlayCellPosition)) {
      cellVal = uOverlayCellValue;
    }
    if (uOverlaySignalIsEnabled && floor(posInTex) == floor(uOverlaySignalPosition)) {
      int kind = getCellKind(cellVal);
      int subKind = getCellSubKind(cellVal);
      cellVal = makeCellValue(kind, subKind, true, true, true, true);
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
              posInTex.x < selectionRectEnd.x
            ) || (
              selectionRectBegin.x <= posInTex.x + uWidth &&
              posInTex.x + uWidth < selectionRectEnd.x
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
              posInTex.y < selectionRectEnd.y
            ) || (
              selectionRectBegin.y <= posInTex.y + uWidth &&
              posInTex.y + uWidth < selectionRectEnd.y
            )
          )
        )
      )
    ) {
      cellVal = makeCellValue(CellKindWire, CellWireKindWire, true, true, true, true);
    }
    if (uOverlayPasteIsEnabled) {
      vec2 size = uSelectionRectSize;
      vec2 pos = mod(round(vec2(uOverlayPastePosition - size / 2.0)), uWidth);
      if (
        (
          (
            pos.x <= posInTex.x &&
            posInTex.x < pos.x + size.x
          ) || (
            pos.x <= posInTex.x + uWidth &&
            posInTex.x + uWidth < pos.x + size.x
          )
        ) && (
          (
            pos.y <= posInTex.y &&
            posInTex.y < pos.y + size.y
          ) || (
            pos.y <= posInTex.y + uWidth &&
            posInTex.y + uWidth < pos.y + size.y
          )
        )
      ) {
        vec4 col = texture(uClipboardSampler, (posInTex - pos) / uWidth);
        cellVal = cellValueFromColorComponent(col[0]);
      }
    }
    int kind = getCellKind(cellVal);
    if (kind == CellKindNone) {
      if (abs(posInTex.x) < 2.0 / uScale || abs(posInTex.y) < 2.0 / uScale) {
        fragColor = vec4(4.0 / 16.0, 4.0 / 16.0, 4.0 / 16.0, 1.0);
        return;
      }
      if (abs(mod(posInTex.x, 8.0)) < 2.0 / uScale || abs(mod(posInTex.y, 8.0)) < 2.0 / uScale) {
        fragColor = vec4(3.0 / 16.0, 3.0 / 16.0, 3.0 / 16.0, 1.0);
        return;
      }
      fragColor = vec4(2.0 / 16.0, 2.0 / 16.0, 2.0 / 16.0, 1.0);
      return;
    }
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
      vec4 color = vec4(8.0, 8.0, 8.0, 16.0) / 16.0;
      fragColor = mix(color, vec4(1.0), signaling ? 1.0 / 2.0 : 0.0);
      return;
    } else if (kind == CellKindWire && subKind == CellWireKindCross) {
      vec4 color = vec4(8.0, 12.0, 8.0, 16.0) / 16.0;
      fragColor = mix(color, vec4(1.0), signaling ? 1.0 / 2.0 : 0.0);
      return;
    } else if (kind == CellKindIn && subKind == CellInKindAnd) {
      vec4 color = vec4(16.0, 12.0, 8.0, 16.0) / 16.0;
      fragColor = mix(color, vec4(1.0), signaling ? 1.0 / 16.0 : 0.0);
      return;
    } else if (kind == CellKindIn && subKind == CellInKindOr) {
      vec4 color = vec4(8.0, 12.0, 16.0, 16.0) / 16.0;
      fragColor = mix(color, vec4(1.0), signaling ? 1.0 / 16.0 : 0.0);
      return;
    } else if (kind == CellKindIn && subKind == CellInKindXor) {
      vec4 color = vec4(16.0, 8.0, 16.0, 16.0) / 16.0;
      fragColor = mix(color, vec4(1.0), signaling ? 1.0 / 16.0 : 0.0);
      return;
    } else if (kind == CellKindOut && subKind == CellOutKindOut) {
      vec4 color = vec4(8.0, 8.0, 16.0, 16.0) / 16.0;
      fragColor = mix(color, vec4(1.0), signaling ? 1.0 / 16.0 : 0.0);
      return;
    } else if (kind == CellKindOut && subKind == CellOutKindInvOut) {
      vec4 color = vec4(16.0, 8.0, 8.0, 16.0) / 16.0;
      fragColor = mix(color, vec4(1.0), signaling ? 1.0 / 16.0 : 0.0);
      return;
    }
    fragColor = vec4(0.0);
  }
`;

class RenderShader {
  program;
  initialize(gl) {
    this.program = shaderCommonUtil.createProgram(
      gl,
      shaderCommonUtil.vertexShaderForEntireSurfaceSource,
      fragmentShaderSource
    );
  }
};

export const renderShader = new RenderShader();


