// 群れクラス
class School {
  constructor(numFish, schoolId) {
    this.fishes = [];
    this.schoolId = schoolId;

    // より広い範囲にわたって魚を分散させる
    let centerX = random(width * 0.2, width * 0.8);
    let centerY = random(height * 0.2, height * 0.8);

    // 初期分散を大幅に増加
    let initialSpread = 50;

    for (let i = 0; i < numFish; i++) {
      // 均一分布で広く分散させる（ガウス分布よりも均一に広がる）
      let angle = random(TWO_PI);
      let distance = random(initialSpread * 0.2, initialSpread);
      let x = centerX + cos(angle) * distance;
      let y = centerY + sin(angle) * distance;

      let fish = new Fish(x, y, schoolId);

      // 中心から外側に向かう初期速度を設定
      let directionOut = createVector(x - centerX, y - centerY);
      directionOut.normalize();
      directionOut.mult(random(1.0, 2.0)); // 最初は少し速く移動
      fish.velocity = directionOut;

      this.fishes.push(fish);
    }
  }

  addFish(x, y, isUserAdded = false) {
    let fish = new Fish(x, y, this.schoolId, isUserAdded);
    if (this.fishes.length > 0) {
      let avgVelocity = createVector(0, 0);
      for (let existingFish of this.fishes) {
        avgVelocity.add(existingFish.velocity);
      }
      avgVelocity.div(this.fishes.length);
      fish.velocity = avgVelocity.copy().mult(random(0.9, 1.1));
    }
    this.fishes.push(fish);
    return fish;
  }
}
