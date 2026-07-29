'use client';

import { useEffect, useRef, useImperativeHandle, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Reuse in-flight/completed GLTF loads (avoids Strict Mode double-fetch blob races). */
const gltfCache = new Map();

function loadGltfCached(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(
      url,
      new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(url, resolve, undefined, reject);
      })
    );
  }
  return gltfCache.get(url);
}

/**
 * MOUTH BEHAVIOR (this is the part that changed):
 *   - At rest: all mouth shape keys (normal_open/half_open/wide_open) sit
 *     at 0 — i.e. Basis, mouth fully closed.
 *   - While talking: a fixed-timer cycle steps through the mouth shape
 *     keys ONE AT A TIME — never more than one active at once — following
 *     the sequence [normal_open, half_open, wide_open, half_open], looping,
 *     roughly every 150ms. This is driven by an internal timer, not by
 *     live audio amplitude — much more predictable given how fiddly these
 *     shape keys have been to get right.
 *   - setMouthWeights() is still the entry point called every frame by
 *     useMouthSync, but now it only flips an on/off "is talking" flag
 *     (true if any incoming weight is above a small threshold) — the
 *     actual stepping through keys happens inside the render loop below.
 */
export function useCharacterScene(containerRef, forwardedRef, state, onWake) {
  const sceneRefs = useRef({});
  const [modelError, setModelError] = useState(null);
  const awake = state !== 'idle';

  useEffect(() => {
    const container = containerRef.current;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.35, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = 'pointer';

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x2a2050, 0.9));
    scene.add(new THREE.AmbientLight(0x4a3a7a, 0.6));

    const keyLight = new THREE.DirectionalLight(0xffd9a0, 1.5);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8a7bff, 0.9);
    rimLight.position.set(-4, 2, -3);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xffb84d, 0.7, 10);
    fillLight.position.set(0, -1, 3);
    scene.add(fillLight);

    function makeGlowTexture() {
      const size = 256;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(244,200,105,0.9)');
      g.addColorStop(0.4, 'rgba(217,164,65,0.35)');
      g.addColorStop(1, 'rgba(217,164,65,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    }
    const glowMat = new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(5.5, 5.5, 1);
    glowSprite.position.set(0, 0.1, -0.6);
    scene.add(glowSprite);

    const characterGroup = new THREE.Group();
    scene.add(characterGroup);

    let mixer = null;
    let morphMeshes = [];
    let blinkMorphKeys = [];
    // NEW: the ordered list of mouth-open shape keys, one entry per key
    // found, e.g. [{mesh, index, name:'normal_open'}, {mesh, index, name:'half_open'}, ...]
    let mouthOpenKeys = [];
    let jawBone = null;
    let jawBoneRestX = 0;

    function findMorphTargets(root) {
      const meshes = [];
      root.traverse((node) => {
        if (node.isMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
          meshes.push(node);
        }
        if (node.isBone && !jawBone && /jaw/i.test(node.name)) {
          jawBone = node;
          jawBoneRestX = node.rotation.x;
        }
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      return meshes;
    }

    // Preferred step order for the talk-cycle. Matched case-insensitively
    // against your actual shape key names (normal_open / half_open / wide_open).
    // If a name isn't found it's just skipped — doesn't break anything.
    const MOUTH_CYCLE_ORDER = ['normal_open', 'half_open', 'wide_open', 'half_open'];

    let cancelled = false;

    loadGltfCached('/models/kahoola.glb')
      .then((gltf) => {
        if (cancelled) return;

        const model = gltf.scene.clone(true);
        characterGroup.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const targetHeight = 2.2;
        const scale = size.y > 0 ? targetHeight / size.y : 1;
        model.scale.setScalar(scale);
        const box2 = new THREE.Box3().setFromObject(model);
        const center2 = new THREE.Vector3();
        box2.getCenter(center2);
        model.position.sub(center2);

        morphMeshes = findMorphTargets(model);

        const allNames = morphMeshes.flatMap((m) => Object.keys(m.morphTargetDictionary));
        if (allNames.length) {
          console.info('[useCharacterScene] Discovered morph targets:', allNames);
        } else {
          console.info('[useCharacterScene] No morph targets found on kahoola.glb');
        }
        if (jawBone) {
          console.info('[useCharacterScene] Using jaw bone fallback for lip sync:', jawBone.name);
        }

        blinkMorphKeys = [];
        morphMeshes.forEach((mesh) => {
          Object.entries(mesh.morphTargetDictionary).forEach(([name, index]) => {
            if (/blink|eye/i.test(name)) {
              blinkMorphKeys.push({ mesh, index });
            }
          });
        });

        // Build the ordered mouth-cycle list by matching MOUTH_CYCLE_ORDER
        // names against whatever shape keys actually exist on the model.
        mouthOpenKeys = [];
        MOUTH_CYCLE_ORDER.forEach((wantedName) => {
          morphMeshes.forEach((mesh) => {
            Object.entries(mesh.morphTargetDictionary).forEach(([name, index]) => {
              if (name.toLowerCase() === wantedName.toLowerCase()) {
                mouthOpenKeys.push({ mesh, index, name });
              }
            });
          });
        });
        if (mouthOpenKeys.length) {
          console.info(
            '[useCharacterScene] Mouth talk-cycle order:',
            mouthOpenKeys.map((k) => k.name)
          );
        } else {
          console.warn(
            '[useCharacterScene] None of normal_open/half_open/wide_open found — mouth will not animate.'
          );
        }

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          const idleClip =
            gltf.animations.find((c) => /idle/i.test(c.name)) || gltf.animations[0];
          mixer.clipAction(idleClip).play();
        }

        sceneRefs.current.model = model;
        sceneRefs.current.morphMeshes = morphMeshes;
        sceneRefs.current.blinkMorphKeys = blinkMorphKeys;
        sceneRefs.current.mouthOpenKeys = mouthOpenKeys;
        sceneRefs.current.jawBone = jawBone;
        sceneRefs.current.jawBoneRestX = jawBoneRestX;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useCharacterScene] Failed to load kahoola.glb:', err);
        setModelError(err?.message || 'Failed to load model');
      });

    function makeTextSprite(text, size) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.font = 'bold 64px Cairo, sans-serif';
      ctx.fillStyle = '#F4C869';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 68);
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(size, size, 1);
      return sprite;
    }
    const zzz = makeTextSprite('z', 0.5);
    zzz.position.set(0.55, 0.95, 0.3);
    characterGroup.add(zzz);

    characterGroup.position.y = -0.15;

    const burstGeo = new THREE.BufferGeometry();
    const burstCount = 60;
    const burstPositions = new Float32Array(burstCount * 3);
    const burstVelocities = [];
    for (let i = 0; i < burstCount; i++) {
      burstPositions[i * 3] = 0;
      burstPositions[i * 3 + 1] = 0.1;
      burstPositions[i * 3 + 2] = 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 0.015 + Math.random() * 0.03;
      burstVelocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed + 0.01,
          Math.cos(phi) * speed
        )
      );
    }
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
    const burstMat = new THREE.PointsMaterial({
      color: 0xf4c869,
      size: 0.05,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const burstPoints = new THREE.Points(burstGeo, burstMat);
    scene.add(burstPoints);
    let burstActive = false;
    let burstT = 0;
    let wakeScaleT = null;

    function triggerWakeBurst() {
      zzz.visible = false;
      burstActive = true;
      burstT = 0;
      burstMat.opacity = 1;
      for (let i = 0; i < burstCount; i++) {
        burstPositions[i * 3] = 0;
        burstPositions[i * 3 + 1] = 0.1;
        burstPositions[i * 3 + 2] = 0.5;
      }
      wakeScaleT = 0;
    }

    function handleClick() {
      if (!sceneRefs.current.awakeRef) {
        triggerWakeBurst();
        onWake?.();
      }
    }
    renderer.domElement.addEventListener('click', handleClick);

    let blinkTimer = 0;
    let blinking = false;
    let blinkT = 0;

    // ---------- NEW: mouth talk-cycle state ----------
    let isTalking = false;
    let mouthCycleTimer = 0;
    let mouthCycleIndex = 0;
    const MOUTH_STEP_SECONDS = 0.15;

    function setAllMouthKeysTo(value) {
      const keys = sceneRefs.current.mouthOpenKeys || [];
      keys.forEach(({ mesh, index }) => {
        mesh.morphTargetInfluences[index] = value;
      });
    }

    const timer = new THREE.Timer();
    timer.connect(document);
    let frameId;

    function animate(timestamp) {
      frameId = requestAnimationFrame(animate);
      timer.update(timestamp);
      const t = timer.getElapsed();
      const dt = timer.getDelta();
      const isAwake = sceneRefs.current.awakeRef;

      if (mixer) mixer.update(dt);

      const bobSpeed = isAwake ? 1.5 : 0.9;
      const bobAmount = isAwake ? 0.06 : 0.035;
      characterGroup.position.y = -0.15 + Math.sin(t * bobSpeed) * bobAmount;
      characterGroup.rotation.z = Math.sin(t * bobSpeed * 0.6) * 0.015;
      characterGroup.rotation.y = Math.sin(t * 0.35) * 0.12;

      if (wakeScaleT !== null) {
        wakeScaleT += dt;
        const p = Math.min(wakeScaleT / 0.45, 1);
        const s = 1 + Math.sin(p * Math.PI) * 0.12;
        characterGroup.scale.set(s, s, s);
        if (p >= 1) wakeScaleT = null;
      }

      const glowPulse = isAwake
        ? 5.8 + Math.sin(t * 2.2) * 0.35
        : 5.2 + Math.sin(t * 1.2) * 0.15;
      glowSprite.scale.set(glowPulse, glowPulse, 1);
      glowMat.opacity = isAwake ? 0.85 : 0.55 + Math.sin(t * 1.2) * 0.08;

      if (zzz.visible) {
        zzz.position.y = 0.95 + Math.sin(t * 1.4) * 0.05;
        zzz.material.opacity = 0.6 + Math.sin(t * 1.4) * 0.4;
      }

      if (burstActive) {
        burstT += dt;
        const posAttr = burstGeo.attributes.position;
        for (let i = 0; i < burstCount; i++) {
          posAttr.array[i * 3] += burstVelocities[i].x;
          posAttr.array[i * 3 + 1] += burstVelocities[i].y;
          posAttr.array[i * 3 + 2] += burstVelocities[i].z;
          burstVelocities[i].y -= 0.0006;
        }
        posAttr.needsUpdate = true;
        burstMat.opacity = Math.max(0, 1 - burstT / 1.1);
        if (burstT > 1.1) burstActive = false;
      }

      // ---------- NEW: mouth talk-cycle, one key at a time, Basis when quiet ----------
      const mouthKeys = sceneRefs.current.mouthOpenKeys || [];
      if (mouthKeys.length) {
        if (isTalking) {
          mouthCycleTimer += dt;
          if (mouthCycleTimer >= MOUTH_STEP_SECONDS) {
            mouthCycleTimer = 0;
            mouthCycleIndex = (mouthCycleIndex + 1) % mouthKeys.length;
            setAllMouthKeysTo(0); // clear every key first
            mouthKeys[mouthCycleIndex].mesh.morphTargetInfluences[mouthKeys[mouthCycleIndex].index] = 1;
          }
        } else {
          // Not talking → Basis. Reset cycle so it always restarts from
          // the beginning of the sequence next time speech starts.
          setAllMouthKeysTo(0);
          mouthCycleTimer = 0;
          mouthCycleIndex = 0;
        }
      }

      // Jaw bone fallback stays continuous/amplitude-driven (separate,
      // lower-priority path — only matters if the model has NO mouth
      // morph targets at all, which isn't the case for kahoola.glb).
      const jawBone = sceneRefs.current.jawBone;
      if (jawBone) {
        const restX = sceneRefs.current.jawBoneRestX || 0;
        jawBone.rotation.x = restX + (isTalking ? 0.35 : 0);
      }

      if (isAwake) {
        blinkTimer += dt;
        if (!blinking && blinkTimer > 3.2 + Math.random() * 2) {
          blinking = true;
          blinkT = 0;
          blinkTimer = 0;
        }
        if (blinking) {
          blinkT += dt;
          const show = blinkT < 0.14;
          sceneRefs.current.blinkMorphKeys?.forEach(({ mesh, index }) => {
            mesh.morphTargetInfluences[index] = show ? 1 : 0;
          });
          if (blinkT > 0.16) blinking = false;
        }
      } else {
        sceneRefs.current.blinkMorphKeys?.forEach(({ mesh, index }) => {
          mesh.morphTargetInfluences[index] = 0;
        });
      }

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    sceneRefs.current = {
      ...sceneRefs.current,
      zzz,
      triggerWakeBurst,
      awakeRef: false,
      isTalkingRef: { get: () => isTalking, set: (v) => (isTalking = v) },
    };

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      pmremGenerator.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRefs.current.awakeRef = awake;
    if (awake && sceneRefs.current.zzz) {
      sceneRefs.current.zzz.visible = false;
    }
    if (awake && sceneRefs.current.triggerWakeBurst && state === 'waking') {
      sceneRefs.current.triggerWakeBurst();
    }
  }, [state, awake]);

  // ---------- setMouthWeights: now just an on/off gate, not a value-blend ----------
  useImperativeHandle(forwardedRef, () => ({
    setMouthWeights(weights) {
      const values = Object.values(weights || {});
      const maxWeight = values.length ? Math.max(...values) : 0;
      const talkingNow = maxWeight > 0.08; // small threshold, tune if it feels twitchy
      sceneRefs.current.isTalkingRef?.set(talkingNow);
    },
  }));

  return { modelError };
}