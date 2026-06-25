// Wires the room, signaling, and WebRTC mesh together.

import './style.css';
import { Signaling } from './signaling.js';
import { Room } from './room.js';
import { MeshAudio } from './rtc.js';

// In dev, default to the local server on the same host. In production this is
// baked at build time from the Render env var VITE_SIGNALING_URL.
const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || `ws://${location.hostname}:8080`;
const ROOM_NAME = 'main';

const joinScreen = document.getElementById('join');
const appScreen = document.getElementById('app');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('join-btn');
const statusEl = document.getElementById('status');
const muteBtn = document.getElementById('mute-btn');
const roomEl = document.getElementById('room');

let room, mesh, signaling, audioCtx, muted = false;

joinBtn.addEventListener('click', start);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });

function setStatus() {
  const n = room ? room.peers.size : 0;
  statusEl.textContent = `connected — ${n} other${n === 1 ? '' : 's'} here`;
}

async function start() {
  if (signaling) return; // already joined
  const name = (nameInput.value || 'Anon').trim().slice(0, 24) || 'Anon';
  joinBtn.disabled = true;
  statusEl.textContent = 'getting mic…';

  // Mic + AudioContext must be created inside this user gesture (the click).
  let localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    alert('Microphone access is required to join.');
    joinBtn.disabled = false;
    return;
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();

  joinScreen.hidden = true;
  appScreen.hidden = false;
  room = new Room(roomEl);
  room.setMe(name);

  signaling = new Signaling(SIGNALING_URL);
  signaling.on('close', () => { statusEl.textContent = 'disconnected — refresh to rejoin'; });

  signaling.on('welcome', async (msg) => {
    mesh = new MeshAudio({ localStream, iceServers: msg.iceServers, signaling, audioCtx });
    // We're the newcomer: render everyone already here and call each of them.
    for (const p of msg.peers) {
      room.addPeer(p.id, p.name, p.x, p.y);
      await mesh.callPeer(p.id);
    }
    setStatus();
  });

  signaling.on('peer-joined', (msg) => {
    room.addPeer(msg.id, msg.name, msg.x, msg.y);
    setStatus();
    // Don't call them — the newcomer initiates, so they'll call us.
  });

  signaling.on('peer-left', (msg) => {
    room.removePeer(msg.id);
    if (mesh) mesh.removePeer(msg.id);
    setStatus();
  });

  signaling.on('move', (msg) => room.setPeerPos(msg.id, msg.x, msg.y));
  signaling.on('signal', (msg) => { if (mesh) mesh.onSignal(msg.from, msg.data); });

  try {
    await signaling.connect();
  } catch {
    statusEl.textContent = 'could not reach the server';
    return;
  }
  signaling.send({ type: 'join', room: ROOM_NAME, name, x: room.me.x, y: room.me.y });

  // Main loop: move, sync position (throttled), update volumes from distance.
  let lastSent = 0;
  function loop(t) {
    const moved = room.step();
    if (moved && t - lastSent > 50) {
      signaling.send({ type: 'move', x: room.me.x, y: room.me.y });
      lastSent = t;
    }
    if (mesh) {
      for (const id of room.peers.keys()) mesh.setVolume(id, room.volumeFor(id));
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

muteBtn.addEventListener('click', () => {
  muted = !muted;
  if (mesh) mesh.setMuted(muted);
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  muteBtn.classList.toggle('active', muted);
});
