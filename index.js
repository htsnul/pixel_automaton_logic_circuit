let width;
let height;
let cells = [];

function makeCell(kind, pushingTo) {
  return { kind, pushingTo };
}

onload = () => {
  const strs = (() => {
    // OR
    if (0) {
      return [
        "        ",
        " # #    ",
        " # #    ",
        " # #    ",
        " #####  ",
        " #   #  ",
        " #####  ",
        " #   #  ",
      ];
    }
    // NOR
    if (0) {
      return [
        "        ",
        " # #    ",
        " # #    ",
        " ###    ",
        "   #    ",
        " E #    ",
        " ###    ",
        " #      ",
      ];
    }
    // AND
    if (0) {
      return [
        "        ",
        " # #    ",
        " # #    ",
        " # #    ",
        " I##    ",
        " #      ",
        " #      ",
        "        ",
      ];
    }
    // NAND
    if (0) {
      return [
        "        ",
        " # #    ",
        " ##I    ",
        "   #    ",
        " E #    ",
        " C##    ",
        " #      ",
        "        ",
        "        ",
      ];
    }
    // AND2
    if (1) {
      return [
        "         ",
        " # # #   ",
        " # # #   ",
        " # # ### ",
        " # #   # ",
        " # #   # ",
        " # ##  # ",
        " #  #  # ",
        " ## ## # ",
        "  #  # # ",
        " E+ E+ # ",
        " C# C# # ",
        " #  #  # ",
        " ####  # ",
        "   #   # ",
        "  E+   # ",
        "  C#   # ",
        "  #    # ",
        "  ###### ",
        "         ",
      ];
    }
    // BRIDGE
    if (0) {
      return [
        "        ",
        " # #    ",
        " # #    ",
        " # #    ",
        " # #    ",
        " ##+##  ",
        "   # #  ",
        " ##+##  ",
        " # #    ",
      ];
    }
    if (0) {
      return [
        "        ",
        " # #    ",
        " # #    ",
        " # #    ",
        " # #    ",
        " ##+##  ",
        "   # #  ",
        " ##+##  ",
        " # #    ",
        " # #    ",
        " ##I    ",
        "   #    ",
        " E #    ",
        " C##    ",
        " #      ",
        "        ",
      ];
    }
  })();
  height = strs.length;
  width = strs[0].length;
  for (let y = 0; y < height; ++y) {
    cells.push([]);
    const str = strs[y];
    for (let x = 0; x < width; ++x) {
      cells[y].push(
        makeCell("None", { t: false, r: false, b: false, l: false })
      );
      if (str[x] === "E") {
        cells[y][x].kind = "Emitter";
      } else if (str[x] === "#") {
        cells[y][x].kind = "Transmitter";
      } else if (str[x] === "+") {
        cells[y][x].kind = "Bridge";
      } else if (str[x] === "C") {
        cells[y][x].kind = "Conflictor";
      } else if (str[x] === "I") {
        cells[y][x].kind = "Inductor";
      } else {
        cells[y][x].kind = "None";
      }
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.imageRendering = "pixelated";
  const scale = Math.min(Math.max(Math.floor(512 / Math.max(width, height)), 1), 16);
  canvas.style.width = `${scale * width}px`;
  canvas.style.height = `${scale * height}px`;
  document.body.append(canvas);
  requestAnimationFrame(update);
};

function updateCell(x, y, cell, pushedFrom) {
  if (cell.kind === "Emitter") {
    cell.pushingTo.t = true;
    cell.pushingTo.r = true;
    cell.pushingTo.b = true;
    cell.pushingTo.l = true;
  } else if (cell.kind === "None") {
    cell.pushingTo.t = false;
    cell.pushingTo.r = false;
    cell.pushingTo.b = false;
    cell.pushingTo.l = false;
  } else if (cell.kind === "Transmitter") {
    const isAnyPushed = pushedFrom.t || pushedFrom.r || pushedFrom.b || pushedFrom.l;
    cell.pushingTo.t = isAnyPushed && !pushedFrom.t;
    cell.pushingTo.r = isAnyPushed && !pushedFrom.r;
    cell.pushingTo.b = isAnyPushed && !pushedFrom.b;
    cell.pushingTo.l = isAnyPushed && !pushedFrom.l;
  } else if (cell.kind === "Conflictor") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    const isEitherPushed = isPushedV && !isPushedH || !isPushedV && isPushedH;
    cell.pushingTo.t = isEitherPushed && isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isEitherPushed && isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isEitherPushed && isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isEitherPushed && isPushedH && !pushedFrom.l;
  } else if (cell.kind === "Inductor") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    const isBothPushed = isPushedV && isPushedH;
    cell.pushingTo.t = isBothPushed && isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isBothPushed && isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isBothPushed && isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isBothPushed && isPushedH && !pushedFrom.l;
  } else if (cell.kind === "Bridge") {
    const isPushedV = pushedFrom.t || pushedFrom.b;
    const isPushedH = pushedFrom.r || pushedFrom.l;
    cell.pushingTo.t = isPushedV && !pushedFrom.t;
    cell.pushingTo.r = isPushedH && !pushedFrom.r;
    cell.pushingTo.b = isPushedV && !pushedFrom.b;
    cell.pushingTo.l = isPushedH && !pushedFrom.l;
  }
}

function renderCell(imageData, x, y, cell) {
  let colors = {r: {s: 0, e: 1}, g: {s: 0, e: 1}, b: {s: 0, e: 1}};
  if (cell.kind === "Transmitter") {
    colors = {r: {s: 0.5, e: 1}, g: {s: 0.5, e: 1}, b: {s: 0.5, e: 1}};
  } else if (cell.kind === "Bridge") {
    colors = {r: {s: 0.25, e: 1}, g: {s: 0.25, e: 1}, b: {s: 0.75, e: 1}};
  } else if (cell.kind === "Conflictor") {
    colors = {r: {s: 0.75, e: 1}, g: {s: 0.25, e: 1}, b: {s: 0.25, e: 1}};
  } else if (cell.kind === "Inductor") {
    colors = {r: {s: 0.25, e: 1}, g: {s: 0.75, e: 1}, b: {s: 0.25, e: 1}};
  }
  const intensity = (cell.pushingTo.t + cell.pushingTo.r + cell.pushingTo.b + cell.pushingTo.l) / 4;
  i = x + y * imageData.width;
  imageData.data[4 * i + 0] = 255 * (colors.r.s + (colors.r.e - colors.r.s) * intensity);
  imageData.data[4 * i + 1] = 255 * (colors.g.s + (colors.g.e - colors.g.s) * intensity);
  imageData.data[4 * i + 2] = 255 * (colors.b.s + (colors.b.e - colors.b.s) * intensity);
  imageData.data[4 * i + 3] = 255;
}

let c = 0;

function update() {
  requestAnimationFrame(update);
  c++;
  prevCells = JSON.parse(JSON.stringify(cells));
  const table = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  const ti = Math.floor(c / 120) % table.length;
  cells[1][1].kind = table[ti][0] ? "Emitter" : "None";
  cells[1][3].kind = table[ti][1] ? "Emitter" : "None";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      updateCell(
        x, y,
        cells[y][x],
        {
          t: (1 <= y && prevCells[y - 1][x])?.pushingTo?.b,
          r: (x < (width - 1) && prevCells[y][x + 1])?.pushingTo?.l,
          b: (y < (height - 1) && prevCells[y + 1][x])?.pushingTo?.t,
          l: (1 <= x && prevCells[y][x - 1])?.pushingTo?.r,
        }
      );
    }
  }
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      renderCell(imageData, x, y, cells[y][x]);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
