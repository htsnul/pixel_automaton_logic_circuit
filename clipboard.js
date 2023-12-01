class Clipboard {
  #width = 0;
  #height = 0;
  #texture = null;
  #effectiveSize = { x: 0, y: 0 };
  constructor() {}
  initialize(gl, width, height) {
    this.#width = width;
    this.#height = height;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const pixels = new Uint8Array(width * height);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width, height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      pixels
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.#texture = tex;
  }

  get texture() { return this.#texture; }
  get effectiveSize() { return this.#effectiveSize; }
  
  copyFrom(gl, framebuffer, rect) {
   gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const width = this.#width;
    const height = this.#height;
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.copyTexSubImage2D(
      gl.TEXTURE_2D, 0,
      0, 0,
      rect.x, rect.y,
      width - rect.x, height - rect.y
    );
    const overflow = {
      x: rect.x + rect.width - width,
      y: rect.y + rect.height - height
    };
    if (overflow.x > 0) {
      gl.copyTexSubImage2D(
        gl.TEXTURE_2D, 0,
        width - rect.x, 0,
        0, rect.y,
        overflow.x, height - rect.y
      );
    }
    if (overflow.y > 0) {
      gl.copyTexSubImage2D(
        gl.TEXTURE_2D, 0,
        0, height - rect.y,
        rect.x, 0,
        width - rect.x, overflow.y
      );
    }
    if (overflow.x > 0 && overflow.y > 0) {
      gl.copyTexSubImage2D(
        gl.TEXTURE_2D, 0,
        width - rect.x, height - rect.y,
        0, 0,
        overflow.x, overflow.y
      );
    }
    this.#effectiveSize = { x: rect.width, y: rect.height };
  }
}

export const clipboard = new Clipboard();
