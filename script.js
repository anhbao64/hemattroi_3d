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
camera.position.set(0, 1.1, 13.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
sceneElement.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.inset = "0";
labelRenderer.domElement.style.pointerEvents = "none";
sceneElement.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 7;
controls.maxDistance = 24;
controls.target.set(0, 0, 0);
controls.enablePan = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
scene.add(fillLight);

const earthPivot = new THREE.Group();
earthPivot.position.set(-2.45, 0, 0);
scene.add(earthPivot);

const sunPivot = new THREE.Group();
sunPivot.position.set(3.25, 0, 0);
scene.add(sunPivot);

const sunLight = new THREE.DirectionalLight(0xfff3d6, 4.5);
sunLight.position.copy(sunPivot.position);
sunLight.target.position.copy(earthPivot.position);
scene.add(sunLight, sunLight.target);
sunLight.visible = false;

const sunGlow = new THREE.PointLight(0xffa83d, 0, 8);
sunGlow.position.copy(sunPivot.position);
scene.add(sunGlow);

let earthModel = null;
let sunModel = null;
let isSunVisible = false;
let isPaused = false;
let earthRadius = 1.8;
let sunRadius = 1.2;

// Lưu trữ các material gốc của Trái Đất để chuyển đổi qua lại
let earthOriginalMaterials = new Map();

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
  addLine(earthPivot, equatorPoints, 0x8bd8ff, 0.88);

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
  sunGlow.intensity = visible ? 1.5 : 0;

  if (earthModel) {
    earthModel.traverse((object) => {
      if (object.isMesh) {
        if (visible) {
          // Khi BẬT Mặt Trời: Dùng material chuẩn để có vùng sáng / vùng tối rõ rệt
          if (earthOriginalMaterials.has(object)) {
            object.material = earthOriginalMaterials.get(object);
          }
          ambientLight.intensity = 0.25;
          fillLight.intensity = 0.2;
        } else {
          // Khi TẮT Mặt Trời: Chuyển sang MeshBasicMaterial để Trái Đất sáng đều, rõ nét, không bị tối thui
          if (!object.userData.basicMaterial) {
            const origMat = earthOriginalMaterials.get(object);
            object.userData.basicMaterial = new THREE.MeshBasicMaterial({
              map: origMat.map || null,
              color: origMat.color || new THREE.Color(0xffffff)
            });
          }
          object.material = object.userData.basicMaterial;
          ambientLight.intensity = 1.2;
          fillLight.intensity = 1.0;
        }
      }
    });
  }

  sunToggle.setAttribute("aria-pressed", String(visible));
  sunButtonTitle.textContent = visible ? "Ẩn Mặt Trời" : "Hiện Mặt Trời";
  stageCaption.textContent = visible
    ? "Mặt Trời chiếu sáng Trái Đất"
    : "Trái Đất đang tự quay quanh trục";
}

async function loadModels() {
  const loader = new GLTFLoader();
  try {
    const [earthGltf, sunGltf] = await Promise.all([
      loader.loadAsync("./model_3d/Earth.glb"),
      loader.loadAsync("./model_3d/Sun.glb")
    ]);

    earthModel = earthGltf.scene;
    sunModel = sunGltf.scene;

    earthRadius = normalizeModel(earthModel, 3.45);
    sunRadius = normalizeModel(sunModel, 2.5);

    earthModel.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) {
          earthOriginalMaterials.set(object, object.material);
          // Mặc định ban đầu chưa bật Mặt Trời nên dùng MeshBasicMaterial cho sáng rõ
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
          object.material.emissiveIntensity = Math.max(object.material.emissiveIntensity || 0, 0.8);
        }
      }
    });

    earthPivot.add(earthModel);
    sunPivot.add(sunModel);
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
  camera.position.set(0, 1.1, 13.8);
  controls.target.set(0, 0, 0);
  controls.update();
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
  if (!isPaused) {
    if (earthModel) earthModel.rotation.y += delta * 0.16;
    if (sunModel) sunModel.rotation.y += delta * 0.10;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

loadModels();
animate();