// 魚クラス
class Fish {
  constructor(x, y, schoolId, isUserAdded = false) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D();
    this.velocity.setMag(random(1, 2));
    this.acceleration = createVector();
    this.maxForce = CONFIG.FISH_MOVEMENT.MAX_FORCE;
    this.maxSpeed =
      CONFIG.FISH_MOVEMENT.MAX_SPEED +
      random(
        -CONFIG.FISH_MOVEMENT.SPEED_VARIATION,
        CONFIG.FISH_MOVEMENT.SPEED_VARIATION
      );
    this.size = CONFIG.FISH_SIZE;
    this.schoolId = schoolId;
    // ユーザー操作で追加されたかどうか（永続フラグ）
    this.userAdded = isUserAdded;
    // 描画時に、常に最後に追加された魚だけ赤色にするためのフラグ
    this.isLastAdded = false;

    // 通常の速度を記録
    this.originalMaxSpeed = this.maxSpeed;
    // ユーザー追加なら生成直後だけ速度ブースト
    if (this.userAdded) {
      this.boostFactor = CONFIG.FISH_MOVEMENT.BOOST_FACTOR;
      this.boostDuration = CONFIG.FISH_MOVEMENT.BOOST_DURATION;
      this.creationTime = millis();
      this.maxSpeed = this.originalMaxSpeed * this.boostFactor;
    }

    // 各群れ固有の色（描画時、isLastAdded が true なら赤色で描画）
    colorMode(HSB, 100);
    this.color = color((schoolId * 10) % 100, 70, 80);
    colorMode(RGB, 255);
  }

  align(fishes) {
    let perceptionRadius = CONFIG.FISH_MOVEMENT.ALIGNMENT_RADIUS;
    let steering = createVector();
    let total = 0;
    for (let other of fishes) {
      if (other.schoolId === this.schoolId) {
        let d = dist(
          this.position.x,
          this.position.y,
          other.position.x,
          other.position.y
        );
        if (other !== this && d < perceptionRadius) {
          steering.add(other.velocity);
          total++;
        }
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  cohesion(fishes) {
    let perceptionRadius = CONFIG.FISH_MOVEMENT.COHESION_RADIUS;
    let steering = createVector();
    let total = 0;
    for (let other of fishes) {
      if (other.schoolId === this.schoolId) {
        let d = dist(
          this.position.x,
          this.position.y,
          other.position.x,
          other.position.y
        );
        if (other !== this && d < perceptionRadius) {
          steering.add(other.position);
          total++;
        }
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.sub(this.position);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  separation(fishes) {
    let perceptionRadius = CONFIG.FISH_MOVEMENT.SEPARATION_RADIUS;
    let steering = createVector();
    let total = 0;
    for (let other of fishes) {
      let d = dist(
        this.position.x,
        this.position.y,
        other.position.x,
        other.position.y
      );
      if (other !== this && d < perceptionRadius) {
        let diff = p5.Vector.sub(this.position, other.position);
        diff.div(d * d);
        steering.add(diff);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  avoidOtherSchools(fishes) {
    let avoidRadius = CONFIG.FISH_MOVEMENT.AVOIDANCE_RADIUS;
    let steering = createVector();
    let total = 0;
    for (let other of fishes) {
      if (other.schoolId !== this.schoolId) {
        let d = dist(
          this.position.x,
          this.position.y,
          other.position.x,
          other.position.y
        );
        if (d < avoidRadius) {
          let diff = p5.Vector.sub(this.position, other.position);
          diff.div(d);
          steering.add(diff);
          total++;
        }
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed * 1.2);
      steering.sub(this.velocity);
      steering.limit(this.maxForce * 1.3);
    }
    return steering;
  }

  flock(fishes) {
    let alignment = this.align(fishes);
    let cohesion = this.cohesion(fishes);
    let separation = this.separation(fishes);
    let avoidance = this.avoidOtherSchools(fishes);

    alignment.mult(CONFIG.FISH_MOVEMENT.ALIGNMENT_WEIGHT);
    cohesion.mult(CONFIG.FISH_MOVEMENT.COHESION_WEIGHT);
    separation.mult(CONFIG.FISH_MOVEMENT.SEPARATION_WEIGHT);
    avoidance.mult(CONFIG.FISH_MOVEMENT.AVOIDANCE_WEIGHT);

    this.acceleration.add(alignment);
    this.acceleration.add(cohesion);
    this.acceleration.add(separation);
    this.acceleration.add(avoidance);
  }

  edges() {
    if (this.position.x < -this.size * 3) {
      this.position.x = width + this.size * 3;
    } else if (this.position.x > width + this.size * 3) {
      this.position.x = -this.size * 3;
    }
    if (this.position.y < -this.size * 3) {
      this.position.y = height + this.size * 3;
    } else if (this.position.y > height + this.size * 3) {
      this.position.y = -this.size * 3;
    }
  }

  update() {
    // ユーザー追加された魚は一定時間後に速度ブーストを解除
    if (
      this.userAdded &&
      this.boostDuration &&
      millis() - this.creationTime > this.boostDuration
    ) {
      this.maxSpeed = this.originalMaxSpeed;
      this.boostDuration = 0;
    }
    this.position.add(this.velocity);
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.acceleration.mult(0);
    this.edges();
  }

  draw() {
    push();
    translate(this.position.x, this.position.y);
    rotate(this.velocity.heading() + PI / 2);
    noFill();
    // 最後に追加された魚のみ赤色、それ以外は薄い灰色
    if (this.isLastAdded) {
      stroke(255, 0, 0);
    } else {
      stroke(180, 180, 180, 200);
    }
    strokeWeight(1);
    beginShape();
    vertex(0, -this.size * 1.5);
    bezierVertex(
      this.size,
      -this.size,
      this.size,
      this.size,
      0,
      this.size * 1.5
    );
    bezierVertex(
      -this.size,
      this.size,
      -this.size,
      -this.size,
      0,
      -this.size * 1.5
    );
    endShape();
    // 2本の尾びれ
    line(0, this.size * 1.5, -this.size * 0.5, this.size * 2);
    line(0, this.size * 1.5, this.size * 0.5, this.size * 2);
    pop();
  }
}
