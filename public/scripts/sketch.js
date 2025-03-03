// グローバル変数
let MAX_USER_ADDED;
let FISH_PER_SCHOOL;

// その他のグローバル変数
let userAddedCount = 0;
let lastUserAddedFish = null;
let showFish = false; // 魚の表示／非表示フラグ
let schools = [];
let allFishes = [];
let currentSchoolId = 0;
let isMousePressed = false;
let lastAddedTime = 0;
let fishButton;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // スマホサイズなら魚の数を半分に設定
  if (windowWidth < 600) {
    MAX_USER_ADDED = CONFIG.MAX_USER_ADDED_MOBILE;
    FISH_PER_SCHOOL = CONFIG.FISH_PER_SCHOOL_MOBILE;
  } else {
    MAX_USER_ADDED = CONFIG.MAX_USER_ADDED_DESKTOP;
    FISH_PER_SCHOOL = CONFIG.FISH_PER_SCHOOL_DESKTOP;
  }

  // 各群れを生成し、allFishes にまとめる
  for (let i = 0; i < CONFIG.NUM_SCHOOLS; i++) {
    let school = new School(FISH_PER_SCHOOL, i);
    schools.push(school);
    allFishes = allFishes.concat(school.fishes);
  }

  // 表示／非表示切替用のボタンを生成
  fishButton = new FishButton();
}

function draw() {
  background(255);

  if (isMousePressed && millis() - lastAddedTime > 100) {
    addFishAtPosition(mouseX, mouseY);
    lastAddedTime = millis();
  }

  // 群れ行動の計算と描画
  for (let fish of allFishes) {
    fish.flock(allFishes);
  }

  if (showFish) {
    for (let fish of allFishes) {
      fish.update();
      fish.draw();
    }
  }
}

// ユーザー追加時の処理（全体で MAX_USER_ADDED 未満なら追加）
function addFishAtPosition(x, y) {
  if (userAddedCount >= MAX_USER_ADDED) return false;
  let newFish = schools[currentSchoolId].addFish(x, y, true);
  // 既に最後に追加された魚があればフラグ解除
  if (lastUserAddedFish) {
    lastUserAddedFish.isLastAdded = false;
  }
  // 新たに追加された魚を最後の追加魚（赤色）に設定
  newFish.isLastAdded = true;
  lastUserAddedFish = newFish;
  userAddedCount++;
  currentSchoolId = (currentSchoolId + 1) % schools.length;
  allFishes.push(newFish);
  return true;
}

function mousePressed() {
  isMousePressed = true;
  addFishAtPosition(mouseX, mouseY);
  lastAddedTime = millis();
  return false;
}

function mouseReleased() {
  isMousePressed = false;
  return false;
}

function touchStarted() {
  if (touches.length > 0) {
    isMousePressed = true;
    addFishAtPosition(touches[0].x, touches[0].y);
    lastAddedTime = millis();
  }
  return false;
}

function touchMoved() {
  if (touches.length > 0) {
    if (millis() - lastAddedTime > 100) {
      addFishAtPosition(touches[0].x, touches[0].y);
      lastAddedTime = millis();
    }
  }
  return false;
}

function touchEnded() {
  isMousePressed = false;
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function toggleFishVisibility() {
  showFish = !showFish;
}
