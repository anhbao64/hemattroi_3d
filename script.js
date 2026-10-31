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
const stageCaption = document.getElementById("stageCaption");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050914);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
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
controls.maxDistance = 60;
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
    const r = 150 + Math.random() * 150;
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

// Ánh sáng Mặt Trời
const sunLight = new THREE.DirectionalLight(0xffffff, 8.0);
sunLight.target.position.copy(earthPivot.position);
scene.add(sunLight, sunLight.target);
sunLight.visible = false;

const sunGlow = new THREE.PointLight(0xffa83d, 0, 8);
sunGlow.position.copy(sunPivot.position);
scene.add(sunGlow);

let earthModel = null;
let sunModel = null;
let moonModel = null;
let isSunVisible = false;
let isMoonVisible = false;
let isPaused = false;
let earthRadius = 1.8;

// Biến quản lý Morphing mượt mà
let isTransitioning = false;
let transitionTime = 0;
const TRANSITION_MAX_TIME = 2.5; // giây - quá thời gian này tự trả quyền cho chuột
let targetCameraPosition = new THREE.Vector3(0, 1.5, 12.0);
let targetControlsTarget = new THREE.Vector3(0, 0, 0);
let targetEarthPosition = new THREE.Vector3(0, 0, 0);
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

function trackDetail(object) {
  earthDetailObjects.push(object);
  return object;
}

function updateEarthDetailVisibility() {
  earthDetailObjects.forEach((object) => { object.visible = !isSunVisible; });
  if (earthNameLabel) earthNameLabel.visible = isSunVisible;
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
  const equatorLabel = makeLabel("Đường Xích đạo");
  equatorLabel.position.set(0, 0, radius * 1.4);
  earthTiltGroup.add(equatorLabel);

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
  earthNameLabel.position.set(0, radius * 1.45, 0);
  earthPivot.add(earthNameLabel);

  updateEarthDetailVisibility();
}

function setSunVisible(visible) {
  isSunVisible = visible;
  sunPivot.visible = visible;
  sunLight.visible = visible;
  sunGlow.intensity = visible ? 2.5 : 0;
  orbitLine.visible = visible;
  updateEarthDetailVisibility(); // bật Mặt Trời: ẩn chú thích, chỉ còn tên Trái Đất + xích đạo
  orbitLabel.visible = visible; // nhãn CSS2D không tự ẩn theo nhóm cha nên phải đặt riêng

  startTransition(); // Kích hoạt hiệu ứng chuyển cảnh mượt (có thể bị huỷ khi người dùng kéo chuột)

  if (visible) {
    targetEarthPosition.set(EARTH_SUN_DISTANCE, 0, 0);
    targetCameraPosition.set(0, 5.0, 32.0);
    targetControlsTarget.set(0, 0, 0); // Nhìn về tâm Mặt Trời
    targetAmbientIntensity = 0.35;
    targetFillIntensity = 0.25;
  } else {
    targetEarthPosition.set(0, 0, 0);
    earthOrbitGroup.rotation.y = 0;
    targetCameraPosition.set(0, 1.5, 12.0);
    targetControlsTarget.set(0, 0, 0); // Nhìn về tâm Trái Đất
    targetAmbientIntensity = 1.2;
    targetFillIntensity = 0.9;
  }

  // Đổi Material theo trạng thái
  if (earthModel) {
    earthModel.traverse((object) => {
      if (object.isMesh) {
        if (visible) {
          if (earthOriginalMaterials.has(object)) object.material = earthOriginalMaterials.get(object);
        } else {
          if (!object.userData.basicMaterial) {
            const origMat = earthOriginalMaterials.get(object);
            object.userData.basicMaterial = new THREE.MeshBasicMaterial({
              map: origMat.map || null,
              color: origMat.color || new THREE.Color(0xffffff)
            });
          }
          object.material = object.userData.basicMaterial;
        }
      }
    });
  }

  if (moonModel) {
    moonModel.traverse((object) => {
      if (object.isMesh) {
        if (visible) {
          if (moonOriginalMaterials.has(object)) object.material = moonOriginalMaterials.get(object);
        } else {
          if (!object.userData.basicMaterial) {
            const origMat = moonOriginalMaterials.get(object);
            object.userData.basicMaterial = new THREE.MeshBasicMaterial({
              map: origMat.map || null,
              color: origMat.color || new THREE.Color(0xffffff)
            });
          }
          object.material = object.userData.basicMaterial;
        }
      }
    });
  }

  sunToggle.setAttribute("aria-pressed", String(visible));
  sunButtonTitle.textContent = visible ? "Ẩn Mặt Trời" : "Hiện Mặt Trời";
  stageCaption.textContent = visible
    ? "Mặt Trời xuất hiện · Trái Đất quay trên quỹ đạo quanh Mặt Trời"
    : "Trái Đất là trung tâm · Đang tự quay quanh trục";
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
  if (isSunVisible) {
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

  // 3. HIỆU ỨNG MORPHING VỊ TRÍ TRÁI ĐẤT & ÁNH SÁNG
  // Giữ hướng trục Trái Đất cố định trong không gian khi nó quay quanh Mặt Trời
  // (nếu không, trục nghiêng sẽ bị quỹ đạo "xoay theo" và lắc lư)
  earthPivot.rotation.y = -earthOrbitGroup.rotation.y;
  earthPivot.position.lerp(targetEarthPosition, 0.05);
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