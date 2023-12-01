import { cellsTextures } from "./cellsTextures.js"

export const saveLoad = {
  save: () => {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const width = cellsTextures.width;
    const height = cellsTextures.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, cellsTextures.currentFramebuffer);
    const pixels = new Uint8Array(width * height);
    gl.readPixels(0, 0, width, height, gl.RED, gl.UNSIGNED_BYTE, pixels);
    const blob = new Blob([pixels]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateTimeStr = (new Date).toISOString()
      .replace(/\..*$/, "")
      .replaceAll("-", "")
      .replaceAll(":", "");
    a.download = `palc_${dateTimeStr}.dat`;
    a.style.display = "none";
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  load: () => {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const width = cellsTextures.width;
    const height = cellsTextures.height;
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    input.onchange = (event) => {
      const reader = new FileReader();
      reader.onload = () => {
        const pixels = new Uint8Array(reader.result);
        gl.bindTexture(gl.TEXTURE_2D, cellsTextures.currentTexture);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0, 0, 0,
          width, height,
          gl.RED,
          gl.UNSIGNED_BYTE,
          pixels
        );
      };
      reader.readAsArrayBuffer(input.files[0]);
    };
    document.body.append(input);
    input.click();
    input.remove();
  },
  loadSample: async() => {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const width = cellsTextures.width;
    const height = cellsTextures.height;
    const res = await fetch("sample.dat");
    const arrayBuffer = await res.arrayBuffer();
    const pixels = new Uint8Array(arrayBuffer);
    gl.bindTexture(gl.TEXTURE_2D, cellsTextures.currentTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0, 0, 0,
      width, height,
      gl.RED,
      gl.UNSIGNED_BYTE,
      pixels
    );
  }
}

