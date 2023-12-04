import { shaderCommonUtil } from "./shaderCommonUtil.js"

const fragmentShaderSource = `#version 300 es
  precision mediump float;

  int CommandKindDraw = 0;
  int CommandKindEarth = 1;
  int CommandKindToggle = 2;
  int CommandKindSignal = 3;
  int CommandKindPaste = 4;

  uniform sampler2D uSampler;
  uniform sampler2D uClipboardSampler;
  uniform int uCommandKind;
  uniform vec2 uPosition;
  uniform vec2 uSize;
  uniform int uCellValue;

  out vec4 fragColor;

  ${shaderCommonUtil.commonUtilSource}

  void main() {
    const float texW = 512.0f;
    vec4 col = texture(uSampler, gl_FragCoord.xy / texW);
    int cellVal = cellValueFromColorComponent(col[0]);
    if (uCommandKind == CommandKindDraw) {
      if (floor(gl_FragCoord.xy) != floor(uPosition)) {
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
    if (uCommandKind == CommandKindToggle) {
      if (floor(gl_FragCoord.xy) != floor(uPosition)) {
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      int kind = getCellKind(cellVal);
      if (kind != CellKindOut) {
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      int subKind = (
        getCellSubKind(cellVal) == CellOutKindOut
        ? CellOutKindNot
        : CellOutKindOut
      );
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind, false, false, false, false
      ));
      return;
    }
    if (uCommandKind == CommandKindSignal) {
      if (floor(gl_FragCoord.xy) != floor(uPosition)) {
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      int kind = getCellKind(cellVal);
      if (kind != CellKindWire) {
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      int subKind = getCellSubKind(cellVal);
      fragColor[0] = cellValueToColorComponent(makeCellValue(
        kind, subKind, true, true, true, true
      ));
      return;
    }
    if (uCommandKind == CommandKindPaste) {
      vec2 pos = mod(round(vec2(uPosition - uSize / 2.0)), texW);
      if (
        (
          (pos.x <= gl_FragCoord.x && gl_FragCoord.x < pos.x + uSize.x) ||
          (pos.x <= gl_FragCoord.x + texW && gl_FragCoord.x + texW < pos.x + uSize.x)
        ) && (
          (pos.y <= gl_FragCoord.y && gl_FragCoord.y < pos.y + uSize.y) ||
          (pos.y <= gl_FragCoord.y + texW && gl_FragCoord.y + texW < pos.y + uSize.y)
        )
      ) {
        vec4 col = texture(uClipboardSampler, (gl_FragCoord.xy - pos) / texW);
        int cellVal = cellValueFromColorComponent(col[0]);
        fragColor[0] = cellValueToColorComponent(cellVal);
        return;
      }
      fragColor[0] = cellValueToColorComponent(cellVal);
      return;
    }
  }
`;

class EditShader {
  program;
  initialize(gl) {
    this.program = shaderCommonUtil.createProgram(
      gl,
      shaderCommonUtil.vertexShaderForEntireSurfaceSource,
      fragmentShaderSource
    );
  }
  doEditCommand(
    gl, fb, tex, kind,
    { position, size, cellValue, clipboardTexture }
  ) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const kindInt = (() => {
      switch (kind) {
        case "Draw": return 0;
        case "Earth": return 1;
        case "Toggle": return 2;
        case "Signal": return 3;
        case "Paste": return 4;
      }
    })();
    gl.uniform1i(gl.getUniformLocation(this.program, "uSampler"), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, "uCommandKind"), kindInt);
    if (position) {
      gl.uniform2fv(gl.getUniformLocation(this.program, "uPosition"), [position.x, position.y]);
    }
    if (size) {
      gl.uniform2fv(gl.getUniformLocation(this.program, "uSize"), [size.x, size.y]);
    }
    if (cellValue !== undefined) {
      gl.uniform1i(gl.getUniformLocation(this.program, "uCellValue"), cellValue);
    }
    if (clipboardTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, clipboardTexture);
      gl.uniform1i(gl.getUniformLocation(this.program, "uClipboardSampler"), 1);
      gl.activeTexture(gl.TEXTURE0);
    }
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}

export const editShader = new EditShader();

