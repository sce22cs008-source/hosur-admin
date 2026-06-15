import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  const MODEL_URL = '/models';
  
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  
  modelsLoaded = true;
  console.log('Face-api models loaded successfully');
}

export async function getFaceDescriptor(imageElement) {
  await loadModels();
  const detection = await faceapi.detectSingleFace(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  if (!detection) {
    throw new Error('No face detected in image');
  }
  return detection.descriptor;
}

export function saveStaffFace(staffId, descriptorArray) {
  const registeredFaces = JSON.parse(localStorage.getItem('hosur_faces') || '{}');
  // Store as regular array so it can be JSON stringified
  registeredFaces[staffId] = Array.from(descriptorArray);
  localStorage.setItem('hosur_faces', JSON.stringify(registeredFaces));
}

export async function matchLiveFace(videoElement) {
  await loadModels();
  
  const detection = await faceapi.detectSingleFace(videoElement)
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  if (!detection) return null;
  
  const registeredFaces = JSON.parse(localStorage.getItem('hosur_faces') || '{}');
  const staffIds = Object.keys(registeredFaces);
  
  if (staffIds.length === 0) return null;
  
  const labeledDescriptors = staffIds.map(id => {
    return new faceapi.LabeledFaceDescriptors(
      id,
      [new Float32Array(registeredFaces[id])]
    );
  });
  
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55); // 0.55 threshold
  const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
  
  if (bestMatch.label === 'unknown') {
    return null;
  }
  
  return {
    staffId: bestMatch.label,
    distance: bestMatch.distance,
    box: detection.detection.box
  };
}
