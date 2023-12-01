class CellsTextures {
  #textures = [];
  #currentIndex = 0;
  #framebuffers = [];
  initialize(gl, width, height) {
    for (let i = 0; i < 2; ++i) {
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
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0
      );
      this.#textures[i] = tex;
      this.#framebuffers[i] = fb;
    }
  }

  get currentTexture() {
    return this.#textures[this.#currentIndex];
  }

  get currentFramebuffer() {
    return this.#framebuffers[this.#currentIndex];
  }

  get nextFramebuffer() {
    return this.#framebuffers[1 - this.#currentIndex];
  }

  advance() {
    this.#currentIndex = 1 - this.#currentIndex;
  }
}

export const cellsTextures = new CellsTextures();
