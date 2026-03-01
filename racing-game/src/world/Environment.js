import * as THREE from "three";

export default class Environment {
  constructor(scene, mapIndex = 0) {
    this.scene = scene;
    this.mapIndex = mapIndex;
    this.checkpoints = [];
    this.waypoints   = [];
    this.boosts      = [];
    this.startPositions = { player: { x: 0, z: 0, a: 0 }, ai: [] };

    if (this.mapIndex === 1) {
      this.scene.fog = new THREE.Fog(0xd4956a, 200, 900);
      this.scene.background = new THREE.Color(0xe8b080);
    } else {
      this.scene.fog = new THREE.Fog(0xd0eeff, 300, 950);
      this.scene.background = new THREE.Color(0x90d8ff);
    }

    this.buildSky();
    this.buildMountains(); // NEW: Adds low-poly horizon bounds

    if (this.mapIndex === 1) {
      this.buildTrack2();
      this.buildDetails2();
    } else {
      this.buildTrack1();
      this.buildForest();
      this.buildDecorations(150, 800);
      this.buildItems();
    }
  }

  // ── Textures ─────────────────────────────────────────────────────────────

  _makeGrassTex() {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#5bbf4a";
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 300; i++) {
      const v = (Math.random() * 20 - 10) | 0;
      ctx.fillStyle = `rgba(0,${120 + v},0,0.18)`;
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 3, 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(20, 20);
    return t;
  }

  _makeSandTex() {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#c9a96e";
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 200; i++) {
      const v = (Math.random() * 20 - 10) | 0;
      ctx.fillStyle = `rgba(${180+v},${150+v},${80+v},0.15)`;
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 3, 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(20, 20);
    return t;
  }

  // NEW: Asphalt grit generator
  _makeAsphaltTex() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#3a3d42"; 
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.1)";
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(20, 20); // Tile it heavily so the grain is small
    return t;
  }

  _makeKerbTex() {
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ff2222"; ctx.fillRect(0,  0, 16, 16); ctx.fillRect(16, 16, 16, 16);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(16, 0, 16, 16); ctx.fillRect(0,  16, 16, 16);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 1);
    return t;
  }

  _makeFinishTex() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#111111";
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 4; j++)
        if ((i + j) % 2 === 0) ctx.fillRect(i * 32, j * 32, 32, 32);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  // ── Sky & Horizon ─────────────────────────────────────────────────────────

  buildSky() {
    const skyGeo = new THREE.SphereGeometry(950, 12, 8);
    const skyC = document.createElement("canvas");
    skyC.width = 2; skyC.height = 128;
    const ctx = skyC.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    if (this.mapIndex === 1) {
      g.addColorStop(0, "#b05020"); g.addColorStop(0.5, "#d88040"); g.addColorStop(1, "#f0c080");
    } else {
      g.addColorStop(0, "#2266cc"); g.addColorStop(0.5, "#55aaee"); g.addColorStop(1, "#c8eeff");
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 128);
    const skyMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyC), side: THREE.BackSide });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    if (this.mapIndex === 0) {
      const cc = document.createElement("canvas");
      cc.width = 128; cc.height = 64;
      const cctx = cc.getContext("2d");
      const cg = cctx.createRadialGradient(64, 32, 0, 64, 32, 50);
      cg.addColorStop(0, "rgba(255,255,255,0.95)");
      cg.addColorStop(0.6, "rgba(240,245,255,0.5)");
      cg.addColorStop(1, "rgba(255,255,255,0)");
      cctx.fillStyle = cg; cctx.fillRect(0, 0, 128, 64);
      const cloudMat = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false, side: THREE.DoubleSide
      });
      for (let i = 0; i < 12; i++) {
        const w = 60 + Math.random() * 100;
        const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.38), cloudMat);
        cl.rotation.x = -Math.PI / 2;
        cl.position.set((Math.random() - 0.5) * 600, 150 + Math.random() * 50, (Math.random() - 0.5) * 600);
        this.scene.add(cl);
      }
    }
  }

  // NEW: Distant low-poly mountains to break the flat horizon line
  buildMountains() {
    const radius = 850;
    const height = 200;
    const segments = 64;
    const geo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
    
    // Deform the top ring of the cylinder to create peaks and valleys
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) { 
        pos.setY(i, pos.getY(i) + (Math.random() * 100 - 50));
      }
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      color: this.mapIndex === 1 ? 0xc29a65 : 0x2e5c38,
      flatShading: true, // Gives that crisp, professional low-poly art style
      side: THREE.BackSide
    });

    const mountains = new THREE.Mesh(geo, mat);
    mountains.position.y = height / 2 - 20; // Sink slightly into the ground
    this.scene.add(mountains);
  }

  // ── Finish Line ───────────────────────────────────────────────────────────

  buildFinishLine(x, y, z, rotationY) {
    const g = new THREE.Group();
    const tex = this._makeFinishTex();
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

    const lp = new THREE.Mesh(new THREE.BoxGeometry(2, 20, 2), pillarMat);
    lp.position.set(-22, 10, 0); lp.castShadow = true;

    const rp = new THREE.Mesh(new THREE.BoxGeometry(2, 20, 2), pillarMat);
    rp.position.set(22, 10, 0); rp.castShadow = true;

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(46, 6, 2),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    banner.position.set(0, 18, 0); banner.castShadow = true;

    const sc = document.createElement("canvas");
    sc.width = 256; sc.height = 56;
    const sctx = sc.getContext("2d");
    sctx.fillStyle = "#cc0000"; sctx.fillRect(0, 0, 256, 56);
    sctx.fillStyle = "#ffffff"; sctx.font = "bold 40px Arial";
    sctx.textAlign = "center"; sctx.fillText("FINISH", 128, 44);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.5),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), side: THREE.DoubleSide })
    );
    sign.position.set(0, 24, 0);

    const gl = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 5),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    gl.rotation.x = -Math.PI / 2; gl.position.set(0, 0.14, 0);

    g.add(lp, rp, banner, sign, gl);
    g.position.set(x, y, z);
    g.rotation.y = rotationY;
    this.scene.add(g);
  }

  // ── Track 1 (Oval) ────────────────────────────────────────────────────────

  buildTrack1() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ map: this._makeGrassTex() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // FIX: Using the new noisy asphalt texture
    const ROAD = new THREE.MeshLambertMaterial({ map: this._makeAsphaltTex() });

    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(40, 200), ROAD);
    s1.rotation.x = -Math.PI / 2; s1.position.set(-80, 0.1, 0);
    s1.receiveShadow = true; this.scene.add(s1);

    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 200), ROAD);
    s2.rotation.x = -Math.PI / 2; s2.position.set(80, 0.1, 0);
    s2.receiveShadow = true; this.scene.add(s2);

    const c1 = new THREE.Mesh(new THREE.RingGeometry(60, 100, 48, 1, 0, Math.PI), ROAD);
    c1.rotation.x = -Math.PI / 2; c1.position.set(0, 0.1, -100);
    c1.receiveShadow = true; this.scene.add(c1);

    const c2 = new THREE.Mesh(new THREE.RingGeometry(60, 100, 48, 1, 0, Math.PI), ROAD);
    c2.rotation.x = -Math.PI / 2; c2.rotation.z = Math.PI; c2.position.set(0, 0.1, 100);
    c2.receiveShadow = true; this.scene.add(c2);

    const WL = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false });
    const YL = new THREE.MeshBasicMaterial({ color: 0xf5d020, depthWrite: false });

    [-93, -67, 67, 93].forEach(x => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 200), WL);
      line.rotation.x = -Math.PI / 2; line.position.set(x, 0.12, 0);
      this.scene.add(line);
    });

    [-80, 80].forEach(x => {
      for (let z = -95; z < 95; z += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 9), YL);
        dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.13, z);
        this.scene.add(dash);
      }
    });

    const kerbMat = new THREE.MeshLambertMaterial({ map: this._makeKerbTex() });
    [-100, -60, 60, 100].forEach(x => {
      const k = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 200), kerbMat);
      k.position.set(x, 0.15, 0); k.receiveShadow = true; this.scene.add(k);
    });

    const WR = new THREE.MeshLambertMaterial({ color: 0xff2222 });
    const WW = new THREE.MeshLambertMaterial({ color: 0xffffff });
    [-100, -60, 60, 100].forEach(x => {
      for (let i = 0; i < 10; i++) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 20), i % 2 === 0 ? WR : WW);
        wall.position.set(x, 1, -90 + i * 20); wall.castShadow = true; this.scene.add(wall);
      }
    });

    this.buildFinishLine(-80, 0, 0, 0);

    const gc = document.createElement("canvas");
    gc.width = 64; gc.height = 64;
    const gctx = gc.getContext("2d");
    ["#ffcc00","#ff4444","#ffcc00","#ff4444"].forEach((col, i) => {
      gctx.fillStyle = col;
      gctx.fillRect((i%2)*32, Math.floor(i/2)*32, 32, 32);
      gctx.fillStyle = "#000"; gctx.font = "bold 20px Arial"; gctx.textAlign = "center";
      gctx.fillText(i+1, (i%2)*32+16, Math.floor(i/2)*32+22);
    });
    const gridMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0.9 })
    );
    gridMesh.rotation.x = -Math.PI / 2; gridMesh.position.set(-80, 0.12, 30);
    this.scene.add(gridMesh);

    const poleMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    [{ x: -110, z: -70 }, { x: -110, z: 70 }, { x: 110, z: -70 }, { x: 110, z: 70 }].forEach(({ x, z }) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 16, 6), poleMat);
      pole.position.set(x, 8, z); pole.castShadow = true; this.scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), lampMat);
      lamp.position.set(x, 16.5, z); this.scene.add(lamp);
    });

    this.checkpoints = [
      { x: 0,   z: -140, r: 60 },
      { x: 80,  z: 0,    r: 60 },
      { x: 0,   z: 140,  r: 60 },
      { x: -80, z: 0,    r: 60 },
    ];
    this.startPositions.player = { x: -80, z: 20, a: Math.PI };
    this.startPositions.ai = [
      { x: -72, z: 30, a: Math.PI },
      { x: -80, z: 42, a: Math.PI },
      { x: -72, z: 42, a: Math.PI },
    ];
    this.generateWaypoints1();
  }

  // ── Track 2 (Figure-8, desert) ────────────────────────────────────────────

  buildTrack2() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ map: this._makeSandTex() })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);

    const trackMat = new THREE.MeshLambertMaterial({ map: this._makeAsphaltTex() });

    const leftLoop = new THREE.Mesh(new THREE.RingGeometry(60, 100, 32), trackMat);
    leftLoop.rotation.x = -Math.PI / 2; leftLoop.position.set(-90, 0.15, 0); leftLoop.receiveShadow = true; this.scene.add(leftLoop);

    const rightLoop = new THREE.Mesh(new THREE.RingGeometry(60, 100, 32), trackMat);
    rightLoop.rotation.x = -Math.PI / 2; rightLoop.position.set(90, 0.15, 0); rightLoop.receiveShadow = true; this.scene.add(rightLoop);

    const connector = new THREE.Mesh(new THREE.PlaneGeometry(100, 40), trackMat);
    connector.rotation.x = -Math.PI / 2; connector.position.set(0, 0.16, 0); connector.receiveShadow = true; this.scene.add(connector);

    this.checkpoints = [
      { x: 0,    z: -60, r: 60 },
      { x: 170,  z: 0,   r: 60 },
      { x: 0,    z: 60,  r: 60 },
      { x: -170, z: 0,   r: 60 },
    ];
    this.buildFinishLine(-170, 0, 0, 0);
    this.startPositions.player = { x: -170, z: 80, a: Math.PI };
    this.startPositions.ai = [
      { x: -160, z: 85, a: Math.PI },
      { x: -180, z: 85, a: Math.PI },
      { x: -170, z: 95, a: Math.PI },
    ];
    this.generateWaypoints2();
    this.buildDecorations(200, 600);
  }

  // ── Details ───────────────────────────────────────────────────────────────

  buildDetails2() {
    const dummy = new THREE.Object3D();
    const rockGeo = new THREE.DodecahedronGeometry(4, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a8070 });
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, 80);
    let placed = 0;
    while (placed < 80) {
      const x = (Math.random() - 0.5) * 800;
      const z = (Math.random() - 0.5) * 800;
      if (Math.abs(x) < 220 && Math.abs(z) < 220) continue;
      
      const s = 0.6 + Math.random() * 2.5;
      
      // FIX: Added organic tilt (rx, rz) to the rocks
      dummy.position.set(x, s * 2, z); 
      dummy.scale.set(s, s * 0.7, s); 
      dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
      
      dummy.updateMatrix(); rockMesh.setMatrixAt(placed, dummy.matrix); placed++;
    }
    rockMesh.castShadow = true; this.scene.add(rockMesh);
  }

  buildDecorations(count, range) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a7a60 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 12) {
      tries++;
      const x = (Math.random() - 0.5) * range;
      const z = (Math.random() - 0.5) * range;
      const onLeft  = x > -118 && x < -46 && z > -115 && z < 115;
      const onRight = x >  46 && x <  118 && z > -115 && z < 115;
      const dTop = Math.sqrt(x * x + (z + 100) * (z + 100));
      const dBot = Math.sqrt(x * x + (z - 100) * (z - 100));
      if (onLeft || onRight || dTop < 115 || dBot < 115) continue;
      
      const s = 1.5 + Math.random() * 3;
      
      // FIX: Added organic tilt
      dummy.position.set(x, s * 0.5, z); 
      dummy.scale.setScalar(s); 
      dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
      
      dummy.updateMatrix(); mesh.setMatrixAt(placed, dummy.matrix); placed++;
    }
    mesh.castShadow = true; this.scene.add(mesh);
  }

  buildForest() {
    const treeCount = 400;
    const tM  = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 1, 4, 7),   new THREE.MeshLambertMaterial({ color: 0x6b4828 }), treeCount);
    const l1M = new THREE.InstancedMesh(new THREE.ConeGeometry(3.5, 8, 7), new THREE.MeshLambertMaterial({ color: 0x2a9e38 }), treeCount);
    const l2M = new THREE.InstancedMesh(new THREE.ConeGeometry(2.8, 6, 7), new THREE.MeshLambertMaterial({ color: 0x35cc50 }), treeCount);
    tM.castShadow = true; l1M.castShadow = true;

    const d = new THREE.Object3D();
    let placed = 0;
    while (placed < treeCount) {
      const x = (Math.random() - 0.5) * 500;
      const z = (Math.random() - 0.5) * 500;
      const fLeft  = x > -115 && x < -50 && z > -112 && z < 112;
      const fRight = x >  50 && x <  115 && z > -112 && z < 112;
      const fdTop  = Math.sqrt(x * x + (z + 100) * (z + 100));
      const fdBot  = Math.sqrt(x * x + (z - 100) * (z - 100));
      if (fLeft || fRight || fdTop < 112 || fdBot < 112) continue;

      const s = 0.8 + Math.random() * 0.6;
      
      // FIX: Organic tree tilt (nobody likes perfectly vertical digital forests!)
      const tiltX = (Math.random() - 0.5) * 0.15;
      const tiltZ = (Math.random() - 0.5) * 0.15;
      const ry = Math.random() * Math.PI * 2;

      d.position.set(x, 2 * s, z); d.scale.set(s, s, s); 
      d.rotation.set(tiltX, ry, tiltZ);
      d.updateMatrix(); tM.setMatrixAt(placed, d.matrix);

      d.position.set(x, (4 + 4) * s, z); d.updateMatrix(); l1M.setMatrixAt(placed, d.matrix);
      d.position.set(x, (4 + 4 + 4) * s, z); d.updateMatrix(); l2M.setMatrixAt(placed, d.matrix);
      placed++;
    }
    this.scene.add(tM); this.scene.add(l1M); this.scene.add(l2M);
  }

  buildItems() {
    const outerMat = new THREE.MeshPhysicalMaterial({
      color: 0x00ffff, emissive: 0x00aaff, emissiveIntensity: 0.7,
      transparent: true, opacity: 0.6,
    });
    const innerMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff });
    const outerGeo = new THREE.OctahedronGeometry(3);
    const innerGeo = new THREE.OctahedronGeometry(1.5);

    [[-80, -50], [80, 50], [0, 180], [0, -180]].forEach(([px, pz]) => {
      const group = new THREE.Group();
      group.position.set(px, 3.5, pz);
      group.add(new THREE.Mesh(outerGeo, outerMat));
      group.add(new THREE.Mesh(innerGeo, innerMat));
      this.scene.add(group);
      this.boosts.push({ group });
    });
  }

  // ── Waypoints ─────────────────────────────────────────────────────────────

  generateWaypoints1() {
    for (let z = 0; z >= -100; z -= 25) this.waypoints.push({ x: -80, z });
    for (let a = Math.PI; a > 0; a -= Math.PI / 6)
      this.waypoints.push({ x: 80 * Math.cos(a), z: -100 - 80 * Math.sin(a) });
    for (let z = -100; z <= 100; z += 25) this.waypoints.push({ x: 80, z });
    for (let a = 0; a > -Math.PI; a -= Math.PI / 6)
      this.waypoints.push({ x: 80 * Math.cos(a), z: 100 - 80 * Math.sin(a) });
  }

  generateWaypoints2() {
    for (let a = Math.PI; a > 0; a -= 0.2)
      this.waypoints.push({ x: -90 + 80 * Math.cos(a), z: 80 * Math.sin(a) * -1 });
    for (let a = Math.PI; a < 2 * Math.PI; a += 0.2)
      this.waypoints.push({ x: 90 + 80 * Math.cos(a), z: 80 * Math.sin(a) * -1 });
    for (let a = 0; a < Math.PI; a += 0.2)
      this.waypoints.push({ x: 90 + 80 * Math.cos(a), z: 80 * Math.sin(a) * -1 });
    for (let a = 2 * Math.PI; a > Math.PI; a -= 0.2)
      this.waypoints.push({ x: -90 + 80 * Math.cos(a), z: 80 * Math.sin(a) * -1 });
  }
}