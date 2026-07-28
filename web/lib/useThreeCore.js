// component/useThreeCore.js
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Sets up a minimal Three.js scene inside the returned ref's container.
 * Renders a simple placeholder mesh — swap with real character models later.
 *
 * @param {boolean} active - whether the 3D layer is currently in use
 */
export function useThreeCore(active) {
  const containerRef = useRef(null);
  const stateRef = useRef(null); // holds renderer/scene/camera/animationId

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Placeholder mesh — an icosahedron standing in for a character model
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      wireframe: false,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const point = new THREE.PointLight(0xffffff, 1.2);
    point.position.set(3, 3, 3);
    scene.add(point);

    let animationId;
    const animate = () => {
      mesh.rotation.y += 0.008;
      mesh.rotation.x += 0.003;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    stateRef.current = { renderer, scene, camera, animationId };

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [active]);

  return containerRef;
}