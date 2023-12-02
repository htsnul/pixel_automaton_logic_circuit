import { cellsTextures } from "./cellsTextures.js"

export const cellTextureUtil = {
  positionInWorldToTexture: (pos) => {
    const width = cellsTextures.width;
    const height = cellsTextures.height;
    const mod = (x, y) => x - y * Math.floor(x / y);
    return {
      x: Math.floor(mod(pos.x, width)) + 0.5,
      y: Math.floor(mod(pos.y, height)) + 0.5
    };
  },
  getRectInTextureFromPositionStartEnd: (posS, posE) => {
    const width = cellsTextures.width;
    const height = cellsTextures.height;
    const mod = (x, y) => x - y * Math.floor(x / y);
    const posMinInWorld = {
      x: Math.min(posS.x, posE.x),
      y: Math.min(posS.y, posE.y)
    };
    const posMaxInWorld = {
      x: Math.max(posS.x, posE.x),
      y: Math.max(posS.y, posE.y)
    };
    const posMinInTexCoord = cellTextureUtil.positionInWorldToTexture(posMinInWorld);
    const posMaxInTexCoord = cellTextureUtil.positionInWorldToTexture(posMaxInWorld);
    if (posMaxInTexCoord.x < posMinInTexCoord.x) {
      posMaxInTexCoord.x += width;
    }
    if (posMaxInTexCoord.y < posMinInTexCoord.y) {
      posMaxInTexCoord.y += height;
    }
    const beginInTexCoord = {
      x: Math.floor(posMinInTexCoord.x),
      y: Math.floor(posMinInTexCoord.y)
    };
    const endInTexCoord = {
      x: Math.ceil(posMaxInTexCoord.x),
      y: Math.ceil(posMaxInTexCoord.y)
    };
    return {
      x: beginInTexCoord.x,
      y: beginInTexCoord.y,
      width: endInTexCoord.x - beginInTexCoord.x,
      height: endInTexCoord.y - beginInTexCoord.y
    };
  }
}

