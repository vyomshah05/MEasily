import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';


// ─────────────────────────────────────────────────────────────────────────────
// 1) LocalStorage keys & clear on load
// ─────────────────────────────────────────────────────────────────────────────
const STATE_KEY   = 'bodyModalState';
const PARTS_KEY   = 'completedParts';
const FOLLOW_KEY  = 'followUps';
localStorage.removeItem(STATE_KEY);
localStorage.removeItem(PARTS_KEY);
localStorage.removeItem(FOLLOW_KEY);

let modalState     = {};
let completedParts = [];
let followUps      = [];

// ─────────────────────────────────────────────────────────────────────────────
// 2) Grab DOM elements
// ─────────────────────────────────────────────────────────────────────────────
const bodyModalEl    = document.getElementById('bodyModal');
const bsBodyModal    = new bootstrap.Modal(bodyModalEl);
const modalPartEl    = document.getElementById('modal-part');
const capBtn         = document.getElementById('capture-btn');
const capPreview     = document.getElementById('capture-preview');
const descField      = document.getElementById('modal-description');
const recDescBtn     = document.getElementById('record-desc-btn');
const btnBodySubmit  = document.getElementById('modal-submit');

const followModalEl  = document.getElementById('followUpModal');
const bsFollowModal  = new bootstrap.Modal(followModalEl);
const followListEl   = document.getElementById('follow-up-list');

const runDiagBtn     = document.getElementById('run-diagnosis');
const reportPaneEl   = document.getElementById('report');

const webcamVideoEl  = document.getElementById('webcam');

// ─────────────────────────────────────────────────────────────────────────────
// 3) Canvas for snapshots
// ─────────────────────────────────────────────────────────────────────────────
const canvas = document.createElement('canvas');
const ctx    = canvas.getContext('2d');

// ─────────────────────────────────────────────────────────────────────────────
// 4) Recording vars & webcam stream ref
// ─────────────────────────────────────────────────────────────────────────────
let mediaRecorder, audioChunks = [];
let webcamStream;

// ─────────────────────────────────────────────────────────────────────────────
// 5) First modal: on show, start webcam & restore saved data
// ─────────────────────────────────────────────────────────────────────────────
bodyModalEl.addEventListener('shown.bs.modal', async () => {
  capPreview.style.display = 'none';
  capBtn.textContent       = 'Capture Image';
  descField.value          = '';

  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamVideoEl.srcObject = webcamStream;
  } catch (err) {
    console.error('Webcam error:', err);
  }

  const part  = modalPartEl.textContent;
  const state = modalState[part] || {};
  if (state.description) descField.value = state.description;
  if (state.preview) {
    capPreview.src           = state.preview;
    capPreview.style.display = 'block';
    capBtn.textContent       = 'Recapture Image';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6) First modal: on hide, stop webcam (we save on submit)
// ─────────────────────────────────────────────────────────────────────────────
bodyModalEl.addEventListener('hidden.bs.modal', () => {
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
    webcamVideoEl.srcObject = null;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7) Capture / Recapture Image
// ─────────────────────────────────────────────────────────────────────────────
capBtn.addEventListener('click', () => {
  canvas.width  = webcamVideoEl.videoWidth;
  canvas.height = webcamVideoEl.videoHeight;
  ctx.drawImage(webcamVideoEl, 0, 0, canvas.width, canvas.height);

  const dataURL = canvas.toDataURL('image/jpeg', 0.8);
  capPreview.src           = dataURL;
  capPreview.style.display = 'block';
  capBtn.textContent       = 'Recapture Image';
});

// ─────────────────────────────────────────────────────────────────────────────
// 8) Record & transcribe description
// ─────────────────────────────────────────────────────────────────────────────
recDescBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime   = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: mime });
      const form = new FormData();
      form.append('file', blob, `speech.${mime.split('/')[1]}`);

      try {
        const resp = await fetch('http://10.200.1.99:200/audio-capture-transcribe', {
          method: 'POST', body: form
        });
        if (!resp.ok) throw new Error(await resp.text());
        const { text } = await resp.json();
        descField.value = text;
      } catch (err) {
        console.error('Transcription error:', err);
        alert('Transcription failed');
      } finally {
        recDescBtn.textContent = 'Record Description';
        recDescBtn.disabled    = false;
      }
    };

    mediaRecorder.start();
    recDescBtn.textContent = 'Stop Recording';
  } else {
    mediaRecorder.stop();
    recDescBtn.textContent = 'Transcribing…';
    recDescBtn.disabled    = true;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9) Body-modal Submit: save this part’s data & close
// ─────────────────────────────────────────────────────────────────────────────
btnBodySubmit.addEventListener('click', () => {
  const part        = modalPartEl.textContent;
  const description = descField.value;
  const preview     = capPreview.src || '';

  modalState[part] = { description, preview };
  localStorage.setItem(STATE_KEY, JSON.stringify(modalState));

  if (!completedParts.includes(part)) {
    completedParts.push(part);
    localStorage.setItem(PARTS_KEY, JSON.stringify(completedParts));
  }

  bsBodyModal.hide();
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility: strip fences & parse the JSON snippet from LLM
// ─────────────────────────────────────────────────────────────────────────────
function cleanDiagnosisResponse(rawReport) {
  const match = rawReport.match(/```(?:json)?\n([\s\S]*?)```/);
  const jsonText = match ? match[1] : rawReport.trim();
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    console.error("Failed to parse diagnosis JSON:", err, jsonText);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10) Sidebar “Get Diagnosis”: fetch follow-ups, render form, then call diagnose
// ─────────────────────────────────────────────────────────────────────────────
runDiagBtn.addEventListener('click', async () => {
  if (completedParts.length === 0) {
    alert('Please submit at least one symptom before getting a diagnosis.');
    return;
  }
  if (completedParts.length === 1) {
    const ok = confirm('You’ve only submitted one symptom. The diagnosis may be less accurate. Proceed anyway?');
    if (!ok) return;
  }
  
  followListEl.innerHTML = '';
  const payload = completedParts.map(part => ({
    "body-part": part,
    "symptom-description": modalState[part]?.description || ""
  }));

  try {
    const resp = await fetch('http://10.200.1.99:200/follow-up', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[/follow-up] HTTP', resp.status, errText);
      throw new Error(`follow-up failed: ${resp.status}`);
    }

    const data = await resp.json();
    let rawFU = data['follow-ups'];

    if (typeof rawFU === 'string') {
      const noFences = rawFU
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const inner = JSON.parse(noFences);
      rawFU = inner['follow-ups'];
    }

    followUps = Array.isArray(rawFU) ? rawFU : [];

    const form = document.createElement('form');
    form.id = 'followUpForm';
    followUps.forEach((q, i) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-3';
      const label = document.createElement('label');
      label.className   = 'form-label';
      label.htmlFor     = `ans-${i}`;
      label.textContent = q;
      const textarea = document.createElement('textarea');
      textarea.className   = 'form-control';
      textarea.id          = `ans-${i}`;
      textarea.name        = 'answer';
      textarea.rows        = 2;
      textarea.placeholder = 'Your answer…';
      wrapper.append(label, textarea);
      form.append(wrapper);
    });
    const submitBtn = document.createElement('button');
    submitBtn.type        = 'submit';
    submitBtn.className   = 'btn btn-primary';
    submitBtn.textContent = 'Submit Answers';
    form.append(submitBtn);

    
    followListEl.append(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const answers = followUps.map((q, i) => ({
        "follow-up-question": q,
        response: form.elements['answer'][i].value.trim()
      }));
      console.log('➡️ Sending to /diagnose:', answers);
      try {
        const resp2 = await fetch('http://10.200.1.99:200/diagnose', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(answers)
        });
        let raw = await resp2.text();
        // raw = raw.replace(/^#+\s*/gm, '');
        // console.log('⬅️ Raw /diagnose response:', raw);
        if (!resp2.ok) {
          alert('Server error when diagnosing—check console.');
          return;
        }
        const parsed = cleanDiagnosisResponse(raw);
        
        if (parsed?.risk_analysis_report) {
          reportPaneEl.innerHTML = parsed.risk_analysis_report;
        } else {
          reportPaneEl.textContent = raw;
        }
        bsFollowModal.hide();
      } catch (err) {
        console.error('Network error calling /diagnose:', err);
        alert('Could not reach the diagnosis server.');
      }
      let reportMarkdown = parsed?.risk_analysis_report || raw;
      const html = marked.parse(reportMarkdown);
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const plainText = tmp.textContent.trim();
      localStorage.setItem('diagnosisReport', reportMarkdown);
      window.location.href = 'result.html';
    });

    bsFollowModal.show();
  } catch (err) {
    console.error('Follow-up fetch failed:', err);
    alert('Could not fetch follow-up questions.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11) Three.js scene & click → bodyModal
// ─────────────────────────────────────────────────────────────────────────────
let scene, camera, renderer, controls, modelGroup, modelBox;
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();
const infoLabel = document.createElement('div');
Object.assign(infoLabel.style, {
  position:'absolute', top:'10px', left:'10px',
  padding:'6px 10px', background:'rgba(0,0,0,0.6)',
  color:'#fff', fontFamily:'sans-serif', pointerEvents:'none'
});
document.getElementById('viewer').appendChild(infoLabel);

init(); loadModel(); animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    30, (window.innerWidth - 300) / window.innerHeight, 0.1, 1000
  );
  camera.position.set(0, 1.6, 4);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth - 300, window.innerHeight);
  document.getElementById('viewer').appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', onWindowResize);
}

function loadModel() {
  new GLTFLoader().load('human_body_base_cartoon.glb',
    gltf => {
      modelGroup = gltf.scene;
      scene.add(modelGroup);
      modelBox = new THREE.Box3().setFromObject(modelGroup);

      const c = modelBox.getCenter(new THREE.Vector3());
      const s = modelBox.getSize(new THREE.Vector3());
      const maxD = Math.max(s.x, s.y, s.z);
      const fovRad = camera.fov * Math.PI / 180;
      const dist   = (maxD / 2) / Math.tan(fovRad / 2);

      camera.position.set(c.x, c.y + maxD, c.z + dist);
      camera.updateProjectionMatrix();
      controls.target.copy(c);
    },
    xhr => console.log(`Loaded ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`),
    console.error
  );
}

function onPointerDown(e) {
  const symptom = document.getElementById('symptom').value;
  if (!symptom) { alert('Select a symptom first.'); return; }

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(modelGroup, true);
  if (!hits.length) return;

  const { point } = hits[0];
  const [minY, maxY] = [modelBox.min.y, modelBox.max.y];
  const pct = (point.y - minY) / (maxY - minY);
  const midX = (modelBox.min.x + modelBox.max.x) / 2;

  let part = 'Torso';
  if      (pct > 0.85) part = 'Head';
  else if (pct > 0.83) part = 'Neck';
  else if (pct > 0.75) part = point.x < midX ? 'Left Arm' : 'Right Arm';
  else if (pct > 0.45) part = 'Torso';
  else                 part = point.x < midX ? 'Left Leg' : 'Right Leg';

  infoLabel.textContent   = `You clicked on: ${part}`;
  modalPartEl.textContent = part;
  bsBodyModal.show();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onWindowResize() {
  const w = window.innerWidth - 300, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
