// 設定パラメータを集約したファイル
const CONFIG = {
  // 群れの基本設定
  NUM_SCHOOLS: 4, // 群れの数（固定）

  // 魚の数設定
  FISH_PER_SCHOOL_DESKTOP: 40, // デスクトップでの各群れの初期魚数
  FISH_PER_SCHOOL_MOBILE: 20, // モバイルでの各群れの初期魚数
  MAX_USER_ADDED_DESKTOP: 100, // デスクトップでのユーザー追加可能な魚の最大数
  MAX_USER_ADDED_MOBILE: 50, // モバイルでのユーザー追加可能な魚の最大数

  // 魚の動きパラメータ
  FISH_MOVEMENT: {
    // 基本速度と力の設定
    MAX_FORCE: 0.15, // 通常の最大力（小さくすると穏やかに）
    MAX_SPEED: 1.5, // 通常の最大速度（小さくすると遅く）
    SPEED_VARIATION: 0.3, // 速度のランダム変動（±この値）

    // 群れ行動のパラメータ
    ALIGNMENT_RADIUS: 50, // 整列する範囲
    ALIGNMENT_WEIGHT: 1.2, // 整列の重み

    COHESION_RADIUS: 70, // 集合する範囲
    COHESION_WEIGHT: 1.0, // 集合の重み

    SEPARATION_RADIUS: 40, // 分離する範囲
    SEPARATION_WEIGHT: 1.1, // 分離の重み（大きくすると魚同士が離れる）

    AVOIDANCE_RADIUS: 15, // 他の群れを避ける範囲
    AVOIDANCE_WEIGHT: 0.4, // 他の群れを避ける重み

    // ユーザー追加魚のブースト設定
    BOOST_FACTOR: 3, // ブースト倍率
    BOOST_DURATION: 1000, // ブースト持続時間（ミリ秒）
  },

  // 描画設定
  FISH_SIZE: 6, // 魚の基本サイズ
};
