// ボタン関連の処理
class FishButton {
  constructor() {
    this.button = createButton("");
    this.button.class("toggle-btn");
    this.setupButton();
  }

  setupButton() {
    // 魚のSVGアイコン
    const fishSVG = `<svg width="40" height="40" viewBox="-10 -15 20 30" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-90 0 0)">
          <path d="M0 -9 C6 -6, 6 6, 0 9 C-6 6, -6 -6, 0 -9" fill="none" stroke="#b4b4b4" stroke-width="1"/>
          <line x1="0" y1="9" x2="-3" y2="12" stroke="#b4b4b4" stroke-width="1"/>
          <line x1="0" y1="9" x2="3" y2="12" stroke="#b4b4b4" stroke-width="1"/>
      </g>
      </svg>`;

    this.button.html(fishSVG);

    // ボタン押下時は魚の追加をさせず、表示／非表示を切り替える
    this.button.mousePressed(() => {
      toggleFishVisibility();
    });

    // タッチやマウス押下のイベント伝播を止める
    this.button.elt.addEventListener("touchstart", (e) => {
      e.stopPropagation();
    });

    this.button.elt.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
  }
}
