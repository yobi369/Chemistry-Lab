import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType, Particle } from '../types/chemistry';
import {
  Box,
  RotateCcw,
  Sparkles,
  Layers,
  Eye,
  Camera,
  Maximize2,
  Sliders,
  Flame,
  Zap,
  Info
} from 'lucide-react';

interface ThreeSpatialChamberProps {
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  onInject: (typeId: string, count: number) => void;
}

export const ThreeSpatialChamber: React.FC<ThreeSpatialChamberProps> = ({
  engine,
  moleculeTypes,
  onInject
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereGroupRef = useRef<THREE.Group | null>(null);
  const flashGroupRef = useRef<THREE.Group | null>(null);

  const [selectedMolecule, setSelectedMolecule] = useState<string>(moleculeTypes[0]?.id || '');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [rotationSpeed, setRotationSpeed] = useState<number>(0.005);
  const [bloomGlow, setBloomGlow] = useState<boolean>(true);
  const [chamberShape, setChamberShape] = useState<'cylinder' | 'cube' | 'sphere'>('cylinder');
  const [fov, setFov] = useState<number>(60);
  const [particleCount3D, setParticleCount3D] = useState<number>(0);

  // Reusable geometry and material cache
  const sphereGeoRef = useRef<THREE.SphereGeometry>(new THREE.SphereGeometry(1, 16, 16));
  const matCacheRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  // Mouse interaction state for camera rotation
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (moleculeTypes.length > 0 && !selectedMolecule) {
      setSelectedMolecule(moleculeTypes[0].id);
    }
  }, [moleculeTypes]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070c);
    scene.fog = new THREE.FogExp2(0x05070c, 0.0015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 2000);
    camera.position.set(0, 50, 450);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x334155, 1.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x10b981, 3, 600);
    pointLight1.position.set(200, 200, 200);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x06b6d4, 2.5, 600);
    pointLight2.position.set(-200, -150, 200);
    scene.add(pointLight2);

    const centerGlow = new THREE.PointLight(0xec4899, 1.5, 300);
    centerGlow.position.set(0, 0, 0);
    scene.add(centerGlow);

    // 5. Containment Vessel Grid Wireframe
    const vesselMesh = createChamberVessel(chamberShape);
    scene.add(vesselMesh);

    // 6. Particle & Flash Groups
    const sphereGroup = new THREE.Group();
    scene.add(sphereGroup);
    sphereGroupRef.current = sphereGroup;

    const flashGroup = new THREE.Group();
    scene.add(flashGroup);
    flashGroupRef.current = flashGroup;

    // Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width: w, height: h } = entries[0].contentRect;
      if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Auto rotation
      if (autoRotate && sphereGroupRef.current && vesselMesh) {
        sphereGroupRef.current.rotation.y += rotationSpeed;
        vesselMesh.rotation.y += rotationSpeed * 0.5;
      }

      // Sync with ChemEngine 2D particles projected into 3D cylinder/volume
      syncParticlesWithEngine();

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      matCacheRef.current.forEach(m => m.dispose());
      matCacheRef.current.clear();
      sphereGeoRef.current.dispose();
    };
  }, [chamberShape, fov]);

  // Helper to create chamber visual boundaries
  const createChamberVessel = (shape: 'cylinder' | 'cube' | 'sphere'): THREE.Object3D => {
    const group = new THREE.Group();

    if (shape === 'cylinder') {
      const geo = new THREE.CylinderGeometry(200, 200, 280, 32, 8, true);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        wireframe: true,
        transparent: true,
        opacity: 0.25
      });
      const mesh = new THREE.Mesh(geo, wireMat);
      group.add(mesh);

      // Top and bottom glowing rings
      const ringGeo = new THREE.TorusGeometry(200, 2, 16, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const topRing = new THREE.Mesh(ringGeo, ringMat);
      topRing.rotation.x = Math.PI / 2;
      topRing.position.y = 140;
      group.add(topRing);

      const botRing = topRing.clone();
      botRing.position.y = -140;
      group.add(botRing);
    } else if (shape === 'sphere') {
      const geo = new THREE.SphereGeometry(220, 24, 16);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        wireframe: true,
        transparent: true,
        opacity: 0.2
      });
      const mesh = new THREE.Mesh(geo, wireMat);
      group.add(mesh);
    } else {
      const geo = new THREE.BoxGeometry(360, 260, 360, 8, 8, 8);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        wireframe: true,
        transparent: true,
        opacity: 0.2
      });
      const mesh = new THREE.Mesh(geo, wireMat);
      group.add(mesh);
    }

    return group;
  };

  // Synchronize 3D meshes with 2D ChemEngine particles
  const syncParticlesWithEngine = () => {
    const group = sphereGroupRef.current;
    if (!group) return;

    const particles = engine.particles;
    setParticleCount3D(particles.length);

    // Adjust group children count
    while (group.children.length < particles.length) {
      const mesh = new THREE.Mesh(sphereGeoRef.current);
      group.add(mesh);
    }
    while (group.children.length > particles.length) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
    }

    // Map 2D coordinate space (800x550) to 3D chamber coordinates (-180 to 180)
    const scaleX = 360 / (engine.width || 800);
    const scaleY = 240 / (engine.height || 550);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const mesh = group.children[i] as THREE.Mesh;
      if (!mesh) continue;

      const posX = (p.x - engine.width / 2) * scaleX;
      const posY = -(p.y - engine.height / 2) * scaleY;
      // Deterministic pseudo-Z depth based on particle hash & speed
      const posZ = Math.sin(p.age * 0.05 + i) * 60;

      mesh.position.set(posX, posY, posZ);

      // Scale radius
      const r = (p.radius || 6) * 0.9;
      mesh.scale.set(r, r, r);

      // Material
      let mat = matCacheRef.current.get(p.typeId);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(p.color || '#10b981'),
          emissive: new THREE.Color(p.color || '#10b981'),
          emissiveIntensity: bloomGlow ? 0.6 : 0.2,
          roughness: 0.2,
          metalness: 0.8
        });
        matCacheRef.current.set(p.typeId, mat);
      }
      mesh.material = mat;
    }
  };

  // Mouse Drag to Orbit Camera
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !cameraRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    const camera = cameraRef.current;
    // Orbit horizontally and vertically around origin
    const radius = Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2);
    let theta = Math.atan2(camera.position.x, camera.position.z);
    let phi = Math.acos(Math.max(-1, Math.min(1, camera.position.y / radius)));

    theta -= dx * 0.008;
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + dy * 0.008));

    camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = radius * Math.cos(phi);
    camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(0, 0, 0);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    const zoomFactor = e.deltaY * 0.3;
    const camera = cameraRef.current;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, -zoomFactor * 0.5);
  };

  const handleResetCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 50, 450);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  return (
    <div id="three-spatial-chamber-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
            3D Volumetric Reactor Chamber (WebGL / Three.js)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            Specular Spatial Shading
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-zinc-400">3D Meshes: <b className="text-cyan-400">{particleCount3D}</b></span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">Core Temp: <b className="text-amber-400">{Math.round(engine.temperature)}K</b></span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">Energy Pool: <b className="text-emerald-400">{Math.round(engine.energyPool)}J</b></span>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: 3D Viewport */}
        <div className="lg:col-span-9 flex flex-col gap-2 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Real-Time Volumetric Particle Spatializer</span>
            </span>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              Click & Drag to Orbit • Scroll to Zoom
            </span>
          </div>

          {/* WebGL Canvas Container */}
          <div
            ref={mountRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-[480px] rounded-xl overflow-hidden border border-zinc-800 bg-[#05070c] relative cursor-grab active:cursor-grabbing shadow-inner"
          />

          {/* Bottom Toolbar Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-mono">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                  autoRotate
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-zinc-850 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{autoRotate ? 'Auto Orbit ON' : 'Auto Orbit OFF'}</span>
              </button>

              <button
                onClick={handleResetCamera}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Cam</span>
              </button>

              <button
                onClick={() => setBloomGlow(!bloomGlow)}
                className={`px-2.5 py-1.5 rounded-lg border transition-colors ${
                  bloomGlow
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-zinc-850 text-zinc-400 border-zinc-800'
                }`}
              >
                <Sparkles className="w-3 h-3 inline mr-1" />
                <span>Emissive Glow</span>
              </button>
            </div>

            {/* Vessel Shape Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-[11px]">Chamber Hull:</span>
              {(['cylinder', 'sphere', 'cube'] as const).map(shape => (
                <button
                  key={shape}
                  onClick={() => setChamberShape(shape)}
                  className={`px-2 py-1 rounded capitalize border transition-all text-[11px] ${
                    chamberShape === shape
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Quick 3D Injection & Particle Controls */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Quick Pipette Injector */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pipette 3D Injection</span>
            </h4>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-mono text-zinc-400">Select Species:</span>
              <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-1">
                {moleculeTypes.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMolecule(m.id)}
                    className={`p-1.5 rounded-lg border text-left font-mono text-[11px] flex items-center justify-between transition-all ${
                      selectedMolecule === m.id
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: m.color }} />
                      <span>{m.symbol} ({m.name})</span>
                    </span>
                    <span className="text-[9px] text-zinc-500 font-bold">
                      {engine.particles.filter(p => p.typeId === m.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={() => onInject(selectedMolecule, 10)}
                className="py-1.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-mono font-bold text-xs transition-colors"
              >
                +10
              </button>
              <button
                onClick={() => onInject(selectedMolecule, 25)}
                className="py-1.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-mono font-bold text-xs transition-colors"
              >
                +25
              </button>
              <button
                onClick={() => onInject(selectedMolecule, 50)}
                className="py-1.5 rounded bg-emerald-500 text-zinc-950 font-mono font-bold text-xs hover:bg-emerald-400 transition-colors"
              >
                +50
              </button>
            </div>
          </div>

          {/* Thermodynamic Energy Core Status */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Spatial Physics Insights</span>
            </h4>

            <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] flex flex-col gap-1.5 text-zinc-400">
              <div className="flex justify-between">
                <span>Thermal Velocity:</span>
                <span className="text-zinc-200 font-bold">
                  {(Math.sqrt(engine.temperature / 300) * 1.5).toFixed(2)} units/s
                </span>
              </div>
              <div className="flex justify-between">
                <span>Vortex Angular Momentum:</span>
                <span className="text-cyan-300 font-bold">
                  {((engine.stirSpeed / 10) * 0.08).toFixed(3)} rad/s
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Spatial Flux:</span>
                <span className="text-purple-300 font-bold">
                  {engine.reactionFluxRate.toFixed(1)} rxn/s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
