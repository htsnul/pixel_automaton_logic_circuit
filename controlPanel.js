import { cellsTextures } from "./cellsTextures.js"
import { saveLoad } from "./saveLoad.js"
import { cellValueUtil } from "./cellValueUtil.js"
import { editShader } from "./shader/editShader.js"

class ControlPanel {
  targetZoomLevel = 4.0;
  initialize() {
    const style = document.createElement("style");
    style.innerHTML = `
      .control-panel {
        display: flex;
        align-items: center;
      }
      .control-panel > div {
        display: flex;
        margin: 8px;
        align-items: center;
      }
      .control-panel button {
        box-sizing: border-box;
        padding: 2px;
        margin: 2px;
      }
      .control-panel button > img {
        display: block;
        width: 15px;
        height: 15px;
      }
      .control-panel input[type="radio"] {
        appearance: none;
        position: absolute;
      }
      .control-panel input[type="radio"] + img {
        display: block;
        width: 15px;
        height: 15px;
        padding: 2px;
        border: 2px solid transparent;
        border-radius: 3px;
      }
      .control-panel input[type="radio"]:checked + img {
        border-color: #888;
      }
    `;
    document.head.append(style);
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="control-panel">
        <div>
          <button id="zoom-out-button"><img src="icon/minus_icon.svg"></button>
          <span id="zoom-ratio" style="display: inline-block; width: 32px; text-align: center;"></span>
          <button id="zoom-in-button"><img src="icon/plus_icon.svg"></button>
        </div>
        <div>
          <select id="hz-select">
            <option value="0">0Hz</option>
            <option value="1">1Hz</option>
            <option value="3">3Hz</option>
            <option value="6">6Hz</option>
            <option value="12">12Hz</option>
            <option value="30">30Hz</option>
            <option value="60" selected>60Hz</option>
            <option value="120">120Hz</option>
            <option value="300">300Hz</option>
            <option value="600">600Hz</option>
            <option value="1200">1.2KHz</option>
            <option value="3000">3.0KHz</option>
            <option value="6000">6.0KHz</option>
          </select>
        </div>
        <div>
          <button id="earth-button" title="Earth GND"><img src="icon/earth_icon.svg"></button>
        </div>
        <div>
          <button id="load-button">Load</button>
          <button id="save-button">Save</button>
        </div>
      </div>
      <div class="control-panel">
        <div>
          <div><label title="Scroll">
            <input name="pointer-action-kind" type="radio" value="Scroll" checked>
            <img src="icon/scroll_icon.svg">
          </label></div>
          <div><label title="Draw">
            <input name="pointer-action-kind" type="radio" value="Draw">
            <img src="icon/draw_icon.svg">
          </label></div>
          <div><label title="Select">
            <input name="pointer-action-kind" type="radio" value="Select">
            <img src="icon/select_icon.svg">
          </label></div>
          <div><label title="Paste">
            <input name="pointer-action-kind" type="radio" value="Paste">
            <img src="icon/paste_icon.svg">
          </label></div>
          <div><label title="Toggle or Signal">
            <input name="pointer-action-kind" type="radio" value="ToggleOrSignal">
            <img src="icon/signal_icon.svg">
          </label></div>
        </div>
        <div>
          <div><label title="None">
            <input name="cell-kind" type="radio" value="None">
            <img src="icon/none_icon.svg">
          </label></div>
          <div><label title="Wire">
            <input name="cell-kind" type="radio" value="Wire" checked>
            <img src="icon/wire_icon.svg">
          </label></div>
          <div><label title="Wire-Cross">
            <input name="cell-kind" type="radio" value="WireCross">
            <img src="icon/wire_cross_icon.svg">
          </label></div>
          <div><label title="In-AND">
            <input name="cell-kind" type="radio" value="InAnd">
            <img src="icon/in_and_icon.svg">
          </label></div>
          <div><label title="In-OR">
            <input name="cell-kind" type="radio" value="InOr">
            <img src="icon/in_or_icon.svg">
          </label></div>
          <div><label title="In-XOR">
            <input name="cell-kind" type="radio" value="InXor">
            <img src="icon/in_xor_icon.svg">
          </label></div>
          <div><label title="Out">
            <input name="cell-kind" type="radio" value="Out">
            <img src="icon/out_icon.svg">
            </label></div>
          <div><label title="Out-NOT">
            <input name="cell-kind" type="radio" value="OutNot">
            <img src="icon/out_not_icon.svg">
          </label></div>
        </div>
      <div>
    `;
    div.querySelector("#earth-button").onclick = () => {
      const gl = document.querySelector("canvas").getContext("webgl2");
      editShader.doEditCommand(
        gl,
        cellsTextures.nextFramebuffer,
        cellsTextures.currentTexture,
        "Earth",
        {}
      );
      cellsTextures.advance();
    };
    div.querySelector("#load-button").onclick = () => saveLoad.load();
    div.querySelector("#save-button").onclick = () => saveLoad.save();
    const zoom = (sign) => {
      if (zoom !== 0) {
        this.targetZoomLevel = Math.min(Math.max(0, this.targetZoomLevel + sign), 6);
      }
      div.querySelector("#zoom-ratio").innerHTML = "x" + Math.pow(2, this.targetZoomLevel);
    };
    zoom(0);
    div.querySelector("#zoom-out-button").onclick = () => zoom(-1);
    div.querySelector("#zoom-in-button").onclick = () => zoom(+1);
    document.body.append(div);
  }

  getCurrentPointerActionKind() {
    return document.querySelector("input[name='pointer-action-kind']:checked").value;
  }

  getCurrentCellValue() {
    return cellValueUtil.createCellValue(this.#getCurrentCellKind());
  }

  #getCurrentCellKind() {
    return document.querySelector("input[name='cell-kind']:checked").value;
  }
}

export const controlPanel = new ControlPanel();
