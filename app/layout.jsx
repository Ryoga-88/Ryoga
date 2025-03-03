"use client";
import { metadata } from "./metadata";

import "./globals.css";
import Header from "./components/header";
import Footer from "./components/footer";
import React, { useRef, useState, useEffect } from "react";
import Head from "next/head";

export default function RootLayout({ children }) {
  const [isopen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // クライアントサイドでのダークモード設定の保存
  useEffect(() => {
    // ローカルストレージから初期値を取得
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      setIsDarkMode(savedMode === "true");
      if (savedMode === "true") {
        document.documentElement.classList.add("dark");
      }
    } else {
      // ユーザーのシステム設定を確認
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setIsDarkMode(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());

    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const [showFish, setShowFish] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const p5ContainerRef = useRef(null);
  const p5InstanceRef = useRef(null);

  // 画面サイズに応じた設定
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setShowFish(false); // スマホではオフ
        setIsMobile(true);
      } else {
        setIsMobile(false);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    // 幅768px未満の場合（スマホやタブレットなど）には何もせず終了
    if (window.innerWidth < 768) {
      return;
    }

    if (typeof window !== "undefined") {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.5.0/p5.min.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      // PCサイズの場合のみp5.jsの初期化処理を設定
      script.onload = initializeP5;
      document.body.appendChild(script);
    }

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, []);

  // Toggle visibility of the p5 canvas
  useEffect(() => {
    const container = p5ContainerRef.current;
    if (container) {
      container.style.display = showFish ? "block" : "none";
      // p5インスタンスの可視性も更新
      if (p5InstanceRef.current && p5InstanceRef.current.updateVisibility) {
        p5InstanceRef.current.updateVisibility(showFish);
      }
    }
  }, [showFish]);

  // Initialize p5.js sketch
  const initializeP5 = () => {
    if (typeof window !== "undefined" && window.p5) {
      const sketch = (p) => {
        // CONFIG object - setting parameters
        const CONFIG = {
          NUM_SCHOOLS: 4,
          FISH_PER_SCHOOL_DESKTOP: 40,
          FISH_PER_SCHOOL_MOBILE: 20,
          MAX_USER_ADDED_DESKTOP: 100,
          MAX_USER_ADDED_MOBILE: 50,
          FISH_MOVEMENT: {
            MAX_FORCE: 0.15,
            MAX_SPEED: 1.5,
            SPEED_VARIATION: 0.3,
            ALIGNMENT_RADIUS: 50,
            ALIGNMENT_WEIGHT: 1.2,
            COHESION_RADIUS: 70,
            COHESION_WEIGHT: 1.0,
            SEPARATION_RADIUS: 40,
            SEPARATION_WEIGHT: 1.1,
            AVOIDANCE_RADIUS: 15,
            AVOIDANCE_WEIGHT: 0.4,
            BOOST_FACTOR: 3,
            BOOST_DURATION: 1000,
          },
          FISH_SIZE: 6,
        };

        // Fish class
        class Fish {
          constructor(x, y, schoolId, isUserAdded = false) {
            this.position = p.createVector(x, y);
            this.velocity = p5.Vector.random2D();
            this.velocity.setMag(p.random(1, 2));
            this.acceleration = p.createVector();
            this.maxForce = CONFIG.FISH_MOVEMENT.MAX_FORCE;
            this.maxSpeed =
              CONFIG.FISH_MOVEMENT.MAX_SPEED +
              p.random(
                -CONFIG.FISH_MOVEMENT.SPEED_VARIATION,
                CONFIG.FISH_MOVEMENT.SPEED_VARIATION
              );
            this.size = CONFIG.FISH_SIZE;
            this.schoolId = schoolId;
            this.userAdded = isUserAdded;
            this.isLastAdded = false;

            this.originalMaxSpeed = this.maxSpeed;
            if (this.userAdded) {
              this.boostFactor = CONFIG.FISH_MOVEMENT.BOOST_FACTOR;
              this.boostDuration = CONFIG.FISH_MOVEMENT.BOOST_DURATION;
              this.creationTime = p.millis();
              this.maxSpeed = this.originalMaxSpeed * this.boostFactor;
            }

            p.colorMode(p.HSB, 100);
            this.color = p.color((schoolId * 10) % 100, 70, 80);
            p.colorMode(p.RGB, 255);
          }

          align(fishes) {
            let perceptionRadius = CONFIG.FISH_MOVEMENT.ALIGNMENT_RADIUS;
            let steering = p.createVector();
            let total = 0;
            for (let other of fishes) {
              if (other.schoolId === this.schoolId) {
                let d = p.dist(
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
              steering.div(total); // total > 0 の場合のみ実行
              steering.setMag(this.maxSpeed);
              steering.sub(this.velocity);
              steering.limit(this.maxForce);
            }
            return steering;
          }

          cohesion(fishes) {
            let perceptionRadius = CONFIG.FISH_MOVEMENT.COHESION_RADIUS;
            let steering = p.createVector();
            let total = 0;
            for (let other of fishes) {
              if (other.schoolId === this.schoolId) {
                let d = p.dist(
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
              steering.div(total); // total > 0 の場合のみ実行
              steering.sub(this.position);
              steering.setMag(this.maxSpeed);
              steering.sub(this.velocity);
              steering.limit(this.maxForce);
            }
            return steering;
          }

          separation(fishes) {
            let perceptionRadius = CONFIG.FISH_MOVEMENT.SEPARATION_RADIUS;
            let steering = p.createVector();
            let total = 0;
            for (let other of fishes) {
              let d = p.dist(
                this.position.x,
                this.position.y,
                other.position.x,
                other.position.y
              );
              if (other !== this && d < perceptionRadius) {
                let diff = p5.Vector.sub(this.position, other.position);
                diff.div(d * d); // d * d が 0 になる可能性はないが、念のため確認
                steering.add(diff);
                total++;
              }
            }
            if (total > 0) {
              steering.div(total); // total > 0 の場合のみ実行
              steering.setMag(this.maxSpeed);
              steering.sub(this.velocity);
              steering.limit(this.maxForce);
            }
            return steering;
          }

          avoidOtherSchools(fishes) {
            let avoidRadius = CONFIG.FISH_MOVEMENT.AVOIDANCE_RADIUS;
            let steering = p.createVector();
            let total = 0;
            for (let other of fishes) {
              if (other.schoolId !== this.schoolId) {
                let d = p.dist(
                  this.position.x,
                  this.position.y,
                  other.position.x,
                  other.position.y
                );
                if (d < avoidRadius) {
                  let diff = p5.Vector.sub(this.position, other.position);
                  diff.div(d + 0.0001); // d が 0 になる可能性はないが、念のため確認
                  steering.add(diff);
                  total++;
                }
              }
            }
            if (total > 0) {
              steering.div(total); // total > 0 の場合のみ実行
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
              this.position.x = p.width + this.size * 3;
            } else if (this.position.x > p.width + this.size * 3) {
              this.position.x = -this.size * 3;
            }
            if (this.position.y < -this.size * 3) {
              this.position.y = p.height + this.size * 3;
            } else if (this.position.y > p.height + this.size * 3) {
              this.position.y = -this.size * 3;
            }
          }

          update() {
            if (
              this.userAdded &&
              this.boostDuration &&
              p.millis() - this.creationTime > this.boostDuration
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
            p.push();
            p.translate(this.position.x, this.position.y);
            p.rotate(this.velocity.heading() + p.PI / 2);
            p.noFill();
            if (this.isLastAdded) {
              p.stroke(255, 0, 0);
            } else {
              p.stroke(180, 180, 180, 200);
            }
            p.strokeWeight(1);
            p.beginShape();
            p.vertex(0, -this.size * 1.5);
            p.bezierVertex(
              this.size,
              -this.size,
              this.size,
              this.size,
              0,
              this.size * 1.5
            );
            p.bezierVertex(
              -this.size,
              this.size,
              -this.size,
              -this.size,
              0,
              -this.size * 1.5
            );
            p.endShape();
            p.line(0, this.size * 1.5, -this.size * 0.5, this.size * 2);
            p.line(0, this.size * 1.5, this.size * 0.5, this.size * 2);
            p.pop();
          }
        }

        // School class
        class School {
          constructor(numFish, schoolId) {
            this.fishes = [];
            this.schoolId = schoolId;

            let centerX = p.random(p.width * 0.2, p.width * 0.8);
            let centerY = p.random(p.height * 0.2, p.height * 0.8);
            let initialSpread = 50;

            for (let i = 0; i < numFish; i++) {
              let angle = p.random(p.TWO_PI);
              let distance = p.random(initialSpread * 0.2, initialSpread);
              let x = centerX + Math.cos(angle) * distance;
              let y = centerY + Math.sin(angle) * distance;

              let fish = new Fish(x, y, schoolId);

              let directionOut = p.createVector(x - centerX, y - centerY);
              directionOut.normalize();
              directionOut.mult(p.random(1.0, 2.0));
              fish.velocity = directionOut;

              this.fishes.push(fish);
            }
          }

          addFish(x, y, isUserAdded = false) {
            let fish = new Fish(x, y, this.schoolId, isUserAdded);
            if (this.fishes.length > 0) {
              let avgVelocity = p.createVector(0, 0);
              for (let existingFish of this.fishes) {
                avgVelocity.add(existingFish.velocity);
              }
              avgVelocity.div(this.fishes.length);
              fish.velocity = avgVelocity.copy().mult(p.random(0.9, 1.1));
            }
            this.fishes.push(fish);
            return fish;
          }
        }

        // Global variables
        let MAX_USER_ADDED;
        let FISH_PER_SCHOOL;
        let userAddedCount = 0;
        let lastUserAddedFish = null;
        let schools = [];
        let allFishes = [];
        let currentSchoolId = 0;
        let isMousePressed = false;
        let lastAddedTime = 0;
        let canvasVisible = false;

        // Function to add fish at a position
        function addFishAtPosition(x, y) {
          if (userAddedCount >= MAX_USER_ADDED) return false;
          let newFish = schools[currentSchoolId].addFish(x, y, true);
          if (lastUserAddedFish) {
            lastUserAddedFish.isLastAdded = false;
          }
          newFish.isLastAdded = true;
          lastUserAddedFish = newFish;
          userAddedCount++;
          currentSchoolId = (currentSchoolId + 1) % schools.length;
          allFishes.push(newFish);
          return true;
        }

        p.setup = function () {
          // キャンバスの位置と大きさを調整
          const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
          canvas.parent(p5ContainerRef.current);

          // キャンバスの z-index を設定
          canvas.style("pointer-events", "auto");

          // キャンバスの初期可視性を設定
          canvasVisible = showFish;

          // 以下は変更なし
          if (window.innerWidth < 600) {
            MAX_USER_ADDED = CONFIG.MAX_USER_ADDED_MOBILE;
            FISH_PER_SCHOOL = CONFIG.FISH_PER_SCHOOL_MOBILE;
          } else {
            MAX_USER_ADDED = CONFIG.MAX_USER_ADDED_DESKTOP;
            FISH_PER_SCHOOL = CONFIG.FISH_PER_SCHOOL_DESKTOP;
          }

          // Create schools
          for (let i = 0; i < CONFIG.NUM_SCHOOLS; i++) {
            let school = new School(FISH_PER_SCHOOL, i);
            schools.push(school);
            allFishes = allFishes.concat(school.fishes);
          }
        };

        p.draw = function () {
          p.clear();

          // Only process mouse events if canvas is visible
          if (
            canvasVisible &&
            isMousePressed &&
            p.millis() - lastAddedTime > 100
          ) {
            addFishAtPosition(p.mouseX, p.mouseY);
            lastAddedTime = p.millis();
          }

          // Calculate flocking behavior
          for (let fish of allFishes) {
            fish.flock(allFishes);
          }

          // Update and draw fish
          for (let fish of allFishes) {
            fish.update();
            fish.draw();
          }
        };

        p.mousePressed = function () {
          isMousePressed = true;
          console.log("クリックイベント発火:", p.mouseX, p.mouseY);
          if (
            canvasVisible &&
            p.mouseX >= 0 &&
            p.mouseX <= p.width &&
            p.mouseY >= 0 &&
            p.mouseY <= p.height
          ) {
            console.log("クリックされた位置:", p.mouseX, p.mouseY); // クリックされた位置をログに出力
            addFishAtPosition(p.mouseX, p.mouseY);
          }
        };

        p.mouseReleased = function () {
          isMousePressed = false;
          return false;
        };

        p.touchStarted = function () {
          if (
            canvasVisible &&
            p.mouseX >= 0 &&
            p.mouseX <= p.width &&
            p.mouseY >= 0 &&
            p.mouseY <= p.height
          ) {
            if (p.millis() - lastAddedTime > 100) {
              addFishAtPosition(p.mouseX, p.mouseY);
              lastAddedTime = p.millis();
            }
            return false;
          }
        };

        p.touchMoved = function () {
          if (canvasVisible && p.touches.length > 0) {
            if (p.millis() - lastAddedTime > 100) {
              addFishAtPosition(p.touches[0].x, p.touches[0].y);
              lastAddedTime = p.millis();
            }
            return false;
          }
        };

        p.touchEnded = function () {
          isMousePressed = false;
          return false;
        };

        p.windowResized = function () {
          p.resizeCanvas(window.innerWidth, window.innerHeight);
        };

        // Function to update visibility
        p.updateVisibility = function (isVisible) {
          canvasVisible = isVisible;
        };
      };

      // Create p5 insta
      if (window.innerWidth < 768) {
        return;
      }

      if (typeof window !== "undefined" && window.p5) {
        p5InstanceRef.current = new window.p5(sketch);
      }
    }
  };

  return (
    <html lang="ja" className={isDarkMode ? "dark" : ""}>
      <head>
        {/* 基本的なSEOメタタグ */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={metadata.description} />
        <meta name="keywords" content={metadata.keywords} />
        <meta name="author" content={metadata.author} />

        {/* Google Search Console 所有権確認用タグ */}
        <meta
          name="google-site-verification"
          content="duIULWMuN87iNsRpBQM9ChtbDg1qQ-Ct15oLlqt5HV0"
        />

        {/* OGP（Open Graph Protocol）タグ */}
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={metadata.url} />
        <meta property="og:image" content={metadata.image} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metadata.title} />
        <meta name="twitter:description" content={metadata.description} />
        <meta name="twitter:image" content={metadata.image} />

        {/* ファビコン */}
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />

        {/* 外部リソース */}
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css"
        />

        {/* 構造化データ (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: metadata.title,
              description: metadata.description,
              url: metadata.url,
            }),
          }}
        />

        <title>{metadata.title}</title>
      </head>
      <body className="dark:bg-black min-h-screen">
        <Header
          isOpen={isopen}
          setIsOpen={setIsOpen}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          isMobile={isMobile}
          showFish={showFish}
          setShowFish={setShowFish}
        />
        <div
          ref={p5ContainerRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 5,
            pointerEvents: showFish && !isMobile ? "auto" : "none",
            display: showFish && !isMobile ? "block" : "none",
          }}
        />

        <main
          className={`transition-all duration-300 ${isopen ? "blur-lg" : ""}`}
        >
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
