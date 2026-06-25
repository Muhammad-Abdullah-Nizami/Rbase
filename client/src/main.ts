import './ui/styles.css';
import { SIGNALING_URL } from './config';
import { AudioEngine } from './audio/AudioEngine';
import { SignalingClient } from './signaling/SignalingClient';
import { JoinScreen } from './ui/JoinScreen';
import { Application } from './app/Application';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root element');

const stage = document.createElement('div');
stage.className = 'stage';
root.append(stage);

const joinScreen = new JoinScreen(stage);
let app: Application | null = null;

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

  const signaling = new SignalingClient({ url: SIGNALING_URL });
  joinScreen.hide();

  app = new Application({
    stage,
    name,
    localStream,
    audioEngine,
    signaling,
    onLeave: () => {
      app?.stop();
      app = null;
      joinScreen.show();
    },
  });
  app.start();
});
