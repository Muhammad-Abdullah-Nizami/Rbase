import './ui/styles.css';
import { SIGNALING_URL } from './config';
import { AudioEngine } from './audio/AudioEngine';
import { SignalingClient } from './signaling/SignalingClient';
import { JoinScreen } from './ui/JoinScreen';
import { Application } from './app/Application';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root element');

const joinScreen = new JoinScreen(root);

joinScreen.onJoin(async (name) => {
  joinScreen.setBusy(true);

  // getUserMedia + AudioContext must start inside this user gesture.
  let localStream: MediaStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    joinScreen.showError('Microphone access is required to join.');
    return;
  }

  const audioEngine = new AudioEngine();
  try {
    await audioEngine.resume();
  } catch {
    // Some browsers resume lazily on first output — not fatal.
  }

  joinScreen.remove();

  const signaling = new SignalingClient({ url: SIGNALING_URL });
  const app = new Application({ root, name, localStream, audioEngine, signaling });
  app.start();
});
