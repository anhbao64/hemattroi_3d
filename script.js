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
const stageCaption = document.getElementById("stageCaption");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050914);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
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
// 🌌 NỀN VŨ TRỤ VỚI CÁC NGÔI SAO LẤP LÁNH
// ==========================================
let starMaterial;
function createStarfield() {
  const starsCount = 1200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starsCount * 3);
  const colors = new Float32Array(starsCount * 3);

  for (let i = 0; i < starsCount; i++) {
    const r = 40 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const brightness = 0.5 + Math.random() * 0.5;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness * (0.85 + Math.random() * 0.15);
    colors[i * 3 + 2] = brightness;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  starMaterial = new THREE.PointsMaterial({
    size: 0.11,
    vertexColors: true,
    transparent: true,
    opacity: 0.8
  });

  const starField = new THREE.Points(geometry, starMaterial);
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

// Nhóm Trái Đất
const earthPivot = new THREE.Group();
earthPivot.position.set(0, 0, 0);
earthOrbitGroup.add(earthPivot);

// Nhóm quay của Mặt Trăng quanh Trái Đất
const moonOrbitPivot = new THREE.Group();
earthPivot.add(moonOrbitPivot);

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

function addEarthAnnotations(radius) {
  const tilt = THREE.MathUtils.degToRad(23.5);
  const axisDirection = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0).normalize();
  const axisLength = radius * 1.48;
  const axisStart = axisDirection.clone().multiplyScalar(-axisLength);
  const axisEnd = axisDirection.clone().multiplyScalar(axisLength);
  addLine(earthPivot, [axisStart, axisEnd], 0xffd27a, 0.95);

  const north = makeLabel("Cực Bắc", true);
  north.position.copy(axisEnd.clone().multiplyScalar(1.12));
  earthPivot.add(north);

  const south = makeLabel("Cực Nam", true);
  south.position.copy(axisStart.clone().multiplyScalar(1.12));
  earthPivot.add(south);

  const axisLabel = makeLabel("Trục Trái Đất");
  axisLabel.position.copy(axisEnd.clone().multiplyScalar(1.42)).add(new THREE.Vector3(0.22, 0.05, 0));
  earthPivot.add(axisLabel);

  const equatorPoints = [];
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(axisDirection)) > 0.92) u.set(0, 0, 1);
  u.cross(axisDirection).normalize();
  const v = axisDirection.clone().cross(u).normalize();
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    equatorPoints.push(u.clone().multiplyScalar(Math.cos(a) * radius * 1.008)
      .add(v.clone().multiplyScalar(Math.sin(a) * radius * 1.008)));
  }
  addLine(earthPivot, equatorPoints, 0x8bd8ff, 0x88);

  const equatorLabel = makeLabel("Đường Xích đạo");
  equatorLabel.position.copy(u.clone().multiplyScalar(radius * 1.35).add(new THREE.Vector3(0, -0.2, 0.2)));
  earthPivot.add(equatorLabel);

  const west = makeLabel("Hướng Tây");
  west.position.set(-radius * 1.45, -radius * 0.45, radius * 0.2);
  earthPivot.add(west);

  const east = makeLabel("Hướng Đông");
  east.position.set(radius * 1.45, -radius * 0.45, radius * 0.2);
  earthPivot.add(east);

  const angle1 = makeLabel("23°27′", true);
  angle1.position.set(radius * 0.8, radius * 1.25, radius * 0.05);
  earthPivot.add(angle1);

  const angle2 = makeLabel("66°33′", true);
  angle2.position.set(-radius * 0.95, -radius * 1.23, radius * 0.05);
  earthPivot.add(angle2);
}

function setSunVisible(visible) {
  isSunVisible = visible;
  sunPivot.visible = visible;
  sunLight.visible = visible;
  sunGlow.intensity = visible ? 2.5 : 0;

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

    earthPivot.add(earthModel);
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
  if (starMaterial) {
    starMaterial.opacity = 0.7 + Math.sin(elapsedTime * 2.5) * 0.15;
  }
  
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