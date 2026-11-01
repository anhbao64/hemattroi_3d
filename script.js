import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js";

const sceneElement = document.getElementById("scene");
const loadingElement = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");
const sunToggle = document.getElementById("sunToggle");
const sunButtonTitle = document.getElementById("sunButtonTitle");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const moonToggle = document.getElementById("moonToggle");
const moonButtonTitle = document.getElementById("moonButtonTitle");
const solarToggle = document.getElementById("solarToggle");
const solarButtonTitle = document.getElementById("solarButtonTitle");
const solarButtonHint = document.getElementById("solarButtonHint");
const stageCaption = document.getElementById("stageCaption");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050914);

const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 4000);
camera.position.set(0, 1.5, 12.0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
sceneElement.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.inset = "0";
labelRenderer.domElement.style.pointerEvents = "none";
sceneElement.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 4;
controls.maxDistance = 500; // đủ xa để xem toàn bộ Hệ Mặt Trời
controls.target.set(0, 0, 0);
controls.enablePan = false;

// ✅ FIX: Người dùng cầm chuột / chạm / lăn chuột => HUỶ hiệu ứng chuyển cảnh ngay,
// để camera không bị lerp kéo ngược về vị trí cũ nữa.
controls.addEventListener("start", () => {
  isTransitioning = false;
});

function startTransition() {
  transitionTime = 0;
  isTransitioning = true;
}

// ==========================================
// 🌌 NỀN VŨ TRỤ: RẤT NHIỀU SAO, MỖI SAO LẤP LÁNH RIÊNG
// ==========================================
const starUniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() }
};

function createStarfield() {
  const starsCount = 7000; // tăng/giảm số này để sao dày/thưa hơn
  const positions = new Float32Array(starsCount * 3);
  const colors = new Float32Array(starsCount * 3);
  const sizes = new Float32Array(starsCount);
  const phases = new Float32Array(starsCount);
  const speeds = new Float32Array(starsCount);
  const amps = new Float32Array(starsCount);

  // Màu sao: xanh lam, trắng, vàng nhạt, cam nhạt (trắng chiếm nhiều hơn)
  const tints = [
    [0.70, 0.80, 1.00],
    [1.00, 1.00, 1.00],
    [1.00, 1.00, 1.00],
    [1.00, 0.95, 0.80],
    [1.00, 0.80, 0.60]
  ];

  for (let i = 0; i < starsCount; i++) {
    // Sao nằm trên mặt cầu rất lớn, bao quanh toàn bộ khu vực camera có thể tới
    const r = 800 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const tint = tints[Math.floor(Math.random() * tints.length)];
    const brightness = 0.45 + Math.random() * 0.55;
    colors[i * 3] = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;

    // Phần lớn là sao nhỏ, một ít sao vừa, rất ít sao lớn và sáng
    const roll = Math.random();
    sizes[i] = roll > 0.97 ? 4.5 + Math.random() * 2.0
             : roll > 0.85 ? 2.8 + Math.random() * 1.2
             : 1.6 + Math.random() * 1.0;

    phases[i] = Math.random() * Math.PI * 2; // mỗi sao lệch pha => không nháy cùng lúc
    speeds[i] = 0.8 + Math.random() * 3.2;   // tốc độ nhấp nháy khác nhau
    amps[i] = 0.25 + Math.random() * 0.7;    // biên độ nhấp nháy khác nhau
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aAmp", new THREE.BufferAttribute(amps, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aAmp;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float wave = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);
        wave *= 0.75 + 0.25 * sin(uTime * aSpeed * 2.7 + aPhase * 1.7); // nhấp nháy không đều
        vTwinkle = 1.0 - aAmp * (1.0 - wave);
        vColor = aColor;
        gl_PointSize = aSize * uPixelRatio * (0.8 + 0.4 * vTwinkle);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * vTwinkle, core * core);
      }
    `
  });

  const starField = new THREE.Points(geometry, material);
  starField.frustumCulled = false;
  scene.add(starField);
}
createStarfield();

// Ánh sáng nền
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
scene.add(fillLight);

// Nhóm quỹ đạo Trái Đất quay quanh Mặt Trời
const earthOrbitGroup = new THREE.Group();
scene.add(earthOrbitGroup);

// Hằng số khoảng cách
const EARTH_SUN_DISTANCE = -15.0; 


// ==========================================
// 🪐 ĐƯỜNG QUỸ ĐẠO CỦA TRÁI ĐẤT QUANH MẶT TRỜI
// Tâm là Mặt Trời (0,0,0), bán kính đúng bằng khoảng cách Trái Đất - Mặt Trời,
// nên Trái Đất luôn chạy đúng trên đường này. Chỉ hiện khi bật Mặt Trời.
// ==========================================
const EARTH_ORBIT_RADIUS = Math.abs(EARTH_SUN_DISTANCE);

const orbitLine = (() => {
  const segments = 256;
  const points = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(
      Math.cos(a) * EARTH_ORBIT_RADIUS,
      0,
      Math.sin(a) * EARTH_ORBIT_RADIUS
    ));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6 });
  const line = new THREE.LineLoop(geometry, material);
  line.visible = false;
  scene.add(line);
  return line;
})();

const orbitLabel = makeLabel("Quỹ đạo Trái Đất", true);
orbitLabel.position.set(0, 0, -EARTH_ORBIT_RADIUS); // phía xa của quỹ đạo, tránh đè lên Trái Đất
orbitLabel.visible = false;
scene.add(orbitLabel);
// Nhóm Trái Đất
const earthPivot = new THREE.Group();
earthPivot.position.set(0, 0, 0);
earthOrbitGroup.add(earthPivot);

// Nhóm NGHIÊNG: mô hình Trái Đất + trục + xích đạo đều nằm trong nhóm này.
// Nhờ vậy xích đạo trùng khít với xích đạo của mô hình và đứng yên khi Trái Đất tự quay.
const EARTH_TILT = THREE.MathUtils.degToRad(23.5);
const earthTiltGroup = new THREE.Group();
earthTiltGroup.rotation.z = -EARTH_TILT; // cực Bắc nghiêng về phía +X
earthPivot.add(earthTiltGroup);

// Nhóm quay của Mặt Trăng quanh Trái Đất
const moonOrbitPivot = new THREE.Group();
earthPivot.add(moonOrbitPivot);
moonOrbitPivot.visible = false; // Mặt Trăng ban đầu bị tắt

// Mặt Trời đặt ở tâm (0, 0, 0)
const sunPivot = new THREE.Group();
sunPivot.position.set(0, 0, 0);
scene.add(sunPivot);

// ==========================================
// 🪐 HỆ MẶT TRỜI: MẶT TRỜI + 8 HÀNH TINH
// ==========================================
const SUN_BASE_RADIUS = 2.25;                          // bán kính Mặt Trời ở chế độ thường (đường kính 4.5)
const SOLAR_SUN_RADIUS = 7.0;                          // bán kính Mặt Trời khi xem cả hệ
const SOLAR_SUN_SCALE = SOLAR_SUN_RADIUS / SUN_BASE_RADIUS;
const EARTH_DISPLAY_RADIUS = 1.725;                    // = 3.45 / 2 (kích thước Trái Đất đang dùng)

// Bảng hành tinh, xếp từ trong ra ngoài:
//  radius : bán kính hiển thị (đã gồm cả vành đai nếu có) - dùng để chống va chạm
//  gap    : khoảng trống TỐI THIỂU giữa mép hành tinh này và mép vật thể phía trong nó
//  speed  : tốc độ chạy trên quỹ đạo (rad/s) - càng xa Mặt Trời càng chậm
//  files  : tên tệp GLB trong thư mục model_3d (thử lần lượt từng tên)
const PLANETS = [
  { key: "mercury", name: "Sao Thủy",       files: ["Mercury .glb", "Mercury.glb"], radius: 0.8,  gap: 7.0, speed: 0.55,  spin: 0.05,  angle: 0.9, color: 0xb5b5b5 },
  { key: "venus",   name: "Sao Kim",        files: ["Venus.glb"],                   radius: 1.6,  gap: 6.0, speed: 0.40,  spin: -0.04, angle: 3.9, color: 0xe6c27a },
  { key: "earth",   name: "Trái Đất",       isEarth: true,                         radius: EARTH_DISPLAY_RADIUS, gap: 6.5, speed: 0.25 },
  { key: "mars",    name: "Sao Hỏa",        files: ["Mars.glb"],                    radius: 1.2,  gap: 7.0, speed: 0.19,  spin: 0.30,  angle: 2.3, color: 0xc1583a },
  { key: "jupiter", name: "Sao Mộc",        files: ["jupiter.glb", "Jupiter.glb"],  radius: 4.75, gap: 7.5, speed: 0.11,  spin: 0.60,  angle: 5.5, color: 0xd8b48a },
  { key: "saturn",  name: "Sao Thổ",        files: ["Saturn.glb"],                  radius: 7.5,  radiusNoRing: 4.0, gap: 8.0, speed: 0.08, spin: 0.50, angle: 1.4, color: 0xe3cf9a },
  { key: "uranus",  name: "Sao Thiên Vương", files: ["Uranus.glb"],                 radius: 2.75, gap: 8.5, speed: 0.055, spin: 0.35,  angle: 4.2, color: 0x9fdfe6 },
  { key: "neptune", name: "Sao Hải Vương",  files: ["Neptune.glb"],                 radius: 2.65, gap: 9.0, speed: 0.04,  spin: 0.35,  angle: 0.2, color: 0x5a7be0 }
];
const EARTH_PLANET = PLANETS.find((planet) => planet.isEarth);
let solarMaxRadius = 0;

// Bố cục: quỹ đạo sau = quỹ đạo trước + bán kính vật trước + KHOẢNG TRỐNG + bán kính của chính nó.
// Hai vòng quỹ đạo đồng tâm luôn cách nhau (bán kính A + bán kính B + khoảng trống),
// nên dù hai hành tinh đứng ở bất kỳ góc nào cũng KHÔNG THỂ chạm nhau.
function computeSolarLayout() {
  let prevOrbit = 0;
  let prevRadius = SOLAR_SUN_RADIUS;
  PLANETS.forEach((planet) => {
    planet.orbitRadius = prevOrbit + prevRadius + planet.gap + planet.radius;
    prevOrbit = planet.orbitRadius;
    prevRadius = planet.radius;
  });
  solarMaxRadius = prevOrbit + prevRadius;

  // Kiểm tra an toàn: mọi cặp hành tinh phải cách nhau xa hơn tổng bán kính
  for (let i = 0; i < PLANETS.length; i++) {
    for (let j = i + 1; j < PLANETS.length; j++) {
      const clear = (PLANETS[j].orbitRadius - PLANETS[i].orbitRadius) - (PLANETS[i].radius + PLANETS[j].radius);
      console.assert(clear > 0, `Hành tinh ${PLANETS[i].name} và ${PLANETS[j].name} có thể chạm nhau!`);
    }
  }
}
computeSolarLayout();

// Nhãn tên Mặt Trời (chỉ hiện khi xem cả Hệ Mặt Trời)
const sunLabel = makeLabel("Mặt Trời", true);
sunLabel.element.classList.add("planet-tag");
sunLabel.position.set(0, SUN_BASE_RADIUS * 1.12, 0);
sunLabel.visible = false;
sunPivot.add(sunLabel);

// Ánh sáng Mặt Trời
const sunLight = new THREE.DirectionalLight(0xffffff, 8.0);
sunLight.target.position.copy(earthPivot.position);
scene.add(sunLight, sunLight.target);
sunLight.visible = false;

const sunGlow = new THREE.PointLight(0xffa83d, 0, 8);
sunGlow.position.copy(sunPivot.position);
scene.add(sunGlow);

// Khi xem cả Hệ Mặt Trời: đèn điểm đặt ở tâm Mặt Trời, chiếu ra MỌI hướng (không suy giảm theo khoảng cách)
// để mọi hành tinh đều sáng đúng phía hướng về Mặt Trời. (Đèn định hướng cũ chỉ đúng cho riêng Trái Đất.)
const solarSunLight = new THREE.PointLight(0xffffff, 8.0, 0, 0);
solarSunLight.position.set(0, 0, 0);
solarSunLight.visible = false;
scene.add(solarSunLight);

let earthModel = null;
let sunModel = null;
let moonModel = null;
let isSunVisible = false;
let isSolarSystemVisible = false;
let isMoonVisible = false;
let viewMode = "earth";          // "earth" | "sun" | "solar"
let modeBeforeSolar = "earth";   // chế độ để quay lại khi tắt Hệ Mặt Trời
let isPaused = false;
let earthRadius = 1.8;

// Biến quản lý Morphing mượt mà
let isTransitioning = false;
let transitionTime = 0;
const TRANSITION_MAX_TIME = 2.5; // giây - quá thời gian này tự trả quyền cho chuột
let targetCameraPosition = new THREE.Vector3(0, 1.5, 12.0);
let targetControlsTarget = new THREE.Vector3(0, 0, 0);
let targetEarthBaseDistance = 0;   // khoảng cách Trái Đất - Mặt Trời mong muốn (0 hoặc 15)
let earthBaseDistance = 0;
let solarTarget = 0;               // 0 = ẩn Hệ Mặt Trời, 1 = hiện
let solarProgress = 0;
let targetAmbientIntensity = 1.2;
let targetFillIntensity = 0.9;

let earthOriginalMaterials = new Map();
let moonOriginalMaterials = new Map();
const clock = new THREE.Clock();

function normalizeModel(root, targetSize) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  root.scale.setScalar(targetSize / maxDimension);
  root.position.sub(center.multiplyScalar(targetSize / maxDimension));
  root.updateMatrixWorld(true);
  return targetSize / 2;
}

function makeLabel(text, accent = false) {
  const element = document.createElement("div");
  element.className = `label-tag${accent ? " accent" : ""}`;
  element.textContent = text;
  return new CSS2DObject(element);
}

function addLine(parent, points, color = 0xffd27a, opacity = 0.9) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geometry, material);
  parent.add(line);
  return line;
}

// Các chú thích chỉ hiện ở chế độ "chỉ Trái Đất" (khi tắt Mặt Trời).
// Lưu ý: nhãn CSS2D không tự ẩn theo nhóm cha, nên đặt .visible cho từng đối tượng.
const earthDetailObjects = [];
let earthNameLabel = null; // tên "Trái Đất" - chỉ hiện khi bật Mặt Trời
let equatorLabelObject = null;

function trackDetail(object) {
  earthDetailObjects.push(object);
  return object;
}

function updateEarthDetailVisibility() {
  earthDetailObjects.forEach((object) => { object.visible = !isSunVisible; });
  if (earthNameLabel) earthNameLabel.visible = isSunVisible;
  if (equatorLabelObject) equatorLabelObject.visible = !isSolarSystemVisible; // xem cả hệ: bỏ chữ "Đường Xích đạo" cho đỡ rối
}

function addEarthAnnotations(radius) {
  // Trục địa lý = trục Y cục bộ của earthTiltGroup (nhóm này đã nghiêng 23,5°)
  const axisDirection = new THREE.Vector3(0, 1, 0);
  const axisLength = radius * 1.48;
  const axisStart = axisDirection.clone().multiplyScalar(-axisLength);
  const axisEnd = axisDirection.clone().multiplyScalar(axisLength);
  trackDetail(addLine(earthTiltGroup, [axisStart, axisEnd], 0xffd27a, 0.95));

  const north = makeLabel("Cực Bắc", true);
  north.position.copy(axisEnd).multiplyScalar(1.12);
  earthTiltGroup.add(north);
  trackDetail(north);

  const south = makeLabel("Cực Nam", true);
  south.position.copy(axisStart).multiplyScalar(1.12);
  earthTiltGroup.add(south);
  trackDetail(south);

  const axisLabel = makeLabel("Trục Trái Đất");
  axisLabel.position.copy(axisEnd).multiplyScalar(1.42).add(new THREE.Vector3(0.22, 0.05, 0));
  earthTiltGroup.add(axisLabel);
  trackDetail(axisLabel);

  // Xích đạo: vòng tròn nằm trong mặt phẳng XZ của nhóm nghiêng (vuông góc trục)
  // -> LUÔN HIỆN (cả khi bật Mặt Trời)
  const equatorPoints = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    equatorPoints.push(new THREE.Vector3(
      Math.cos(a) * radius * 1.008,
      0,
      Math.sin(a) * radius * 1.008
    ));
  }
  addLine(earthTiltGroup, equatorPoints, 0x8bd8ff, 0.9);

  // Nhãn xích đạo đặt ngay phía trước (hướng camera) trên đường xích đạo -> LUÔN HIỆN
  equatorLabelObject = makeLabel("Đường Xích đạo");
  equatorLabelObject.position.set(0, 0, radius * 1.4);
  earthTiltGroup.add(equatorLabelObject);

  // Các nhãn hướng và góc giữ nguyên vị trí cố định
  const west = makeLabel("Hướng Tây");
  west.position.set(-radius * 1.45, -radius * 0.45, radius * 0.2);
  earthPivot.add(west);
  trackDetail(west);

  const east = makeLabel("Hướng Đông");
  east.position.set(radius * 1.45, -radius * 0.45, radius * 0.2);
  earthPivot.add(east);
  trackDetail(east);

  const angle1 = makeLabel("23°27′", true);
  angle1.position.set(radius * 0.8, radius * 1.25, radius * 0.05);
  earthPivot.add(angle1);
  trackDetail(angle1);

  // ==========================================
  // MẶT PHẲNG QUỸ ĐẠO (mặt phẳng giả tưởng) NẰM DƯỚI TRỤC
  // Đặt ở độ cao sao cho đầu cực Nam của trục chạm đúng mặt phẳng,
  // góc giữa trục và mặt phẳng là 66°33′ (giống hình minh hoạ).
  // ==========================================
  const planeY = -axisLength * Math.cos(EARTH_TILT);
  const planeRadius = radius * 2.2;

  const planeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(planeRadius, 96),
    new THREE.MeshBasicMaterial({
      color: 0xff8a3d,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.y = planeY;
  earthPivot.add(planeMesh);
  trackDetail(planeMesh);

  const addPlaneRing = (ringRadius, opacity) => {
    const pts = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * ringRadius, 0, Math.sin(a) * ringRadius));
    }
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xff9a4d, transparent: true, opacity })
    );
    ring.position.y = planeY;
    earthPivot.add(ring);
    trackDetail(ring);
  };
  addPlaneRing(planeRadius, 0.9);        // viền ngoài
  addPlaneRing(planeRadius * 0.5, 0.3);  // vòng mờ bên trong cho dễ nhìn chiều sâu

  const planeLabel = makeLabel("Mặt phẳng quỹ đạo");
  planeLabel.position.set(planeRadius * 0.5, planeY, planeRadius * 0.75);
  earthPivot.add(planeLabel);
  trackDetail(planeLabel);

  // Cung góc 66°33′ tại điểm trục chạm mặt phẳng
  const touch = new THREE.Vector3(-axisLength * Math.sin(EARTH_TILT), planeY, 0);
  const arcAngle = Math.PI / 2 - EARTH_TILT; // 66,5°
  const arcRadius = radius * 0.35;
  const arcPoints = [];
  for (let i = 0; i <= 32; i++) {
    const a = arcAngle * (i / 32);
    arcPoints.push(new THREE.Vector3(
      touch.x + Math.cos(a) * arcRadius,
      touch.y + Math.sin(a) * arcRadius,
      0
    ));
  }
  trackDetail(addLine(earthPivot, arcPoints, 0xffd27a, 0.95));

  const angle2 = makeLabel("66°33′", true);
  const labelAngle = THREE.MathUtils.degToRad(12);
  angle2.position.set(
    touch.x + Math.cos(labelAngle) * radius * 0.78,
    touch.y + Math.sin(labelAngle) * radius * 0.78,
    0
  );
  earthPivot.add(angle2);
  trackDetail(angle2);

  // Tên "Trái Đất": chỉ hiện khi bật Mặt Trời (lúc đó các chú thích khác được ẩn)
  earthNameLabel = makeLabel("Trái Đất", true);
  earthNameLabel.element.classList.add("planet-tag");
  earthNameLabel.position.set(0, radius * 1.45, 0);
  earthPivot.add(earthNameLabel);

  updateEarthDetailVisibility();
}

// ==========================================
// 🎬 CHUYỂN CHẾ ĐỘ XEM: "earth" (chỉ Trái Đất) · "sun" (Trái Đất + Mặt Trời) · "solar" (cả Hệ Mặt Trời)
// ==========================================
function applyViewMode(mode) {
  viewMode = mode;
  const sunOn = mode !== "earth";
  const solarOn = mode === "solar";
  isSunVisible = sunOn;
  isSolarSystemVisible = solarOn;

  sunPivot.visible = sunOn;
  sunLight.visible = mode === "sun";     // đèn định hướng: chỉ dùng cho chế độ Trái Đất + Mặt Trời
  solarSunLight.visible = solarOn;       // đèn điểm: chiếu sáng cả hệ
  sunGlow.intensity = sunOn ? 2.5 : 0;
  orbitLine.visible = sunOn;
  orbitLabel.visible = mode === "sun";   // nhãn CSS2D không tự ẩn theo nhóm cha nên phải đặt riêng
  updateEarthDetailVisibility();         // bật Mặt Trời: ẩn chú thích, chỉ còn tên Trái Đất + xích đạo

  solarTarget = solarOn ? 1 : 0;
  startTransition(); // Kích hoạt hiệu ứng chuyển cảnh mượt (có thể bị huỷ khi người dùng kéo chuột)

  if (sunOn) {
    targetEarthBaseDistance = EARTH_ORBIT_RADIUS;
    if (solarOn) targetCameraPosition.copy(getSolarCameraPosition());
    else targetCameraPosition.set(0, 5.0, 32.0);
    targetControlsTarget.set(0, 0, 0); // Nhìn về tâm Mặt Trời
    targetAmbientIntensity = 0.35;
    targetFillIntensity = 0.25;
  } else {
    targetEarthBaseDistance = 0;
    targetCameraPosition.set(0, 1.5, 12.0);
    targetControlsTarget.set(0, 0, 0); // Nhìn về tâm Trái Đất
    targetAmbientIntensity = 1.2;
    targetFillIntensity = 0.9;
  }

  // Đổi Material theo trạng thái (có Mặt Trời: vật liệu nhận sáng; không: vật liệu sáng đều)
  const swapMaterials = (model, originals) => {
    if (!model) return;
    model.traverse((object) => {
      if (!object.isMesh) return;
      if (sunOn) {
        if (originals.has(object)) object.material = originals.get(object);
      } else {
        if (!object.userData.basicMaterial) {
          const origMat = originals.get(object);
          object.userData.basicMaterial = new THREE.MeshBasicMaterial({
            map: origMat.map || null,
            color: origMat.color || new THREE.Color(0xffffff)
          });
        }
        object.material = object.userData.basicMaterial;
      }
    });
  };
  swapMaterials(earthModel, earthOriginalMaterials);
  swapMaterials(moonModel, moonOriginalMaterials);

  sunToggle.setAttribute("aria-pressed", String(sunOn));
  sunButtonTitle.textContent = sunOn ? "Ẩn Mặt Trời" : "Hiện Mặt Trời";
  if (solarToggle) solarToggle.setAttribute("aria-pressed", String(solarOn));
  if (solarButtonTitle) solarButtonTitle.textContent = solarOn ? "Ẩn Hệ Mặt Trời" : "Hiện Hệ Mặt Trời";
  stageCaption.textContent = {
    earth: "Trái Đất là trung tâm · Đang tự quay quanh trục",
    sun: "Mặt Trời xuất hiện · Trái Đất quay trên quỹ đạo quanh Mặt Trời",
    solar: "Hệ Mặt Trời · 8 hành tinh chuyển động trên quỹ đạo riêng, không bao giờ chạm nhau"
  }[mode];
}

function setSunVisible(visible) {
  // Đang xem cả hệ mà bấm "Ẩn Mặt Trời" => thu gọn về chế độ chỉ có Trái Đất
  applyViewMode(visible ? "sun" : "earth");
}

// ------------------------------------------
// Dựng 7 hành tinh còn lại (tải tệp GLB lần đầu bấm nút)
// ------------------------------------------
let solarGroup = null;
const solarPlanets = []; // { def, pivot, spin, ring, label, angle }
let solarModelsPromise = null;

async function loadFirstAvailable(loader, files) {
  let lastError;
  for (const file of files) {
    try {
      return await loader.loadAsync(encodeURI(`./model_3d/${file}`)); // encodeURI: tên "Mercury .glb" có dấu cách
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// Đưa mô hình về tâm gốc, chuẩn hoá bán kính ~1, đo điểm xa nhất (gồm cả vành đai) và độ "dẹt" của mô hình
function measureModel(root) {
  normalizeModel(root, 2);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const flatness = Math.min(size.x, size.y, size.z) / (Math.max(size.x, size.y, size.z) || 1);
  let maxDistance = 0;
  const v = new THREE.Vector3();
  root.traverse((object) => {
    const position = object.isMesh && object.geometry && object.geometry.attributes.position;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      maxDistance = Math.max(maxDistance, v.length());
    }
  });
  return { maxDistance: maxDistance || 1, flatness };
}

function scaleModelToRadius(root, radius, maxDistance) {
  const k = radius / maxDistance;
  root.scale.multiplyScalar(k);
  root.position.multiplyScalar(k);
  root.updateMatrixWorld(true);
}

// Tránh hành tinh bị đen kịt (kim loại hoá) khi không có môi trường phản chiếu
function softenMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
      if (!material) return;
      if ("metalness" in material) material.metalness = Math.min(material.metalness, 0.1);
      if ("roughness" in material) material.roughness = Math.max(material.roughness, 0.6);
    });
  });
}

function makeFallbackPlanet(planet) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshStandardMaterial({ color: planet.color, roughness: 0.85, metalness: 0 })
  );
  mesh.scale.setScalar(planet.radius);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

function makeOrbitRing(radius) {
  const points = [];
  for (let i = 0; i < 192; i++) {
    const a = (i / 192) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
  }
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 })
  );
  ring.scale.set(radius, 1, radius);
  return ring;
}

function loadSolarModels() {
  if (!solarModelsPromise) solarModelsPromise = buildSolarSystem();
  return solarModelsPromise;
}

async function buildSolarSystem() {
  const loader = new GLTFLoader();
  const others = PLANETS.filter((planet) => !planet.isEarth);

  const scenes = await Promise.all(others.map(async (planet) => {
    try {
      return (await loadFirstAvailable(loader, planet.files)).scene;
    } catch (error) {
      console.warn(`Không tải được mô hình ${planet.name} (${planet.files.join(" / ")}) - dùng quả cầu thay thế.`, error);
      return null;
    }
  }));

  // 1) Đặt kích thước từng hành tinh đúng bán kính thiết kế
  others.forEach((planet, i) => {
    let model = scenes[i];
    if (model) {
      const info = measureModel(model);
      // Sao Thổ: nếu mô hình không có vành đai thì dùng bán kính nhỏ hơn
      if (planet.radiusNoRing && info.flatness >= 0.8) planet.radius = planet.radiusNoRing;
      scaleModelToRadius(model, planet.radius, info.maxDistance);
      softenMaterials(model);
    } else {
      if (planet.radiusNoRing) planet.radius = planet.radiusNoRing;
      model = makeFallbackPlanet(planet);
    }
    planet.model = model;
  });

  // 2) Tính lại bố cục với kích thước thật rồi dựng các nhóm
  computeSolarLayout();

  solarGroup = new THREE.Group();
  solarGroup.visible = false;
  scene.add(solarGroup);

  others.forEach((planet) => {
    const pivot = new THREE.Group(); // vị trí trên quỹ đạo + hiệu ứng phóng to khi xuất hiện
    const spin = new THREE.Group();  // tự quay quanh trục
    spin.add(planet.model);
    pivot.add(spin);

    const label = makeLabel(planet.name, true);
    label.element.classList.add("planet-tag");
    label.position.set(0, planet.radius * 1.1, 0);
    label.visible = false;
    pivot.add(label);

    const ring = makeOrbitRing(planet.orbitRadius);
    solarGroup.add(pivot, ring);
    solarPlanets.push({ def: planet, pivot, spin, ring, label, angle: planet.angle });
  });
}

// Góc nhìn xa vừa đủ để thấy trọn quỹ đạo ngoài cùng (tự tính theo tỉ lệ khung hình)
function getSolarCameraPosition() {
  const elevation = THREE.MathUtils.degToRad(28);
  const direction = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation));
  const probe = camera.clone();
  const edge = solarMaxRadius * 1.04;
  const edgePoints = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    edgePoints.push(new THREE.Vector3(Math.cos(a) * edge, 0, Math.sin(a) * edge));
  }
  const fits = (distance) => {
    probe.position.copy(direction).multiplyScalar(distance);
    probe.lookAt(0, 0, 0);
    probe.updateMatrixWorld(true);
    probe.updateProjectionMatrix();
    return edgePoints.every((point) => {
      const ndc = point.clone().project(probe);
      return Math.abs(ndc.x) <= 0.9 && Math.abs(ndc.y) <= 0.85;
    });
  };
  let near = 20;
  let far = 1500;
  for (let i = 0; i < 30; i++) {
    const mid = (near + far) / 2;
    if (fits(mid)) far = mid; else near = mid;
  }
  return direction.multiplyScalar(far);
}

function setLabelFade(label, amount) {
  const show = amount > 0.05;
  if (label.visible !== show) label.visible = show;
  if (show) label.element.style.opacity = amount.toFixed(2);
}

// Cập nhật mỗi khung hình: vị trí Trái Đất, quỹ đạo, Mặt Trời phình to và các hành tinh
function updateSolarSystem(delta, smooth) {
  solarProgress += (solarTarget - solarProgress) * smooth;
  if (Math.abs(solarTarget - solarProgress) < 0.0005) solarProgress = solarTarget;

  // Trái Đất và các hành tinh dùng CHUNG một "đồng hồ" chuyển cảnh nên không bao giờ đâm vào nhau
  earthBaseDistance += (targetEarthBaseDistance - earthBaseDistance) * smooth;
  const earthDistance = earthBaseDistance + solarProgress * (EARTH_PLANET.orbitRadius - earthBaseDistance);
  earthPivot.position.set(-earthDistance, 0, 0);

  // Đường quỹ đạo của Trái Đất luôn đi đúng qua vị trí Trái Đất
  const ringScale = Math.max(earthDistance / EARTH_ORBIT_RADIUS, 0.0001);
  orbitLine.scale.set(ringScale, 1, ringScale);
  orbitLabel.position.set(0, 0, -earthDistance);

  // Mặt Trời phình to khi xem cả hệ
  sunPivot.scale.setScalar(
    THREE.MathUtils.lerp(1, SOLAR_SUN_SCALE, THREE.MathUtils.smoothstep(solarProgress, 0, 1))
  );

  // Các hành tinh chỉ hiện (phóng to tại chỗ) khi Trái Đất đã gần tới vị trí cuối: g = 0 → 1
  const g = THREE.MathUtils.smoothstep(solarProgress, 0.85, 1);
  setLabelFade(sunLabel, g);
  if (!solarGroup) return;
  solarGroup.visible = g > 0.002;

  solarPlanets.forEach((item) => {
    if (!isPaused) {
      item.angle -= item.def.speed * delta; // cùng chiều với Trái Đất
      item.spin.rotation.y += item.def.spin * delta;
    }
    const r = item.def.orbitRadius;
    item.pivot.position.set(Math.cos(item.angle) * r, 0, Math.sin(item.angle) * r);
    item.pivot.scale.setScalar(Math.max(g, 0.0001));
    item.ring.material.opacity = 0.35 * g;
    setLabelFade(item.label, g);
  });
}

async function loadModels() {
  const loader = new GLTFLoader();
  try {
    const [earthGltf, sunGltf, moonGltf] = await Promise.all([
      loader.loadAsync("./model_3d/Earth.glb"),
      loader.loadAsync("./model_3d/Sun.glb"),
      loader.loadAsync("./model_3d/moon.glb")
    ]);

    earthModel = earthGltf.scene;
    sunModel = sunGltf.scene;
    moonModel = moonGltf.scene;

    earthRadius = normalizeModel(earthModel, 3.45);
    normalizeModel(sunModel, 4.5);
    normalizeModel(moonModel, 1.0);

    earthModel.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) {
          earthOriginalMaterials.set(object, object.material);
          if ("roughness" in object.material) object.material.roughness = 0.35;
          
          object.userData.basicMaterial = new THREE.MeshBasicMaterial({
            map: object.material.map || null,
            color: object.material.color || new THREE.Color(0xffffff)
          });
          object.material = object.userData.basicMaterial;
        }
      }
    });

    moonModel.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) {
          moonOriginalMaterials.set(object, object.material);
          if ("roughness" in object.material) object.material.roughness = 0.5;

          object.userData.basicMaterial = new THREE.MeshBasicMaterial({
            map: object.material.map || null,
            color: object.material.color || new THREE.Color(0xffffff)
          });
          object.material = object.userData.basicMaterial;
        }
      }
    });

    sunModel.traverse((object) => {
      if (object.isMesh) {
        object.material = object.material.clone();
        if ("emissive" in object.material) {
          object.material.emissive = new THREE.Color(0xff8b24);
          object.material.emissiveIntensity = Math.max(object.material.emissiveIntensity || 0, 1.5);
        }
      }
    });

    earthTiltGroup.add(earthModel);
    sunPivot.add(sunModel);

    moonModel.position.set(2.8, 0, 0);
    moonOrbitPivot.add(moonModel);

    addEarthAnnotations(earthRadius);

    earthModel.rotation.y = -0.35;
    sunModel.rotation.y = 0.3;
    sunPivot.visible = false;

    loadingElement.hidden = true;
    loadingElement.style.display = "none";
  } catch (error) {
    console.error("Lỗi tải mô hình GLB:", error);
    loadingElement.hidden = true;
    loadingElement.style.display = "none";
    errorBox.hidden = false;
  }
}

sunToggle.addEventListener("click", () => setSunVisible(!isSunVisible));

async function toggleSolarSystem() {
  if (viewMode === "solar") {
    applyViewMode(modeBeforeSolar); // quay về chế độ trước đó
    return;
  }
  if (!solarModelsPromise) {
    // Lần đầu: tải các tệp GLB của 7 hành tinh
    const defaultHint = solarButtonHint ? solarButtonHint.textContent : "";
    solarToggle.disabled = true;
    if (solarButtonHint) solarButtonHint.textContent = "Đang tải các hành tinh…";
    await loadSolarModels();
    solarToggle.disabled = false;
    if (solarButtonHint) solarButtonHint.textContent = defaultHint;
  } else {
    await loadSolarModels();
  }
  modeBeforeSolar = viewMode === "solar" ? modeBeforeSolar : viewMode;
  applyViewMode("solar");
}
if (solarToggle) solarToggle.addEventListener("click", toggleSolarSystem);

function setMoonVisible(visible) {
  isMoonVisible = visible;
  moonOrbitPivot.visible = visible;
  if (moonToggle) moonToggle.setAttribute("aria-pressed", String(visible));
  if (moonButtonTitle) moonButtonTitle.textContent = visible ? "Ẩn Mặt Trăng" : "Hiện Mặt Trăng";
}
if (moonToggle) moonToggle.addEventListener("click", () => setMoonVisible(!isMoonVisible));
pauseButton.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? "Tiếp tục" : "Tạm dừng";
});
resetButton.addEventListener("click", () => {
  if (viewMode === "solar") {
    targetCameraPosition.copy(getSolarCameraPosition());
  } else if (isSunVisible) {
    targetCameraPosition.set(0, 5.0, 32.0);
  } else {
    targetCameraPosition.set(0, 1.5, 12.0);
  }
  targetControlsTarget.set(0, 0, 0);
  startTransition();
});

function resize() {
  const width = sceneElement.clientWidth;
  const height = sceneElement.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
}
window.addEventListener("resize", resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.getElapsedTime();
  const smooth = 1 - Math.pow(0.95, delta * 60); // hệ số làm mượt độc lập với FPS

  // 1. Sao lấp lánh nhẹ nhàng
  starUniforms.uTime.value = elapsedTime;
  
  // 2. Chuyển động xoay của các vật thể
  if (!isPaused) {
    if (earthModel) earthModel.rotation.y += delta * 0.16;
    if (moonModel) moonModel.rotation.y += delta * 0.10;
    
    moonOrbitPivot.rotation.y += delta * 0.4;

    if (isSunVisible) {
      earthOrbitGroup.rotation.y += delta * 0.25;
      sunLight.position.copy(sunPivot.position);
      sunLight.target.position.copy(earthPivot.localToWorld(new THREE.Vector3(0, 0, 0)));
      sunLight.target.updateMatrixWorld();
    }

    if (sunModel) sunModel.rotation.y += delta * 0.10;
  }

  // Về chế độ chỉ có Trái Đất: êm ái đưa góc quỹ đạo về 0 (thay vì nhảy tức thì)
  if (viewMode === "earth") {
    const goal = Math.round(earthOrbitGroup.rotation.y / (Math.PI * 2)) * Math.PI * 2;
    earthOrbitGroup.rotation.y += (goal - earthOrbitGroup.rotation.y) * smooth;
  }

  // 3. HIỆU ỨNG MORPHING VỊ TRÍ TRÁI ĐẤT, HỆ MẶT TRỜI & ÁNH SÁNG
  // Giữ hướng trục Trái Đất cố định trong không gian khi nó quay quanh Mặt Trời
  // (nếu không, trục nghiêng sẽ bị quỹ đạo "xoay theo" và lắc lư)
  earthPivot.rotation.y = -earthOrbitGroup.rotation.y;
  updateSolarSystem(delta, smooth);
  ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, targetAmbientIntensity, 0.05);
  fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, targetFillIntensity, 0.05);

  // 4. LƯỚT CAMERA VÀ TÂM XOAY TRONG QUÁ TRÌNH CHUYỂN CẢNH (SAU ĐÓ TỰ DO HOÀN TOÀN)
  if (isTransitioning) {
    transitionTime += delta;
    const k = 1 - Math.pow(1 - 0.05, delta * 60); // độc lập với FPS
    camera.position.lerp(targetCameraPosition, k);
    controls.target.lerp(targetControlsTarget, k);

    const arrived =
      camera.position.distanceTo(targetCameraPosition) < 0.05 &&
      controls.target.distanceTo(targetControlsTarget) < 0.05;

    // Đến nơi HOẶC quá thời gian => tắt hẳn, không bao giờ bị kẹt ở true
    if (arrived || transitionTime > TRANSITION_MAX_TIME) {
      isTransitioning = false;
    }
  }

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

loadModels();
animate();