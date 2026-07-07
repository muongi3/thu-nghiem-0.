let canClickContinue = false;
const isMobile = window.matchMedia("(max-width: 800px), (pointer: coarse)").matches;
const isFacebookApp = /FBAN|FBAV|Messenger/i.test(navigator.userAgent);

// 1. NHẬN DIỆN VAI TRÒ NGAY LẬP TỨC

const V3 = {
    create: (x = 0, y = 0, z = 0) => ({ x, y, z }),
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    mul: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
    len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
    norm: (a) => { let l = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z); return l > 0 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 }; },
    dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
    dist: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2),
    clone: (a) => ({ x: a.x, y: a.y, z: a.z })
};


window.STATE = {
    screen: 'menu', lastTime: 0, camera: { pos: V3.create(0, 10, 20), rot: { x: 0, y: 0 } }, keys: {},
    mouse: { x: 0, y: 0, down: false, rightDown: false }, projectiles: [], particles: [], loot: [], powerups: [], bots: [], barrels: [], pads: [], obstacles: [], questItems: [],

    player: { pos: null, vel: V3.create(0, 0, 0), hp: window.GAME_CONFIG.player.maxHp, maxHp: window.GAME_CONFIG.player.maxHp, armor: 0, maxArmor: window.GAME_CONFIG.player.maxArmor, grounded: false, weaponIdx: 0, lastWeaponIdx: 0, weaponSwitchTime: 1.0, sprintLerp: 0, recoil: 0, kills: 0, alive: true, streak: 0, lastKillTime: 0, powerup: { type: null, time: 0 }, damageDealt: 0, isInvincible: false, lastDamageSoundTime: 0, standUpTimer: 0, blinkTimer: 0, blinkDuration: 0.15, blinkInterval: 4.5, stamina: 100, maxStamina: 100, staminaRegenDelay: 0 },
    weapons: [
        { name: "Pistol", ...window.GAME_CONFIG.weapons.pistol, ammo: window.GAME_CONFIG.weapons.pistol.maxAmmo, type: 0 },
        { name: "SMG", ...window.GAME_CONFIG.weapons.smg, ammo: window.GAME_CONFIG.weapons.smg.maxAmmo, type: 1 },
        { name: "Sniper", ...window.GAME_CONFIG.weapons.sniper, ammo: window.GAME_CONFIG.weapons.sniper.maxAmmo, type: 2 }
    ],
    lastShot: 0, shake: 0, config: { botCount: 20, zoneSpeed: 5 }, muzzleFlashTime: 0, hitPause: 0,
    weaponAnim: { swayX: 0, swayY: 0, recoilZ: 0, bobPhase: 0, equipSlide: 0 },
    inputLocked: false,
    bossTriggered: false,
    isAiming: false,
    aimLerp: 0,
    boss: { active: false, pos: V3.create(0, 0, 0), vel: V3.create(0, 0, 0), hp: window.GAME_CONFIG.boss.hp, maxHp: window.GAME_CONFIG.boss.hp, state: 'idle', skillCD: window.GAME_CONFIG.boss.skillCD, targetPos: null, shotCount: 0, skillIndex: 0, pillarSpots: [], armLift: 0, bodyY: 0, bodyRot: 0, fanMesh: null, hasHit: false, deathTimer: 0 },
    startTime: 0,
    gameEnded: false,
    playerName: localStorage.getItem('savedPlayerName') || "Người chơi",
    enragedAnnounced: false,
    finalAnnounced: false,
    hasExited: false,
    finalPaper: null,
    hasRedKey: false
};
const STATE = window.STATE;

// Hệ thống log thay thế cho debug
const logger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg) => console.error(`[ERROR] ${msg}`)
};
window.onerror = (msg, url, line) => console.error(`❌ LỖI: ${msg} tại ${line}`);

const M4 = {
    identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    perspective: (fovy, aspect, near, far) => {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, (2 * far * near) * nf, 0]);
    },
    lookAt: (eye, center, up) => {
        const z = V3.norm(V3.sub(eye, center));
        const x = V3.norm(V3.cross(up, z));
        const y = V3.cross(z, x);
        return new Float32Array([
            x.x, y.x, z.x, 0,
            x.y, y.y, z.y, 0,
            x.z, y.z, z.z, 0,
            -V3.dot(x, eye), -V3.dot(y, eye), -V3.dot(z, eye), 1
        ]);
    },
    multiply: (a, b) => {
        const out = new Float32Array(16);
        for (let r = 0; r < 4; ++r) for (let c = 0; c < 4; ++c) {
            let sum = 0; for (let k = 0; k < 4; ++k) sum += a[k * 4 + r] * b[c * 4 + k];
            out[c * 4 + r] = sum;
        }
        return out;
    },
    translation: (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]),
    scaling: (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]),
    rotationY: (rad) => {
        const s = Math.sin(rad), c = Math.cos(rad);
        return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
    },
    rotationX: (rad) => {
        const s = Math.sin(rad), c = Math.cos(rad);
        return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
    }
};

let gl;

function applyGraphicsSettings() {
    const res = localStorage.getItem('graphicsResolution') || (isMobile ? 'medium' : 'high');
    const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');

    // Update select elements in UI if they exist
    const resSelect = document.getElementById('graphics-resolution-select');
    const vfxSelect = document.getElementById('graphics-vfx-select');
    if (resSelect) resSelect.value = res;
    if (vfxSelect) vfxSelect.value = vfx;

    const resValEl = document.getElementById('graphics-resolution-val');
    const vfxValEl = document.getElementById('graphics-vfx-val');

    let resScale = 1.0;
    if (res === 'ultralow') {
        resScale = 0.25;
        if (resValEl) resValEl.innerText = "Siêu Mượt (360p - 0.25x)";
    } else if (res === 'low') {
        resScale = 0.45;
        if (resValEl) resValEl.innerText = "Mượt (480p - 0.45x)";
    } else if (res === 'medium') {
        resScale = 0.70;
        if (resValEl) resValEl.innerText = "Trung bình (720p - 0.7x)";
    } else {
        resScale = 1.0;
        if (resValEl) resValEl.innerText = "Cao (1080p - 1.0x)";
    }

    if (vfxValEl) {
        if (vfx === 'low') vfxValEl.innerText = "Tối thiểu";
        else if (vfx === 'medium') vfxValEl.innerText = "Bình thường";
        else vfxValEl.innerText = "Tối đa";
    }

    // Apply canvas resolution scaling
    if (gl && gl.canvas) {
        gl.canvas.width = window.innerWidth * resScale;
        gl.canvas.height = window.innerHeight * resScale;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // Sắt nét khi upscale: dùng pixelated để pixel cứng (không bị mờ nhòe)
        gl.canvas.style.imageRendering = (resScale < 1.0) ? 'pixelated' : 'auto';
    }

    // Re-initialize grass patches if VFX settings changed
    if (typeof initGrassPatches === 'function') {
        initGrassPatches();
    }
}

window.addEventListener('load', () => {
    gl = document.getElementById('glcanvas').getContext('webgl2', { antialias: !isMobile, powerPreference: "high-performance", stencil: true });
    if (!gl) {
        console.log("❌ WebGL2 KHÔNG HỖ TRỢ!");
        alert("Thiết bị của bác không hỗ trợ WebGL2. Vui lòng dùng trình duyệt khác!");
        return;
    }
    console.log("✅ WebGL2 OK");

    // Tự động load và áp dụng cài đặt đồ họa
    applyGraphicsSettings();

    console.log("🎨 Khởi tạo Graphics...");
    initGraphics();
    console.log("📦 Khởi tạo Assets...");
    initAssets();
    console.log("🚀 Game initialized successfully!");

    console.log("🔍 Chế độ: NGƯỜI CHƠI (HOST)");
});

const VS_SOURCE = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
layout(location=2) in vec3 aColor;
layout(location=3) in mat4 aInstMod;

uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform bool uInstanced;
uniform bool uIsGrass;
uniform bool uIsTree;
uniform float uTime;

out vec3 vNorm;
out vec3 vPos;
out vec3 vColor;
out float vDist;
out float vY;

void main() {
    mat4 model = uInstanced ? aInstMod : uModel;
    vec4 worldPos = model * vec4(aPos, 1.0);
    
    // === DYNAMIC WIND GRASS ===
    if (uIsGrass && aPos.y > 0.05) {
        float sway = sin(uTime * 2.5 + worldPos.x * 0.8 + worldPos.z * 0.8) * 0.25 * aPos.y;
        worldPos.x += sway;
        worldPos.z += sway * 0.6;
    }

    // === DYNAMIC WIND TREE (Lá cây rung rinh) ===
    if (uIsTree && aPos.y > 2.0) { // Chỉ rung từ trên cao 2.0 (tán lá)
        float sway = sin(uTime * 1.5 + worldPos.x * 0.4 + worldPos.z * 0.4) * 0.06 * (aPos.y - 2.0);
        worldPos.x += sway;
        worldPos.z += sway * 0.8;
    }

    vPos = worldPos.xyz;
    vY = aPos.y;
    vNorm = mat3(model) * aNorm;
    vColor = aColor;
    gl_Position = uProj * uView * worldPos;
    vDist = gl_Position.w;
}`;

const FS_SOURCE = `#version 300 es
precision highp float;
in vec3 vNorm;
in vec3 vPos;
in vec3 vColor;
in float vDist;
in float vY;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform vec3 uEmitColor;
uniform float uTime;
uniform bool uIsWater;
uniform bool uIsSky;
uniform vec3 uPointLightPos;
uniform vec3 uPointLightColor;
uniform float uMuzzleFlash;

out vec4 outColor;

void main() {
    if(uIsSky) {
        // Horror sky: deep purple/blood red gradient
        vec3 skyTop = vec3(0.03, 0.0, 0.08);
        vec3 skyHorizon = vec3(0.14, 0.02, 0.04);
        float h = normalize(vPos - uCamPos).y * 0.5 + 0.5;
        outColor = vec4(mix(skyHorizon, skyTop, h), 1.0);
        return;
    }

    vec3 N = normalize(vNorm);
    vec3 L = normalize(uSunDir);
    vec3 V = normalize(uCamPos - vPos);
    
    vec3 baseColor = vColor;
    
    if(uIsWater) {
        float wave = sin(vPos.x * 0.5 + uTime) * cos(vPos.z * 0.5 + uTime) * 0.1;
        baseColor = vec3(0.04, 0.01, 0.14); // Darker horror water
        N = normalize(N + vec3(wave, 0.0, wave));
    }

    vec3 emissive = uEmitColor;
    
    // Kiểm tra xem có phải đang vẽ Red Door hay không (sử dụng tín hiệu ma thuật uEmitColor.b để lọc)
    bool isRedDoor = false;
    bool hasKey = false;
    if (uEmitColor.r == 0.0 && uEmitColor.g == 0.0 && (abs(uEmitColor.b - 0.123) < 0.001 || abs(uEmitColor.b - 0.456) < 0.001)) {
        isRedDoor = true;
        hasKey = (abs(uEmitColor.b - 0.456) < 0.001);
        emissive = vec3(0.0); // Xóa bỏ uEmitColor trên khung cửa, cánh gỗ và bản lề sắt để không bị sáng rực nguyên khối đỏ
    }

    if (isRedDoor) {
        // Chỉ làm phát sáng phần năng lượng đỏ của Cổng và khe nứt trung tâm!
        if (vColor.r > 0.4 && vColor.g < 0.08 && vColor.b < 0.08) {
            float pulseSpeed = hasKey ? 8.0 : 2.5;
            float baseGlow = hasKey ? 4.5 : 2.5;
            float pulse = 1.0 + sin(uTime * pulseSpeed) * 0.4;
            emissive = vec3(vColor.r * baseGlow * pulse, 0.0, 0.0);
        }
    } else {
        // Auto-emissive cho mắt quái vật đỏ thuần khiết (chỉ chạy khi không phải Red Door)
        if (vColor.r > 0.95 && vColor.g < 0.05 && vColor.b < 0.05) {
            emissive += vec3(5.5, 0.0, 0.0); // Stronger monster eye glow
        }
    }

    // Improved diffuse: smoother + more ambient light (easier to see)
    float diff = dot(N, L);
    float light = smoothstep(-0.3, 0.6, diff) * 0.5 + 0.5; // 50% more ambient than before
    
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), uIsWater ? 128.0 : 48.0);
    float specMask = smoothstep(0.75, 0.85, spec) * (uIsWater ? 0.9 : 0.38);
    
    // Dynamic point light (boss aura, muzzle, barrel fire)
    float pointDist = length(uPointLightPos - vPos);
    float pointAtten = max(0.0, 1.0 - pointDist / 28.0);
    pointAtten *= pointAtten;
    vec3 pointDir = normalize(uPointLightPos - vPos + vec3(0.001));
    float pointDiff = max(dot(N, pointDir), 0.0);
    vec3 pointContrib = uPointLightColor * pointDiff * pointAtten * 3.5;
    
    // Rim/fresnel lighting (creepy horror outline)
    float rimVal = 1.0 - max(dot(V, N), 0.0);
    vec3 rimColor = vec3(0.12, 0.04, 0.22); // Purple rim default
    if (length(emissive) > 0.0) {
        rimColor = normalize(emissive) * 1.1;
    }
    vec3 finalRim = rimColor * pow(rimVal, 3.0);
    
    // Enhanced fake bloom (stronger glow for emissive objects)
    float glowFactor = smoothstep(0.25, 1.0, rimVal);
    vec3 fakeBloom = emissive * glowFactor * 4.0; // Stronger than before (was 2.5)
    
    // Surface micro-variation (breaks up flat look, fake texture)
    float noiseVal = fract(sin(dot(floor(vPos.xz * 1.5), vec2(127.1, 311.7))) * 43758.5453);
    float surfaceVar = 0.96 + noiseVal * 0.08;
    
    // Muzzle flash screen-space glow
    vec3 muzzleGlow = vec3(uMuzzleFlash * 0.45, uMuzzleFlash * 0.28, uMuzzleFlash * 0.05);
    
    vec3 finalColor = baseColor * light * surfaceVar + vec3(specMask) + finalRim + emissive + fakeBloom + pointContrib + muzzleGlow;
    
    // IMPROVED FOG: 57% less dense (was 0.007, now 0.003) — much clearer!
    float distFog = 1.0 - exp(-vDist * 0.003);
    float heightFog = smoothstep(4.0, -2.0, vY) * 0.65;
    float fogNoise = sin(vPos.x * 0.3 + uTime * 0.4) * cos(vPos.z * 0.3 - uTime * 0.3) * 0.5 + 0.5;
    float totalFog = clamp(max(distFog * 0.88, heightFog * fogNoise), 0.0, 0.88);
    
    float glowBrightness = max(emissive.r, max(emissive.g, emissive.b));
    float fogReduction = clamp(glowBrightness * 0.32, 0.0, 0.88);
    float fogFactor = totalFog * (1.0 - fogReduction);
    
    // Horror fog: deep purple-black instead of cyan
    vec3 horrorFogColor = mix(vec3(0.04, 0.0, 0.09), vec3(0.0, 0.04, 0.09), clamp(vY / 10.0, 0.0, 1.0));
    
    float alpha = uIsWater ? 0.78 : 1.0;
    outColor = vec4(mix(finalColor, horrorFogColor, fogFactor), alpha);
}`;

function createShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
}

let prog, locs;

function initGraphics() {
    prog = gl.createProgram();
    gl.attachShader(prog, createShader(VS_SOURCE, gl.VERTEX_SHADER));
    gl.attachShader(prog, createShader(FS_SOURCE, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));

    locs = {
        proj: gl.getUniformLocation(prog, "uProj"),
        view: gl.getUniformLocation(prog, "uView"),
        model: gl.getUniformLocation(prog, "uModel"),
        camPos: gl.getUniformLocation(prog, "uCamPos"),
        sunDir: gl.getUniformLocation(prog, "uSunDir"),
        fogColor: gl.getUniformLocation(prog, "uFogColor"),
        emitColor: gl.getUniformLocation(prog, "uEmitColor"),
        instanced: gl.getUniformLocation(prog, "uInstanced"),
        time: gl.getUniformLocation(prog, "uTime"),
        isWater: gl.getUniformLocation(prog, "uIsWater"),
        isSky: gl.getUniformLocation(prog, "uIsSky"),
        isGrass: gl.getUniformLocation(prog, "uIsGrass"),
        isTree: gl.getUniformLocation(prog, "uIsTree"),
        // Phase 1: New VFX uniforms
        pointLightPos: gl.getUniformLocation(prog, "uPointLightPos"),
        pointLightColor: gl.getUniformLocation(prog, "uPointLightColor"),
        muzzleFlash: gl.getUniformLocation(prog, "uMuzzleFlash"),
    };
}

function createMesh(verts, norms, cols) {
    const vao = gl.createVertexArray();
    const buffers = [];
    gl.bindVertexArray(vao);
    [[verts, 0, 3], [norms, 1, 3], [cols, 2, 3]].forEach(([data, loc, size]) => {
        const buf = gl.createBuffer();
        buffers.push(buf);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc);
    });
    return { vao, count: verts.length / 3, buffers };
}

function deleteMesh(mesh) {
    if (!mesh) return;
    if (mesh.vao) gl.deleteVertexArray(mesh.vao);
    if (mesh.buffers) mesh.buffers.forEach(b => gl.deleteBuffer(b));
}

function getCube(color = [1, 1, 1], sx = 1, sy = 1, sz = 1, ox = 0, oy = 0, oz = 0) {
    let v = [], n = [], c = [];
    let P = [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]];
    let idxs = [0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6, 3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0, 1, 5, 6, 1, 6, 2, 4, 0, 3, 4, 3, 7];
    let normals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
    for (let i = 0; i < idxs.length; i++) {
        let pt = P[idxs[i]];
        v.push(pt[0] * sx + ox, pt[1] * sy + oy, pt[2] * sz + oz);
        let nm = normals[Math.floor(i / 6)];
        n.push(...nm);
        c.push(...color);
    }
    return { v, n, c };
}

function genTreeMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };

    const trunkCol = [0.35, 0.2, 0.1];
    const leafCol1 = [0.1, 0.5, 0.2];
    const leafCol2 = [0.15, 0.6, 0.25];
    const leafCol3 = [0.2, 0.7, 0.3];
    const leafCol4 = [0.25, 0.75, 0.35];

    // Thân cây (Trunk) - Cao và có rễ
    push(getCube(trunkCol, 0.8, 3.5, 0.8, 0, 1.5, 0));
    push(getCube(trunkCol, 1.2, 0.5, 1.2, 0, 0.2, 0)); // Rễ phình ra

    // Tán lá 1 (Bottom layer - to và bè)
    push(getCube(leafCol1, 4.5, 1.2, 4.5, 0, 3.0, 0));
    push(getCube(leafCol2, 4.0, 1.0, 4.0, 0.5, 3.8, 0.5)); // Lệch nhẹ cho tự nhiên

    // Tán lá 2 (Middle layer)
    push(getCube(leafCol2, 3.2, 1.5, 3.2, -0.3, 4.8, -0.3));
    push(getCube(leafCol3, 2.5, 1.2, 2.5, 0.2, 5.8, 0.2));

    // Tán lá 3 (Top layer)
    push(getCube(leafCol3, 1.8, 1.2, 1.8, 0, 6.8, 0));
    push(getCube(leafCol4, 1.0, 0.8, 1.0, 0, 7.6, 0));

    return createMesh(V, N, C);
}

function genHouseMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const wallCol = [0.1, 0.1, 0.15]; // Tối tăm, màu Obsidian
    const roofCol = [0.1, 0.15, 0.2]; // Tôn gỉ màu xanh tím
    const woodCol = [0.05, 0.05, 0.05]; // Gỗ đen cháy
    const glassCol = [0.0, 0.2, 0.3]; // Kính tối tăm
    const yellowWarn = [0.8, 0.7, 0.1]; // Biển cảnh báo màu vàng bẩn

    // Thân nhà chính
    push(getCube(wallCol, 5, 4, 5, 0, 2, 0));
    push(getCube([0.1, 0.1, 0.1], 1.5, 2.5, 5.1, 1.5, 1.25, 0)); // Vết thủng lớn

    // Mái nhà xô lệch
    push(getCube(roofCol, 5.2, 0.3, 5.2, 0, 4.15, 0));
    push(getCube(roofCol, 4.0, 0.3, 4.0, -0.5, 4.45, 0)); // Mái sụp xô lệch
    push(getCube(roofCol, 2.0, 0.3, 2.0, 0, 4.75, 0));

    // Gỗ gia cố hoen rỉ/nứt vỡ quanh nhà
    push(getCube(woodCol, 1.2, 2.5, 0.2, 0, 1.25, 2.5));
    push(getCube(woodCol, 2.0, 0.2, 0.2, 2.5, 0.1, 3.0));
    push(getCube(woodCol, 0.2, 0.2, 1.5, -3.0, 0.1, -2.0));

    // CHI TIẾT PHASE 8:
    // Cửa sổ bể (vỡ nứt)
    push(getCube(glassCol, 0.8, 0.8, 0.1, -1.2, 2.2, 2.51)); // Cửa sổ trước
    push(getCube([0.02, 0.02, 0.02], 0.1, 0.8, 0.12, -1.2, 2.2, 2.51)); // Thanh chớp vỡ
    push(getCube(glassCol, 0.8, 0.8, 0.1, 1.2, 2.2, -2.51)); // Cửa sổ sau

    // Vết nứt tường (Cubes đen mỏng)
    push(getCube([0.02, 0.02, 0.02], 0.1, 1.8, 0.1, -2.51, 1.5, 1.0)); // Vết nứt đứng bên trái
    push(getCube([0.02, 0.02, 0.02], 1.2, 0.1, 0.1, -2.51, 2.0, 1.5)); // Nhánh nứt ngang
    push(getCube([0.02, 0.02, 0.02], 0.1, 1.5, 0.1, 2.51, 1.2, -1.0)); // Vết nứt bên phải

    // Cột Antenna thu phát tín hiệu dị thường trên mái
    push(getCube(woodCol, 0.1, 2.2, 0.1, -1.5, 5.0, -1.5)); // Trụ antenna chính
    push(getCube(woodCol, 0.8, 0.06, 0.06, -1.5, 5.8, -1.5)); // Thanh ngang antenna 1
    push(getCube(woodCol, 0.5, 0.06, 0.06, -1.5, 6.1, -1.5)); // Thanh ngang antenna 2

    // Biển cảnh báo phóng xạ / khu vực cấm (Warning sign) gắn trên tường nhà
    push(getCube(yellowWarn, 0.6, 0.6, 0.15, 0.0, 2.8, 2.52)); // Biển cảnh báo trước cửa
    push(getCube([0.1, 0.1, 0.1], 0.4, 0.1, 0.16, 0.0, 2.8, 2.52)); // Ký hiệu đen cảnh báo

    return createMesh(V, N, C);
}

function genDebrisMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const darkMetal = [0.05, 0.05, 0.05];
    const brickCol = [0.25, 0.12, 0.1]; // Gạch vỡ đỏ
    const concCol = [0.15, 0.15, 0.17]; // Bê tông xám đen

    // 4 mảnh vụn xô lệch khác nhau xếp gần nhau tạo đống debris
    push(getCube(brickCol, 0.6, 0.3, 0.5, -0.4, 0.15, 0.3));
    push(getCube(concCol, 0.8, 0.4, 0.6, 0.3, 0.2, -0.4));
    push(getCube(darkMetal, 0.3, 0.1, 1.2, 0.1, 0.05, 0.2));
    push(getCube(brickCol, 0.5, 0.2, 0.4, -0.2, 0.1, -0.5));

    return createMesh(V, N, C);
}

function genWarningSignMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const ironCol = [0.1, 0.1, 0.1]; // Cột sắt đen
    const signCol = [0.8, 0.7, 0.1]; // Biển vàng dạ quang/bẩn
    const symCol = [0.12, 0.12, 0.12]; // Ký hiệu đen

    // Cột đỡ
    push(getCube(ironCol, 0.1, 2.5, 0.1, 0, 1.25, 0));
    // Biển báo
    push(getCube(signCol, 1.2, 0.9, 0.1, 0, 2.1, 0.05));
    // Ký hiệu cảnh báo
    push(getCube(symCol, 0.8, 0.2, 0.12, 0, 2.1, 0.05));
    push(getCube(symCol, 0.2, 0.5, 0.12, 0, 2.1, 0.05));

    return createMesh(V, N, C);
}

function genLampPostMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const ironCol = [0.15, 0.15, 0.15]; // Cột sắt
    const lightCol = [1.0, 0.0, 0.0]; // Đèn đỏ phát sáng (Emissive do đỏ thuần)

    // Cột đèn cao
    push(getCube(ironCol, 0.18, 5.0, 0.18, 0, 2.5, 0));
    // Cần đèn chĩa ra
    push(getCube(ironCol, 0.18, 0.18, 1.5, 0, 5.0, -0.66));
    // Hộp đèn
    push(getCube(ironCol, 0.6, 0.4, 0.8, 0, 4.8, -1.3));
    // Bóng đèn đỏ phát sáng
    push(getCube(lightCol, 0.4, 0.25, 0.4, 0, 4.55, -1.3));

    return createMesh(V, N, C);
}

function genCarMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const rustCol = [0.2, 0.1, 0.15]; // Rỉ sét thẫm màu máu
    const darkMetal = [0.05, 0.05, 0.05];
    const glassCol = [0.0, 0.2, 0.4]; // Kính nứt phản quang Cyan

    push(getCube(rustCol, 2.0, 0.8, 4.5, 0, 0.6, 0));
    push(getCube(rustCol, 1.8, 0.7, 2.2, 0, 1.35, -0.2));
    push(getCube(glassCol, 1.9, 0.6, 2.3, 0, 1.35, -0.2));
    push(getCube(darkMetal, 0.4, 0.6, 0.6, -1.0, 0.3, 1.5));
    push(getCube(darkMetal, 0.4, 0.6, 0.6, 1.0, 0.3, 1.5));
    push(getCube(darkMetal, 0.4, 0.6, 0.6, -1.0, 0.3, -1.5));
    push(getCube(darkMetal, 0.4, 0.6, 0.6, 1.0, 0.3, -1.5));

    return createMesh(V, N, C);
}

function genRockMesh() {
    return createMesh(getCube([0.5, 0.5, 0.5], 1.5, 1, 1.5, 0, 0.5, 0).v, getCube([0.5, 0.5, 0.5], 1, 1, 1).n, getCube([0.5, 0.5, 0.5], 1, 1, 1).c);
}

function genCharMesh(color, isHorror = false, isEnraged = false, isFinal = false) {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };

    if (isHorror) {
        // --- MÀU SẮC THEO DẠNG ---
        // Dạng 1: Da xám nhạt hơi hồng
        // Dạng 2: Da đỏ nhạt (hồng đỏ)
        // Dạng 3: Da đỏ đậm (máu me)
        const skinCol = isFinal ? [0.7, 0.15, 0.15] : (isEnraged ? [0.9, 0.5, 0.5] : [0.88, 0.45, 0.45]);
        const blood = isFinal ? [0.6, 0.0, 0.0] : [0.5, 0.0, 0.0];
        const brightBlood = [0.9, 0.0, 0.0]; // Máu đỏ tươi (dùng cho móng vuốt)
        const clawRed = [1.0, 0.05, 0.05]; // Đỏ rực cho móng vuốt

        // Thân dài, gầy guộc
        push(getCube(skinCol, 0.4, 1.2, 0.2, 0, 0.6, 0));

        // Vết máu trên thân
        push(getCube(blood, 0.15, 0.4, 0.05, 0.05, 0.6, 0.11));
        if (isEnraged || isFinal) {
            push(getCube(blood, 0.25, 0.6, 0.06, -0.05, 0.5, 0.11));
        }

        // Thêm xương sườn nhô ra
        for (let i = 0; i < 3; i++) {
            const ribCol = isFinal ? blood : skinCol;
            push(getCube(ribCol, 0.45, 0.05, 0.25, 0, 0.8 + i * 0.15, 0.1));
        }

        // Đầu biến dạng to hơn chút
        push(getCube(skinCol, 0.4, 0.5, 0.4, 0, 1.35, 0));

        // Vết máu trên đầu
        push(getCube(blood, 0.1, 0.2, 0.41, 0.15, 1.45, 0));
        if (isFinal) {
            push(getCube(blood, 0.42, 0.1, 0.42, 0, 1.58, 0));
        }

        // Mắt đỏ rực to phát sáng
        push(getCube([1.0, 0.0, 0.0], 0.15, 0.15, 0.05, -0.15, 1.45, 0.21));
        push(getCube([1.0, 0.0, 0.0], 0.15, 0.15, 0.05, 0.15, 1.45, 0.21));

        // Miệng máu đáng sợ
        push(getCube([0, 0, 0], 0.25, 0.15, 0.05, 0, 1.25, 0.21));
        push(getCube(brightBlood, 0.3, 0.08, 0.05, 0, 1.18, 0.21));

        if (isEnraged || isFinal) {
            // CUỒNG BẠO: 2 tay giơ thẳng lên trước
            const armCol = isFinal ? [0.6, 0.08, 0.08] : skinCol;
            push(getCube(armCol, 0.1, 0.1, 1.0, -0.3, 1.1, 0.4));
            push(getCube(armCol, 0.1, 0.1, 1.0, 0.3, 1.1, 0.4));

            // Máu dính trên tay
            push(getCube(blood, 0.12, 0.12, 0.6, -0.3, 1.1, 0.5));
            push(getCube(blood, 0.12, 0.12, 0.6, 0.3, 1.1, 0.5));

            push(getCube(blood, 0.2, 0.8, 0.2, 0, 0.8, 0.1));

            // === MÓNG VUỐT ĐỎ DÀI (3 móng mỗi tay) ===
            push(getCube(clawRed, 0.03, 0.03, 0.55, -0.35, 1.15, 1.05));
            push(getCube(clawRed, 0.03, 0.03, 0.55, -0.3, 1.1, 1.05));
            push(getCube(clawRed, 0.03, 0.03, 0.55, -0.25, 1.05, 1.05));
            push(getCube(clawRed, 0.03, 0.03, 0.55, 0.35, 1.15, 1.05));
            push(getCube(clawRed, 0.03, 0.03, 0.55, 0.3, 1.1, 1.05));
            push(getCube(clawRed, 0.03, 0.03, 0.55, 0.25, 1.05, 1.05));
        } else {
            // THƯỜNG (Dạng 1): Tay dài chạm đất
            push(getCube(skinCol, 0.1, 1.0, 0.1, -0.3, 0.5, 0));
            push(getCube(skinCol, 0.1, 1.0, 0.1, 0.3, 0.5, 0));

            // Vết máu trên tay thường
            push(getCube(blood, 0.11, 0.5, 0.11, -0.3, 0.3, 0));
            push(getCube(blood, 0.11, 0.5, 0.11, 0.3, 0.3, 0));

            // === MÓNG VUỐT ĐỎ DÀI (3 móng mỗi tay, hướng xuống đất) ===
            push(getCube(clawRed, 0.03, 0.5, 0.03, -0.35, -0.25, 0));
            push(getCube(clawRed, 0.03, 0.5, 0.03, -0.3, -0.25, 0));
            push(getCube(clawRed, 0.03, 0.5, 0.03, -0.25, -0.25, 0));
            push(getCube(clawRed, 0.03, 0.5, 0.03, 0.35, -0.25, 0));
            push(getCube(clawRed, 0.03, 0.5, 0.03, 0.3, -0.25, 0));
            push(getCube(clawRed, 0.03, 0.5, 0.03, 0.25, -0.25, 0));
        }
    } else {
        // --- NGƯỜI CHƠI (SỐNG SÓT) ---
        push(getCube(color, 0.6, 0.9, 0.3, 0, 0.45, 0));
        const skinColor = [1.0, 0.82, 0.75];
        push(getCube(skinColor, 0.45, 0.45, 0.45, 0, 1.08, 0));
        push(getCube([1, 1, 1], 0.12, 0.12, 0.05, -0.12, 1.15, 0.21));
        push(getCube([1, 1, 1], 0.12, 0.12, 0.05, 0.12, 1.15, 0.21));
        push(getCube([0.1, 0.1, 0.1], 0.06, 0.06, 0.02, -0.12, 1.15, 0.24));
        push(getCube([0.1, 0.1, 0.1], 0.06, 0.06, 0.02, 0.12, 1.15, 0.24));
        push(getCube([0.2, 0.2, 0.2], 0.5, 0.7, 0.4, 0, 0.45, -0.25));
        push(getCube([0.2, 0.2, 0.2], 0.48, 0.1, 0.48, 0, 1.32, 0));
        push(getCube([0.2, 0.2, 0.2], 0.48, 0.05, 0.6, 0, 1.28, 0.1));
    }
    return createMesh(V, N, C);
}

function genCrateMesh(color = [0.7, 0.4, 0.2]) {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    push(getCube(color, 1, 1, 1, 0, 0.5, 0));
    return createMesh(V, N, C);
}


function genPistolMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const obsidian = [0.05, 0.05, 0.06];
    const neonCyan = [0.0, 0.95, 1.0];
    const plasmaCore = [0.8, 0.0, 1.0]; // Amethyst Plasma

    push(getCube(obsidian, 0.14, 0.22, 0.75, 0, 0, 0)); // Sleek Slide
    push(getCube(plasmaCore, 0.08, 0.08, 0.5, 0, 0, 0.1)); // Glowing Plasma Core exposed on slide
    push(getCube(neonCyan, 0.15, 0.04, 0.78, 0, 0.11, 0)); // Glowing Top Laser Rail
    push(getCube(obsidian, 0.11, 0.42, 0.22, 0, -0.25, -0.18)); // Grip
    push(getCube(neonCyan, 0.12, 0.06, 0.24, 0, -0.46, -0.18)); // Battery Pack base
    push(getCube([0, 0.95, 1.0], 0.03, 0.06, 0.03, 0, 0.15, 0.35)); // Holographic Sight
    return createMesh(V, N, C);
}


function genSMGMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const carbon = [0.03, 0.03, 0.04];
    const neonAmethyst = [0.6, 0.0, 1.0];
    const steel = [0.15, 0.15, 0.16];
    const neonCyan = [0.0, 0.95, 1.0];

    push(getCube(carbon, 0.16, 0.28, 1.15, 0, 0, 0)); // Main Receiver
    push(getCube(neonAmethyst, 0.18, 0.06, 0.9, 0, 0.14, 0.05)); // Energy Rail (Top)
    push(getCube(neonCyan, 0.18, 0.06, 0.4, 0, -0.05, 0.3)); // Heat Sink Vent (Side Glow)
    push(getCube(carbon, 0.1, 0.5, 0.15, 0, -0.32, 0.25)); // Slanted Mag
    push(getCube(neonAmethyst, 0.11, 0.05, 0.16, 0, -0.58, 0.25)); // Mag base glow
    push(getCube(carbon, 0.12, 0.38, 0.22, 0, -0.25, -0.38)); // Grip
    push(getCube(steel, 0.06, 0.06, 0.6, 0, 0.04, 0.8)); // Dual Pulse Barrels
    push(getCube(neonCyan, 0.07, 0.02, 0.5, 0, 0.04, 0.85)); // Barrel underglow
    push(getCube(carbon, 0.14, 0.24, 0.5, 0, -0.05, -0.75)); // Ergonomic Minimalist Stock
    return createMesh(V, N, C);
}

function genSniperMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const carbon = [0.03, 0.03, 0.04];
    const neonCyan = [0.0, 0.95, 1.0];
    const chrome = [0.3, 0.35, 0.4];
    const purpleCore = [0.6, 0.0, 1.0];

    // Thân súng Railgun (Dài, dẹp, góc cạnh)
    push(getCube(carbon, 0.16, 0.35, 1.8, 0, 0, -0.2));
    push(getCube(chrome, 0.18, 0.15, 1.0, 0, 0.1, -0.1)); // Ốp hông mạ crôm

    // Lõi năng lượng plasma (Plasma Core) lộ dọc theo thân
    push(getCube(purpleCore, 0.1, 0.15, 1.6, 0, 0, 0.2));

    // Báng súng bắn tỉa (Sniper Stock)
    push(getCube(carbon, 0.12, 0.3, 1.0, 0, -0.1, -1.0));
    push(getCube(chrome, 0.1, 0.4, 0.2, 0, -0.15, -1.4)); // Đệm vai (Shoulder Pad)
    push(getCube(neonCyan, 0.08, 0.1, 0.3, 0, -0.1, -1.1)); // Pin năng lượng ở báng

    // Nòng súng Railgun (Railgun Barrels - siêu dài)
    push(getCube(chrome, 0.08, 0.1, 2.5, 0, 0.05, 1.6));
    push(getCube(carbon, 0.12, 0.12, 0.8, 0, 0.05, 2.5)); // Đầu nòng chống giật (Muzzle Brake)
    push(getCube(neonCyan, 0.1, 0.04, 2.4, 0, 0.05, 1.6)); // Dải sáng gia tốc từ trường

    // Chân chống (Bipod - gập lại)
    push(getCube(chrome, 0.25, 0.05, 0.1, 0, -0.2, 1.2));
    push(getCube(chrome, 0.05, 0.3, 0.1, -0.1, -0.3, 1.2)); // Chân trái
    push(getCube(chrome, 0.05, 0.3, 0.1, 0.1, -0.3, 1.2));  // Chân phải

    // Ống ngắm siêu bự (Advanced Sniper Scope)
    push(getCube(carbon, 0.12, 0.15, 0.8, 0, 0.3, -0.1)); // Thân ống ngắm
    push(getCube(chrome, 0.14, 0.18, 0.2, 0, 0.3, 0.3)); // Thấu kính trước
    push(getCube(neonCyan, 0.1, 0.14, 0.05, 0, 0.3, 0.4)); // Mặt kính phát sáng
    push(getCube(chrome, 0.14, 0.18, 0.15, 0, 0.3, -0.4)); // Thấu kính sau

    return createMesh(V, N, C);
}


function genCannonMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const voidGrey = [0.06, 0.04, 0.08], voidNeon = [0.73, 0.2, 1.0], cosmicOrange = [1, 0.3, 0];
    push(getCube(voidGrey, 0.4, 0.4, 1.4, 0, 0, 0)); // Sleek Void Body
    push(getCube(voidNeon, 0.42, 0.05, 1.0, 0, 0.2, 0)); // Glowing Top Neon
    push(getCube(voidNeon, 0.05, 0.42, 1.0, 0.2, 0, 0)); // Glowing Side Neon L
    push(getCube(voidNeon, 0.05, 0.42, 1.0, -0.2, 0, 0)); // Glowing Side Neon R
    push(getCube(cosmicOrange, 0.45, 0.45, 0.1, 0, 0, 0.7)); // Cosmic Energy Muzzle
    push(getCube(voidGrey, 0.1, 0.5, 0.2, 0, -0.3, -0.3)); // Grip
    return createMesh(V, N, C);
}

// Hàm tạo hình cầu cơ bản cho Boss và các vật thể tròn
function getSphere(color, r, res, ox, oy, oz) {
    let v = [], n = [], c = [];
    for (let i = 0; i <= res; i++) {
        let lat = Math.PI * i / res, sinLat = Math.sin(lat), cosLat = Math.cos(lat);
        for (let j = 0; j <= res; j++) {
            let lon = 2 * Math.PI * j / res, sinLon = Math.sin(lon), cosLon = Math.cos(lon);
            let x = cosLon * sinLat, y = cosLat, z = sinLon * sinLat;
            v.push(ox + x * r, oy + y * r, oz + z * r);
            n.push(x, y, z);
            c.push(...color);
        }
    }
    let V = [], N = [], C = [];
    for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
            let p1 = i * (res + 1) + j, p2 = p1 + res + 1;
            const pushV = (idx) => { V.push(v[idx * 3], v[idx * 3 + 1], v[idx * 3 + 2]); N.push(n[idx * 3], n[idx * 3 + 1], n[idx * 3 + 2]); C.push(...color); };
            pushV(p1); pushV(p2); pushV(p1 + 1);
            pushV(p1 + 1); pushV(p2); pushV(p2 + 1);
        }
    }
    return { v: V, n: N, c: C };
}

// Hàm tạo trăng đỏ giống thật nhưng tối giản để mượt trên Mobile
function genMoonMesh(color, r, res) {
    let V = [], N = [], C = [];
    const darkCol = [color[0] * 0.25, 0, 0]; // Vết thẫm màu máu bầm

    for (let i = 0; i < res; i++) {
        let lat1 = Math.PI * i / res, lat2 = Math.PI * (i + 1) / res;
        for (let j = 0; j < res; j++) {
            let lon1 = 2 * Math.PI * j / res, lon2 = 2 * Math.PI * (j + 1) / res;

            const getPos = (la, lo) => [Math.cos(lo) * Math.sin(la) * r, Math.cos(la) * r, Math.sin(lo) * Math.sin(la) * r];
            let p1 = getPos(lat1, lon1), p2 = getPos(lat1, lon2), p3 = getPos(lat2, lon1), p4 = getPos(lat2, lon2);

            // Tạo vết đen (Maria) diện tích lớn giống trăng thật
            let nx = p1[0] / r, ny = p1[1] / r, nz = p1[2] / r;
            let noise = Math.sin(nx * 2.5) * Math.cos(ny * 2.5) * Math.sin(nz * 2.5);
            let col = (noise > 0.2) ? darkCol : color;

            V.push(...p1, ...p2, ...p3, ...p3, ...p2, ...p4);
            for (let k = 0; k < 6; k++) { N.push(nx, ny, nz); C.push(...col); }
        }
    }
    return createMesh(V, N, C);
}


function genBossBody() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const charcoal = [0.03, 0.03, 0.05], crimson = [0.8, 0, 0], bone = [0.85, 0.85, 0.8], blood = [0.5, 0, 0];

    // --- THÂN (Torso) ---
    push(getCube(charcoal, 4.5, 1.5, 2.5, 0, 16, 0));
    push(getCube(charcoal, 1.2, 7, 1.2, 0, 13, 0));
    for (let i = 0; i < 5; i++) {
        const y = 15.5 - i * 1.3;
        push(getCube(charcoal, 3.5 - i * 0.4, 0.4, 2, 0, y, 0));
        push(getCube(blood, 0.3, 0.8, 0.3, 2 - i * 0.2, y - 0.5, 1.2));
    }

    // --- ĐẦU (Head) ---
    const hw = 1.3, hh = 1.6, hd = 1.3;
    push(getCube(bone, hw * 2, hh * 2, hd * 2, 0, 19, 0));
    push(getCube([0, 0, 0], 2.2, 2.5, 0.5, 0, 19.5, 1.1));
    for (let i = 0; i < 3; i++) {
        const ey = 20.2 - i * 0.8;
        push(getCube(crimson, 0.4, 0.4, 0.4, -0.6, ey, 1.4));
        push(getCube(crimson, 0.4, 0.4, 0.4, 0.6, ey, 1.4));
    }
    push(getCube(charcoal, 2.4, 1.2, 2.2, 0, 17.5, 0.3));
    for (let i = 0; i < 8; i++) {
        const tx = (i - 3.5) * 0.3;
        push(getCube([1, 1, 1], 0.1, 0.8, 0.1, tx, 18, 1.3));
        push(getCube([1, 1, 1], 0.1, 0.8, 0.1, tx, 17.5, 1.3));
    }
    push(getCube(blood, 2.6, 0.5, 0.5, 0, 17.8, 1.4));

    // Thêm các quả cầu nhỏ tại 8 góc để "bo tròn" cạnh
    const corners = [-1, 1];
    corners.forEach(cx => corners.forEach(cy => corners.forEach(cz => {
        const s = getSphere(bone, 0.5, 6, cx * hw, 19 + cy * hh, cz * hd);
        push({ v: s.v, n: s.n, c: s.c });
    })));

    // Vệt máu dài từ mắt và miệng
    for (let i = 0; i < 4; i++) {
        push(getCube(blood, 0.15, 3, 0.15, (i - 1.5) * 0.8, 17, 1.3));
    }

    // --- CHÂN (Legs) ---
    const drawLeg = (side) => {
        const x = side * 1.5;
        push(getCube(charcoal, 0.8, 11, 0.8, x, 5.5, 0));
        const j = getSphere(crimson, 0.6, 8, x, 0.5, 0.2);
        push({ v: j.v, n: j.n, c: j.c });
    };
    drawLeg(-0.5); drawLeg(0.5);
    push(getCube([1, 0, 0], 1.8, 1.8, 1.8, 0, 14, 0.6));
    return createMesh(V, N, C);
}

function genBossArm() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const charcoal = [0.03, 0.03, 0.05], crimson = [0.8, 0, 0], blood = [0.5, 0, 0];

    const j1 = getSphere(crimson, 0.6, 8, 0, 0, 0); push({ v: j1.v, n: j1.n, c: j1.c }); // Khớp vai
    push(getCube(charcoal, 0.7, 7, 0.7, 0, -3.5, 0.5)); // Bắp tay
    const j2 = getSphere(crimson, 0.6, 8, 0, -6.5, 1); push({ v: j2.v, n: j2.n, c: j2.c }); // Khớp khuỷu
    push(getCube(charcoal, 0.6, 9, 0.6, 0, -10.5, 2.5)); // Cẳng tay
    for (let i = 0; i < 3; i++) push(getCube(blood, 0.2, 3, 0.2, (i - 1) * 0.4, -14.5, 3.5)); // Móng vuốt
    return createMesh(V, N, C);
}


function genBossProjectileMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    push(getCube([0.73, 0.2, 1.0], 2, 2, 2, 0, 0, 0)); // Large Purple Void Cube
    push(getCube([0.45, 0, 0.3], 2.5, 2.5, 2.5, 0, 0, 0)); // Ethereal Cursed Crimson Outer Glow
    return createMesh(V, N, C);
}


// Hàm tạo vạch lướt bám theo địa hình (Chiêu 1) - Mượt mà hơn
function genTerrainDashMesh(cx, cz, ang, w, l) {
    let V = [], N = [], C = [];
    const resL = 20, resW = 2; // Tăng độ phân giải theo chiều dài
    const stepL = l / resL, stepW = w / resW;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);

    for (let i = 0; i < resL; i++) {
        for (let j = 0; j < resW; j++) {
            const l1 = i * stepL, w1 = (j - resW / 2) * stepW;
            const l2 = l1 + stepL, w2 = w1 + stepW;
            const getPt = (ll, ww) => {
                const rx = ww * cosA + ll * sinA, rz = -ww * sinA + ll * cosA;
                const wx = cx + rx, wz = cz + rz;
                return [wx, getHeight(wx, wz) + 0.08, wz];
            };
            const p11 = getPt(l1, w1), p12 = getPt(l1, w2), p21 = getPt(l2, w1), p22 = getPt(l2, w2);
            V.push(...p11, ...p12, ...p21, ...p21, ...p12, ...p22);
            for (let k = 0; k < 6; k++) { N.push(0, 1, 0); C.push(1, 0, 0); }
        }
    }
    return createMesh(V, N, C);
}

// Hàm tạo vòng tròn bám theo địa hình (Radial Mesh - Không còn ô vuông)
function genTerrainFollowMesh(cx, cz, r) {
    let V = [], N = [], C = [];
    const segments = 32; // Độ mịn đường tròn
    const rings = 4;    // Độ bám địa hình (phân lớp từ tâm ra)

    for (let ring = 0; ring < rings; ring++) {
        const r1 = (ring / rings) * r;
        const r2 = ((ring + 1) / rings) * r;
        for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;

            const getPt = (rr, aa) => {
                const wx = cx + Math.sin(aa) * rr;
                const wz = cz + Math.cos(aa) * rr;
                return [wx, getHeight(wx, wz) + 0.08, wz];
            };

            const p11 = getPt(r1, a1), p12 = getPt(r1, a2), p21 = getPt(r2, a1), p22 = getPt(r2, a2);
            V.push(...p11, ...p12, ...p21, ...p21, ...p12, ...p22);
            for (let k = 0; k < 6; k++) { N.push(0, 1, 0); C.push(1, 0, 0); }
        }
    }
    return createMesh(V, N, C);
}

function genIndicatorMesh() {
    // Tạo một hình vuông dẹt 1x1 làm vạch cảnh báo
    let V = [-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, 0.5];
    let N = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    let C = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
    return createMesh(V, N, C);
}

function genDashIndicatorMesh() {
    const w = 4, l = 50;
    // Chỉnh lại oz thành l/2 để hình chữ nhật kéo dài về phía trước (+z) thay vì phía sau (-z)
    let m = getCube([1, 0, 0], w, 0.1, l, 0, 0, l / 2);
    return createMesh(m.v, m.n, m.c);
}


function genArmMesh() {

    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const skinColor = [1.0, 0.82, 0.75];
    push(getCube(skinColor, 0.18, 0.18, 0.8, 0, 0, 0));
    return createMesh(V, N, C);
}


function genBarrelMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };

    const bodyCol = [0.8, 0.15, 0.1]; // Đỏ tươi hơn
    const metalCol = [0.3, 0.3, 0.3]; // Kim loại xám
    const topCol = [0.2, 0.2, 0.2];   // Nắp đen

    // Tạo hình trụ 8 cạnh (dùng 2 cube xoay 45 độ)
    push(getCube(bodyCol, 1.0, 1.6, 1.0, 0, 0.8, 0));
    // Ở đây getCube không hỗ trợ xoay trực tiếp, nên ta dùng kỹ thuật xếp chồng để nhìn giống thùng hơn
    push(getCube(metalCol, 1.05, 0.1, 1.05, 0, 0.4, 0));  // Đai dưới
    push(getCube(metalCol, 1.05, 0.1, 1.05, 0, 1.2, 0));  // Đai trên
    push(getCube(topCol, 0.9, 0.1, 0.9, 0, 1.6, 0));     // Nắp thùng

    return createMesh(V, N, C);
}

function genGrassMesh() {
    let V = [], N = [], C = [];
    const blades = isMobile ? 8 : 15; // Tăng số lá cỏ nhưng tối ưu cho mobile
    const h = 0.8, w = 0.15;

    const addBlade = (angle, offset) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        const x = offset.x, z = offset.z;
        const skew = Math.sin(angle * 5) * 0.2; // Độ nghiêng tự nhiên

        // Tạo một lá cỏ dẹt (Triangle Strip giả lập)
        V.push(x - w * s, 0, z + w * c, x + w * s, 0, z - w * c, x + skew, h, z);
        const col = [0.05 + Math.random() * 0.1, 0.05, 0.2 + Math.random() * 0.2]; // Cỏ màu tím sẫm/Xanh ngọc
        for (let i = 0; i < 3; i++) { N.push(0, 1, 0); C.push(...col); }
    };

    for (let i = 0; i < blades; i++) {
        const ang = (i / blades) * Math.PI * 2;
        const rad = Math.random() * 0.5;
        addBlade(ang, { x: Math.cos(ang) * rad, z: Math.sin(ang) * rad });
    }
    return createMesh(V, N, C);
}

function genJumpPadMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };

    // 1. Đế kim loại tối công nghiệp (Dark industrial metal base plate)
    push(getCube([0.08, 0.08, 0.1], 1.6, 0.15, 1.6, 0, 0.075, 0));

    // 2. Viền vàng công nghệ (Tech golden border)
    push(getCube([0.8, 0.65, 0.0], 1.5, 0.2, 1.5, 0, 0.18, 0));

    // 3. Thảm đệm nhảy màu vàng chanh sáng (Lemon yellow center pad)
    push(getCube([1.0, 0.85, 0.0], 1.2, 0.25, 1.2, 0, 0.22, 0));

    // 4. Lõi năng lượng cam phát sáng ở giữa (Glowing orange energy core)
    push(getCube([1.0, 0.45, 0.0], 0.4, 0.28, 0.4, 0, 0.24, 0));

    // 5. Bốn góc định vị kim loại đen (4 black corner brackets)
    push(getCube([0.05, 0.05, 0.05], 0.3, 0.26, 0.3, 0.6, 0.20, 0.6));
    push(getCube([0.05, 0.05, 0.05], 0.3, 0.26, 0.3, -0.6, 0.20, 0.6));
    push(getCube([0.05, 0.05, 0.05], 0.3, 0.26, 0.3, 0.6, 0.20, -0.6));
    push(getCube([0.05, 0.05, 0.05], 0.3, 0.26, 0.3, -0.6, 0.20, -0.6));

    return createMesh(V, N, C);
}

function genTerrainFanMesh(x, z, startAng, arc, r) {
    let V = [], N = [], C = [];
    const res = 8; // Số phân đoạn của hình quạt (giảm để tối ưu)
    for (let i = 0; i < res; i++) {
        const a1 = startAng + (i / res) * arc;
        const a2 = startAng + ((i + 1) / res) * arc;
        const p1 = { x: x, z: z };
        const p2 = { x: x + Math.sin(a1) * r, z: z + Math.cos(a1) * r };
        const p3 = { x: x + Math.sin(a2) * r, z: z + Math.cos(a2) * r };
        const y1 = getHeight(p1.x, p1.z) + 0.2, y2 = getHeight(p2.x, p2.z) + 0.2, y3 = getHeight(p3.x, p3.z) + 0.2;
        V.push(p1.x, y1, p1.z, p2.x, y2, p2.z, p3.x, y3, p3.z);
        for (let k = 0; k < 3; k++) { N.push(0, 1, 0); C.push(1, 0, 0); }
    }
    return createMesh(V, N, C);
}

const ASSETS = {};
function initAssets() {
    ASSETS.tree = genTreeMesh(); ASSETS.rock = genRockMesh(); ASSETS.house = genHouseMesh(); ASSETS.car = genCarMesh();
    ASSETS.debris = genDebrisMesh(); ASSETS.warningSign = genWarningSignMesh(); ASSETS.lampPost = genLampPostMesh();
    ASSETS.char = genCharMesh([0.35, 0.05, 0.65], false); // Người chơi: Tím Bóng Đêm dạ quang
    ASSETS.bot = genCharMesh([0.5, 0.5, 0.5], true, false);  // Dạng 1: Xám hồng + móng vuốt đỏ
    ASSETS.botEnraged = genCharMesh([0.5, 0.5, 0.5], true, true);  // Dạng 2: Đỏ nhạt + móng vuốt đỏ dài
    ASSETS.botFinal = genCharMesh([0.4, 0, 0], true, true, true);  // Dạng 3: Đỏ đậm + móng vuốt đỏ dài
    ASSETS.crate = genCrateMesh([0.15, 0.12, 0.2]); // Rương Obsidian viền tím
    ASSETS.lootAmmo = genCrateMesh([0.85, 0.7, 0.05]); // Rương Đạn: Vàng dạ quang
    ASSETS.lootHP = genCrateMesh([0.05, 0.8, 0.4]); // Rương HP: Xanh ngọc dạ quang
    ASSETS.lootArmor = genCrateMesh([0.05, 0.35, 0.85]); // Rương Giáp: Xanh dương dạ quang
    ASSETS.lootWeapon = genCrateMesh([0.85, 0.35, 0.05]); // Rương Súng: Cam tà linh
    ASSETS.lootSniper = genCrateMesh([0.55, 0.05, 0.85]); // Rương Tỉa: Tím ma pháp

    ASSETS.ground = genTerrain(); ASSETS.barrel = genBarrelMesh();
    ASSETS.pad = genJumpPadMesh(); ASSETS.grass = genGrassMesh(); ASSETS.water = genWaterMesh();
    ASSETS.sky = genSkyMesh();
    ASSETS.pistol = genPistolMesh();
    ASSETS.smg = genSMGMesh();
    ASSETS.sniper = genSniperMesh();
    ASSETS.cannon = genCannonMesh();
    ASSETS.arm = genArmMesh();
    ASSETS.bossBody = genBossBody();
    ASSETS.bossArm = genBossArm();
    ASSETS.bossProj = genBossProjectileMesh();
    ASSETS.indicator = genIndicatorMesh();

    ASSETS.pillar = genPillarMesh();
    ASSETS.redDoor = genRedDoorMesh();
    ASSETS.cosmicSky = genCosmicSkyMesh();

    ASSETS.bloodMoon = genMoonMesh([0.85, 0.05, 0.45], 1, 24); // Giảm resolution xuống 24 để mượt trên Mobile
    ASSETS.dashInd = genDashIndicatorMesh();
    ASSETS.redKey = genRedKeyMesh();
    ASSETS.arrow = genArrowMesh();
}

function genArrowMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const redColor = [1.0, 0.05, 0.05];
    const brightRed = [1.0, 0.3, 0.3];
    // Thân mũi tên (Shaft)
    push(getCube(redColor, 0.2, 0.05, 0.8, 0, 0.05, 0.2));
    // Đầu mũi tên (Arrow head)
    push(getCube(brightRed, 0.6, 0.05, 0.2, 0, 0.05, -0.3));
    push(getCube(brightRed, 0.4, 0.05, 0.2, 0, 0.05, -0.5));
    push(getCube(brightRed, 0.2, 0.05, 0.2, 0, 0.05, -0.7));
    return createMesh(V, N, C);
}

function genRedKeyMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };

    const redColor = [1.0, 0.05, 0.05];      // Màu đỏ dạ quang rực rỡ
    const brightRed = [1.0, 0.3, 0.3];

    // Trục chìa khóa (Shaft) - ngắn lại và thanh mảnh hơn
    push(getCube(redColor, 0.02, 0.02, 0.25, 0, 0, -0.1));

    // Tay cầm (Bow/Handle) - thu nhỏ lại tinh tế, gọn gàng
    push(getCube(brightRed, 0.06, 0.015, 0.015, 0, 0, 0.04));
    push(getCube(brightRed, 0.015, 0.015, 0.06, -0.03, 0, 0.01));
    push(getCube(brightRed, 0.015, 0.015, 0.06, 0.03, 0, 0.01));
    push(getCube(brightRed, 0.06, 0.015, 0.015, 0, 0, -0.02));

    // Răng chìa khóa (Teeth/Bit) - nhỏ nhắn, rõ nét răng cưa
    push(getCube(redColor, 0.015, 0.03, 0.02, 0, -0.02, -0.18));
    push(getCube(redColor, 0.015, 0.02, 0.02, 0, -0.015, -0.21));

    return createMesh(V, N, C);
}


function genPillarMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };
    const obs = [0.05, 0.05, 0.05];
    const cyan = [0.0, 0.9, 0.9];
    push(getCube(obs, 1.5, 8.0, 1.5, 0, 4.0, 0));
    push(getCube(cyan, 1.55, 0.2, 0.2, 0, 5.0, 0.7)); // Rune
    push(getCube(cyan, 0.2, 1.0, 1.55, -0.7, 6.0, 0)); // Rune
    return createMesh(V, N, C);
}

function genRedDoorMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };

    const darkGrey = [0.06, 0.06, 0.08]; // Đá Obsidian tối
    const goldBronze = [0.22, 0.14, 0.04]; // Đồng cổ trang trí
    const portalGlow = [1.0, 0.0, 0.0]; // Năng lượng/chữ cổ phát sáng đỏ rực
    const portalGlowDeep = [0.45, 0.0, 0.0]; // Lõi năng lượng đỏ tối phía sau

    // 1. CÁC BẬC THỀM ĐÁ OBSIDIAN (Staircase) dẫn lên cổng
    push(getCube(darkGrey, 22.0, 1.5, 8.0, 0, 0.75, 2.0));
    push(getCube(darkGrey, 18.0, 1.5, 6.0, 0, 2.25, 1.0));
    push(getCube(darkGrey, 14.0, 1.5, 4.0, 0, 3.75, 0.0));

    // 2. CỘT ĐÁ OBSIDIAN KHỔNG LỒ HAI BÊN (Obsidian Pillars)
    push(getCube(darkGrey, 3.0, 42.0, 4.0, -9.0, 24.0, -1.0));
    push(getCube(darkGrey, 3.0, 42.0, 4.0, 9.0, 24.0, -1.0));

    // Cổ tự khắc chữ phát sáng trên cột (Glowing runes)
    push(getCube(portalGlow, 0.3, 4.0, 4.1, -7.5, 10.0, -1.0));
    push(getCube(portalGlow, 0.3, 4.0, 4.1, -7.5, 20.0, -1.0));
    push(getCube(portalGlow, 0.3, 4.0, 4.1, -7.5, 30.0, -1.0));
    push(getCube(portalGlow, 0.3, 4.0, 4.1, 7.5, 10.0, -1.0));
    push(getCube(portalGlow, 0.3, 4.0, 4.1, 7.5, 20.0, -1.0));
    push(getCube(portalGlow, 0.3, 4.0, 4.1, 7.5, 30.0, -1.0));

    // 3. XÀ NGANG VÀ SỪNG VƯƠNG MIỆN (Arch & Crown Spikes)
    push(getCube(darkGrey, 21.0, 4.0, 5.0, 0, 45.0, -1.0));
    push(getCube(goldBronze, 4.0, 4.0, 5.5, 0, 48.0, -0.8)); // Crest ở đỉnh cổng

    // Cặp sừng gai nhọn chọc lên trời (Gai địa ngục)
    push(getCube(darkGrey, 1.5, 8.0, 1.5, -9.0, 48.0, -1.0));
    push(getCube(darkGrey, 1.5, 8.0, 1.5, 9.0, 48.0, -1.0));
    push(getCube(darkGrey, 1.2, 7.0, 1.2, -11.0, 46.0, -1.0));
    push(getCube(darkGrey, 1.2, 7.0, 1.2, 11.0, 46.0, -1.0));

    // 4. LÕI NĂNG LƯỢNG XOÁY CỦA CỔNG (Crimson Energy Vortex)
    push(getCube(portalGlowDeep, 15.0, 36.0, 1.5, 0, 24.0, -2.0));

    // Đá nguyên khối lơ lửng ở giữa Cổng (Floating Center Monolith)
    push(getCube(darkGrey, 3.5, 18.0, 3.5, 0, 24.0, -1.5));
    push(getCube(portalGlow, 0.8, 14.0, 3.7, 0, 24.0, -1.3)); // Nhân năng lượng phát sáng của monolith

    // 5. CÁC MẢNH ĐÁ VÀ KHUNG KIM LOẠI LƠ LỬNG HAI BÊN (Floating Shards)
    push(getCube(goldBronze, 1.0, 10.0, 1.0, -12.0, 24.0, -1.0));
    push(getCube(goldBronze, 1.0, 10.0, 1.0, 12.0, 24.0, -1.0));
    push(getCube(goldBronze, 6.0, 1.0, 1.0, 0, 51.0, -1.0));
    push(getCube(darkGrey, 1.0, 1.0, 5.0, -13.0, 24.0, 1.0));
    push(getCube(darkGrey, 1.0, 1.0, 5.0, 12.0, 24.0, 1.0));

    return createMesh(V, N, C);
}

function genCosmicSkyMesh() {
    let V = [], N = [], C = [];
    const push = (m) => { V.push(...m.v); N.push(...m.n); C.push(...m.c); };

    // Create Stars
    for (let i = 0; i < 400; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        if (Math.cos(phi) < 0) continue; // Only upper hemisphere
        const r = 500.0 + Math.random() * 200.0;
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);
        const s = 1.0 + Math.random() * 2.0;
        const color = Math.random() > 0.5 ? [0.8, 0.9, 1.0] : [0.0, 0.8, 1.0];
        push(getCube(color, s, s, s, x, y, z));
    }

    // Create Asteroids (Floating Rocks)
    for (let i = 0; i < 60; i++) {
        const x = (Math.random() - 0.5) * 600.0;
        const y = 40.0 + Math.random() * 250.0;
        const z = (Math.random() - 0.5) * 600.0;
        const s = 2.0 + Math.random() * 10.0;
        push(getCube([0.05, 0.05, 0.08], s, s * 0.8, s * 1.2, x, y, z));
    }

    return createMesh(V, N, C);
}

function genWaterMesh() {
    let V = [], N = [], C = [];
    const S = 400;
    // Chỉnh mặt hướng xuống theo yêu cầu
    V.push(-S, -9.5, -S, -S, -9.5, S, S, -9.5, S);
    V.push(-S, -9.5, -S, S, -9.5, S, S, -9.5, -S);
    for (let i = 0; i < 6; i++) { N.push(0, -1, 0); C.push(0.05, 0.3, 0.6); }
    return createMesh(V, N, C);
}

function genSkyMesh() {
    const S = 4000; // Tăng cực lớn để bao phủ toàn bộ tầm nhìn
    const m = getCube([1, 1, 1], S, S, S);
    return createMesh(m.v, m.n, m.c);
}

const MAP_SIZE = 400, MAP_RES = isMobile ? 48 : 64; // Giảm độ phân giải địa hình trên mobile
function getHeight(x, z) {
    const nx = x * 0.02, nz = z * 0.02;
    let y = Math.sin(nx) * Math.cos(nz) * 8 + Math.sin(nx * 3 + nz) * 2;
    const d = Math.sqrt(x * x + z * z) / (MAP_SIZE / 2);
    y -= d * d * 20; return y < -10 ? -10 : y;
}

function getTerrainNormal(x, z) {
    const eps = 0.2;
    const hL = getHeight(x - eps, z);
    const hR = getHeight(x + eps, z);
    const hD = getHeight(x, z - eps);
    const hU = getHeight(x, z + eps);
    const nx = -(hR - hL) / (2 * eps);
    const nz = -(hU - hD) / (2 * eps);
    const len = Math.sqrt(nx * nx + 1.0 + nz * nz);
    return len > 0 ? V3.create(nx / len, 1.0 / len, nz / len) : V3.create(0, 1, 0);
}

function makeAlignedMatrix(pos, normal, scale = 1.0) {
    const U = V3.norm(normal);
    const temp = Math.abs(U.x) < 0.9 ? V3.create(1, 0, 0) : V3.create(0, 0, 1);
    const R = V3.norm(V3.cross(temp, U));
    const F = V3.norm(V3.cross(U, R));
    return new Float32Array([
        R.x * scale, R.y * scale, R.z * scale, 0,
        U.x * scale, U.y * scale, U.z * scale, 0,
        F.x * scale, F.y * scale, F.z * scale, 0,
        pos.x, pos.y, pos.z, 1
    ]);
}

function genTerrain() {
    let V = [], N = [], C = [];
    const step = MAP_SIZE / MAP_RES, offset = -MAP_SIZE / 2;
    for (let i = 0; i < MAP_RES; i++) {
        for (let j = 0; j < MAP_RES; j++) {
            const x = offset + i * step, z = offset + j * step, x1 = x + step, z1 = z + step;
            const y00 = getHeight(x, z), y10 = getHeight(x1, z), y01 = getHeight(x, z1), y11 = getHeight(x1, z1);
            // Màu đá tối, đá phiến xanh mát (Slate Blue/Grey) tạo độ tương phản màu sắc rõ rệt với Bot đỏ ấm áp
            let c = y00 < -8 ? [0.06, 0.08, 0.12] : (y00 < 5 ? [0.08, 0.11, 0.15] : [0.12, 0.15, 0.18]);

            // [PHASE 8] Thêm noise cho màu sắc mặt đất tạo độ sần tự nhiên
            const colorNoise = Math.sin(x * 0.12) * Math.cos(z * 0.12);
            c = [
                Math.max(0.02, c[0] + colorNoise * 0.015),
                Math.max(0.02, c[1] + colorNoise * 0.02),
                Math.max(0.03, c[2] + colorNoise * 0.025)
            ];

            // [PHASE 8] Thêm các bãi máu loang lổ ngẫu nhiên trên mặt đất
            const bloodNoise = Math.sin(x * 0.45) * Math.cos(z * 0.45);
            if (y00 > -8.0 && bloodNoise > 0.88) {
                c = [0.42, 0.03, 0.03]; // Màu máu đỏ sẫm kinh dị
            }

            V.push(x, y00, z, x, y01, z1, x1, y10, z, x1, y10, z, x, y01, z1, x1, y11, z1);
            for (let k = 0; k < 6; k++) { N.push(0, 1, 0); C.push(...c); }
        }
    }
    return createMesh(V, N, C);
}


document.addEventListener("contextmenu", e => e.preventDefault());


const HAKARI_DANCE = { spawned: false, active: false };

function startGame() {
    if (!gl) {
        alert("Thiết bị hoặc trình duyệt của bác không hỗ trợ WebGL2. Vui lòng chuyển sang trình duyệt/thiết bị khác!");
        return;
    }
    const chillSound = document.getElementById('chill-theme-sound');
    if (chillSound) chillSound.pause();

    const combatSound1 = document.getElementById('combat-theme1-sound');
    if (combatSound1) {
        combatSound1.currentTime = 0;
        combatSound1.play().catch(e => console.log("Audio play failed:", e));
    }
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput.value.trim();
    if (!name) {
        alert("VUI LÒNG NHẬP TÊN TRƯỚC KHI BẮT ĐẦU!");
        nameInput.focus();
        return;
    }
    STATE.playerName = name;
    localStorage.setItem('savedPlayerName', name); // Lưu tên vào trình duyệt

    // LUÔN HIỂN THỊ BẢNG HƯỚNG DẪN KHI BẮT ĐẦU CHƠI!
    const instScreen = document.getElementById('first-time-instruction-screen');
    if (instScreen) {
        instScreen.classList.remove('d-none');
        const confirmBtn = document.getElementById('btn-confirm-instruction');
        if (confirmBtn) {
            const hasSeen = localStorage.getItem('hasSeenInstructions_v2');

            if (!hasSeen) {
                // Người mới: phải đợi 10 giây
                confirmBtn.disabled = true;
                confirmBtn.classList.remove('btn-info', 'text-dark');
                confirmBtn.classList.add('btn-secondary', 'text-white');
                confirmBtn.style.boxShadow = 'none';

                let secondsLeft = 10;
                confirmBtn.innerText = `BẮT ĐẦU CHƠI (${secondsLeft}s)`;

                if (window.instructionCountdownInterval) {
                    clearInterval(window.instructionCountdownInterval);
                }

                window.instructionCountdownInterval = setInterval(() => {
                    secondsLeft--;
                    if (secondsLeft > 0) {
                        confirmBtn.innerText = `BẮT ĐẦU CHƠI (${secondsLeft}s)`;
                    } else {
                        clearInterval(window.instructionCountdownInterval);
                        window.instructionCountdownInterval = null;
                        confirmBtn.disabled = false;
                        confirmBtn.classList.remove('btn-secondary', 'text-white');
                        confirmBtn.classList.add('btn-info', 'text-dark');
                        confirmBtn.style.boxShadow = '0 0 15px rgba(0, 243, 255, 0.5)';
                        confirmBtn.innerText = "BẮT ĐẦU CHƠI";
                    }
                }, 1000);

                confirmBtn.onclick = () => {
                    if (confirmBtn.disabled) return;
                    if (window.instructionCountdownInterval) {
                        clearInterval(window.instructionCountdownInterval);
                        window.instructionCountdownInterval = null;
                    }
                    instScreen.classList.add('d-none');
                    localStorage.setItem('hasSeenInstructions_v2', 'true');
                    continueStartGame();
                };
            } else {
                // Người cũ: đóng được liền
                confirmBtn.disabled = false;
                confirmBtn.classList.remove('btn-secondary', 'text-white');
                confirmBtn.classList.add('btn-info', 'text-dark');
                confirmBtn.style.boxShadow = '0 0 15px rgba(0, 243, 255, 0.5)';
                confirmBtn.innerText = "BẮT ĐẦU CHƠI";

                confirmBtn.onclick = () => {
                    instScreen.classList.add('d-none');
                    continueStartGame();
                };
            }
        }
        return; // Chờ người chơi tương tác với bảng
    }

    continueStartGame();
}

function continueStartGame() {
    STATE.screen = 'game';
    // Áp dụng lại độ khó (đảm bảo stats đúng khi bắt đầu trận)
    window.applyDifficulty(window.CURRENT_DIFFICULTY);

    STATE.player.hp = window.GAME_CONFIG.player.maxHp;
    STATE.player.maxHp = window.GAME_CONFIG.player.maxHp;
    STATE.player.armor = 0;
    STATE.player.maxArmor = window.GAME_CONFIG.player.maxArmor;

    // Đồng bộ dame vũ khí vào STATE.weapons
    STATE.weapons[0].damage = window.GAME_CONFIG.weapons.pistol.damage;
    STATE.weapons[1].damage = window.GAME_CONFIG.weapons.smg.damage;
    STATE.weapons[2].damage = window.GAME_CONFIG.weapons.sniper.damage;

    // Reset boss với HP đúng theo độ khó
    STATE.boss.hp = window.GAME_CONFIG.boss.hp;
    STATE.boss.maxHp = window.GAME_CONFIG.boss.hp;
    STATE.boss.active = false; STATE.boss.dead = false; STATE.boss.state = 'idle'; STATE.boss.deathTimer = 0;
    STATE.bossTriggered = false;

    STATE.startTime = Date.now(); STATE.gameEnded = false;

    // CẬP NHẬT CHẾ ĐỘ TRÊN HUD
    const dPreset = window.DIFFICULTY_PRESETS[window.CURRENT_DIFFICULTY];
    const diffDisplay = document.getElementById('difficulty-display');
    if (diffDisplay) {
        diffDisplay.innerText = dPreset.label;
        diffDisplay.style.color = dPreset.color;
    }


    // Spawn người chơi ngay trên mặt đất — bắt đầu animation ngồi dậy
    const _spawnH = getHeight(0, 0);
    STATE.player.pos = V3.create(0, _spawnH, 0);
    STATE.player.vel = V3.create(0, 0, 0);
    STATE.player.alive = true; STATE.player.kills = 0; STATE.player.streak = 0; STATE.player.damageFlash = 0;
    STATE.player.stamina = 100; STATE.player.maxStamina = 100; STATE.player.staminaRegenDelay = 0;
    STATE.player.standUpTimer = 8.0; // 8 giây animation tỉnh dậy realistic & tự nhiên
    STATE.player.isInvincible = true; // Bất tử trong khi đang nằm/đứng dậy
    STATE.player.weaponSwitchTime = 0;
    STATE.camera.rot.x = -1.3; // Camera nhìn lên trời — đang nằm ngửa bất tỉnh
    STATE.camera.rot.y = 0;

    // === EYE BLINK CINEMATIC (8-second wake-up) ===
    const _blinkOverlay = document.getElementById('eye-blink-overlay');
    const _doEyeBlink = (openClass = 'opening', closeDur = 110, openDelay = 130) => {
        if (!_blinkOverlay) return;
        _blinkOverlay.classList.remove('opening', 'waking', 'blinking');
        void _blinkOverlay.offsetWidth;
        _blinkOverlay.classList.add('blinking');
        setTimeout(() => {
            _blinkOverlay.classList.remove('blinking');
            void _blinkOverlay.offsetWidth;
            _blinkOverlay.classList.add(openClass);
        }, openDelay);
    };

    if (_blinkOverlay) {
        // 0.0s–1.0s: Mắt đóng hoàn toàn (đang nằm bất tỉnh, chỉ có tiếng thở nhẹ)
        _blinkOverlay.style.display = 'block';
        _blinkOverlay.className = '';
        const eTop = document.getElementById('eyelid-top');
        const eBot = document.getElementById('eyelid-bottom');
        if (eTop) eTop.style.cssText = 'transform:scaleY(1);transition:none';
        if (eBot) eBot.style.cssText = 'transform:scaleY(1);transition:none';

        // 1.0s–1.5s: Mở mắt rất chậm (tỉnh dậy từ hôn mê, mọi thứ mờ nhạt)
        setTimeout(() => {
            if (eTop) eTop.style.cssText = '';
            if (eBot) eBot.style.cssText = '';
            _blinkOverlay.classList.add('waking');
        }, 1000);

        // 1.8s: Chớp mắt lần 1 — phản xạ đầu tiên, cố gắng lấy nét
        setTimeout(() => _doEyeBlink('opening', 100, 150), 1800);
        // 2.1s: Chớp mắt lần 2 — mắt cay vì ánh sáng
        setTimeout(() => _doEyeBlink('opening', 90, 130), 2100);
        // 2.5s: Chớp mắt lần 3 — đã quen hơn, chớp ngắn
        setTimeout(() => _doEyeBlink('opening', 80, 100), 2500);

        // 7.0s: Ẩn overlay hoàn toàn — đã đứng vững
        setTimeout(() => {
            if (_blinkOverlay) {
                _blinkOverlay.classList.remove('opening', 'waking', 'blinking');
                _blinkOverlay.style.display = 'none';
                if (eTop) eTop.style.cssText = '';
                if (eBot) eBot.style.cssText = '';
            }
        }, 7000);
    }
    // === END EYE BLINK CINEMATIC ===

    // Hiện thông báo theo timeline
    setTimeout(() => showGlobalAnnouncement('😵 ĐANG TỈNH DẬY...', 2500), 1200);
    setTimeout(() => showGlobalAnnouncement('⚔️ BẮT ĐẦU SINH TỒN!', 2500), 8000);

    STATE.bots = []; STATE.loot = []; STATE.barrels = []; STATE.pads = []; STATE.projectiles = [];

    // [PHASE 10] Khởi tạo Particle Object Pool tĩnh (Tránh Garbage Collection stuttering)
    const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
    const poolSize = vfx === 'low' ? 80 : (vfx === 'medium' ? 300 : 1000);
    STATE.particles = [];
    for (let i = 0; i < poolSize; i++) {
        Array.prototype.push.call(STATE.particles, {
            active: false,
            pos: V3.create(0, 0, 0),
            vel: V3.create(0, 0, 0),
            color: [0, 0, 0],
            life: 0,
            type: 'fire'
        });
    }
    // Ghi đè phương thức push của mảng để chặn việc cấp phát động
    STATE.particles.push = function (item) {
        for (let i = 0; i < this.length; i++) {
            const p = this[i];
            if (!p.active) {
                p.active = true;
                p.pos.x = item.pos.x; p.pos.y = item.pos.y; p.pos.z = item.pos.z;
                p.vel.x = item.vel.x; p.vel.y = item.vel.y; p.vel.z = item.vel.z;
                p.color[0] = item.color[0]; p.color[1] = item.color[1]; p.color[2] = item.color[2];
                p.life = item.life;
                p.type = item.type;
                return;
            }
        }
        // Fallback tái chế hạt cũ nhất nếu đầy pool
        let oldest = this[0];
        for (let i = 1; i < this.length; i++) {
            if (this[i].life < oldest.life) oldest = this[i];
        }
        oldest.active = true;
        oldest.pos.x = item.pos.x; oldest.pos.y = item.pos.y; oldest.pos.z = item.pos.z;
        oldest.vel.x = item.vel.x; oldest.vel.y = item.vel.y; oldest.vel.z = item.vel.z;
        oldest.color[0] = item.color[0]; oldest.color[1] = item.color[1]; oldest.color[2] = item.color[2];
        oldest.life = item.life;
        oldest.type = item.type;
    };

    STATE.shake = 0; STATE.obstacles = []; STATE.questItems = []; STATE.finalPaper = null; STATE.hasRedKey = false;
    // Reset QuestManager
    if (window.QuestManager) {
        window.QuestManager.totalCollected = 0;
        window.QuestManager.totalCompleted = 0;
        window.QuestManager.activeQuests = [];
        window.QuestManager.completedTypes = []; // Cực kỳ quan trọng để bắt đầu game mới không bị kẹt quest cũ!
        window.QuestManager.damageTracker = 0;
        window.QuestManager.cumulativeKills = 0;
        window.QuestManager.cumulativeBarrelKills = 0;
        window.QuestManager.cumulativeHeadshots = 0;
        const qt = document.getElementById('quest-tracker-ui');
        if (qt) qt.classList.add('hidden');
        window.QuestManager.updateUI();
    }
    STATE.enragedAnnounced = false;
    STATE.finalAnnounced = false;
    // Reset game state

    const minimap = document.getElementById('minimap');
    if (minimap) { minimap.width = 200; minimap.height = 200; }

    for (let i = 0; i < STATE.config.botCount; i++) {
        let x, z, y;
        do {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * (MAP_SIZE * 0.45);
            x = Math.cos(angle) * dist;
            z = Math.sin(angle) * dist;
            y = getHeight(x, z);
        } while (y <= -8.5); // Đảm bảo bot không spawn dưới nước

        STATE.bots.push({ pos: V3.create(x, y + 1, z), hp: window.GAME_CONFIG.bot.hpLv1, target: null, state: 'roam', nextMove: 0, fireCD: 0, id: i });
    }
    for (let i = 0; i < 300; i++) {
        let x, z, y;
        do {
            x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            y = getHeight(x, z);
        } while (y <= -8.5);
        // 0: Đạn, 1: Máu, 2: Giáp, 3: Random Powerup
        STATE.loot.push({ pos: V3.create(x, y + 0.5, z), type: i % 4 });
    }

    for (let i = 0; i < 40; i++) {  // x2 thùng nổ
        let x, z, y;
        do {
            x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            y = getHeight(x, z);
        } while (y <= -8.5);
        STATE.barrels.push({ pos: V3.create(x, y, z), hp: 20 });
    }
    const activePreset = dPreset || window.DIFFICULTY_PRESETS['normal'];
    const qCount = activePreset.questCount || 5;
    // Mỗi chế độ đều thiếu 1 hộp trên bản đồ (N - 1), chỉ khi kill Boss mới rớt hộp cuối!
    for (let i = 0; i < qCount - 1; i++) {
        let x, z, y;
        do {
            x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            y = getHeight(x, z);
        } while (y <= -8.5);
        STATE.questItems.push({ pos: V3.create(x, y + 1.0, z) });
    }
    for (let i = 0; i < 40; i++) {
        let x, z, y;
        do {
            x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            y = getHeight(x, z);
        } while (y <= -8.5);
        const padNormal = getTerrainNormal(x, z);
        // Nhích pad lên trên mặt đất một tí (0.05) để tránh Z-fighting với địa hình dốc
        STATE.pads.push({ pos: V3.create(x, y + 0.05, z), normal: padNormal });
    }

    // Hàm kiểm tra nằm trong "Con Đường Tuyệt Vọng" (The Void Path)
    const isInPath = (x, z) => (x > -30 && x < 30 && z < 20 && z > -180);

    // [PHASE 8] Tránh spawn đè lên các Khu vực Điểm nhấn (Landmark Areas)
    const isNearLandmark = (x, z) => {
        const distHospital = Math.sqrt((x - 80) ** 2 + (z - 80) ** 2);
        const distCrash = Math.sqrt((x - (-60)) ** 2 + (z - 60) ** 2);
        return distHospital < 25 || distCrash < 20;
    };

    // Khởi tạo Vật cản (Cây, Nhà, Xe)
    for (let i = 0; i < (isMobile ? 25 : 60); i++) {
        const x = Math.sin(i * 132.1) * MAP_SIZE * 0.4;
        const z = Math.cos(i * 52.3) * MAP_SIZE * 0.4;
        const y = getHeight(x, z);
        if (y > -8.5 && !isInPath(x, z) && !isNearLandmark(x, z)) {
            STATE.obstacles.push({ type: 'tree', pos: { x, y: y - 0.5, z }, radius: 1.0, scale: 1.5 + Math.sin(i) * 0.5, rot: 0 });
        }
    }
    for (let i = 0; i < 12; i++) {
        let x, z, y;
        do {
            x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            y = getHeight(x, z);
        } while (y <= -8.5 || isInPath(x, z) || isNearLandmark(x, z));
        STATE.obstacles.push({ type: 'house', pos: { x, y: y - 1.0, z }, radius: 4.5, rot: Math.random() * Math.PI, scale: 1 });
    }
    for (let i = 0; i < 20; i++) {
        let x, z, y;
        do {
            x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
            y = getHeight(x, z);
        } while (y <= -8.5 || isInPath(x, z) || isNearLandmark(x, z));
        STATE.obstacles.push({ type: 'car', pos: { x, y: y - 0.5, z }, radius: 2.5, rot: Math.random() * Math.PI, scale: 1 });
    }

    // --- MANUALLY SPAWN LANDMARK AREAS ---
    // Landmark 1: Abandoned Hospital tại (80, 0, 80)
    const hospX = 80, hospZ = 80;
    const hospY = getHeight(hospX, hospZ);
    // Hospital Main Building (Tòa nhà đặc biệt khổng lồ)
    STATE.obstacles.push({ type: 'house', pos: { x: hospX, y: hospY - 1.0, z: hospZ }, radius: 9.0, rot: 0.2, scale: 2.0 });
    // Debris and warning signs around hospital
    STATE.obstacles.push({ type: 'debris', pos: { x: hospX - 6, y: getHeight(hospX - 6, hospZ + 4) - 0.2, z: hospZ + 4 }, radius: 2.0, rot: 0.8, scale: 1.5 });
    STATE.obstacles.push({ type: 'warningSign', pos: { x: hospX - 10, y: getHeight(hospX - 10, hospZ + 10) - 0.2, z: hospZ + 10 }, radius: 1.0, rot: 0.5, scale: 1.2 });
    // STATE.obstacles.push({ type: 'lampPost', pos: { x: hospX + 10, y: getHeight(hospX + 10, hospZ - 10) - 0.2, z: hospZ - 10 }, radius: 1.0, rot: -0.5, scale: 1.0 });

    // Landmark 2: Crash Site tại (-60, 0, 60)
    const crashX = -60, crashZ = 60;
    const crashY = getHeight(crashX, crashZ);
    // Xe tông nát và đổ xô lệch
    STATE.obstacles.push({ type: 'car', pos: { x: crashX, y: crashY - 0.4, z: crashZ }, radius: 2.5, rot: 1.2, scale: 1.1 });
    STATE.obstacles.push({ type: 'car', pos: { x: crashX + 5, y: getHeight(crashX + 5, crashZ - 4) - 0.5, z: crashZ - 4 }, radius: 2.5, rot: -2.3, scale: 1.0 });
    // Đống đổ nát ngổn ngang xung quanh vụ tai nạn
    STATE.obstacles.push({ type: 'debris', pos: { x: crashX - 4, y: getHeight(crashX - 4, crashZ + 2) - 0.2, z: crashZ + 2 }, radius: 2.0, rot: 0.5, scale: 1.3 });
    STATE.obstacles.push({ type: 'debris', pos: { x: crashX + 3, y: getHeight(crashX + 3, crashZ + 6) - 0.2, z: crashZ + 6 }, radius: 2.0, rot: -0.9, scale: 1.6 });
    STATE.obstacles.push({ type: 'warningSign', pos: { x: crashX + 8, y: getHeight(crashX + 8, crashZ + 2) - 0.2, z: crashZ + 2 }, radius: 1.0, rot: 1.8, scale: 1.0 });

    // Landmark 3: The Void Path flashing warning lights (z = -10 to -120, x = -15 and +15)
    // Spawn Cột đá Obsidian thành 2 hàng dọc (The Void Path)
    for (let i = 0; i < 12; i++) {
        const zPos = -10 - (i * 10);
        const xLeft = -15;
        const xRight = 15;
        const yL = getHeight(xLeft, zPos);
        const yR = getHeight(xRight, zPos);
        STATE.obstacles.push({ type: 'pillar', pos: { x: xLeft, y: yL - 1.0, z: zPos }, radius: 1.5, rot: 0, scale: 1 });
        STATE.obstacles.push({ type: 'pillar', pos: { x: xRight, y: yR - 1.0, z: zPos }, radius: 1.5, rot: 0, scale: 1 });

        // Cứ mỗi 2 cột ta spawn thêm 1 cột đèn chớp đỏ dẫn đường ghê rợn dọc 2 bên (ĐÃ XÓA THEO YÊU CẦU)
        // if (i % 2 === 0) {
        //     STATE.obstacles.push({ type: 'lampPost', pos: { x: xLeft + 1.5, y: yL - 0.2, z: zPos }, radius: 1.0, rot: Math.PI / 2, scale: 0.9 });
        //     STATE.obstacles.push({ type: 'lampPost', pos: { x: xRight - 1.5, y: yR - 0.2, z: zPos }, radius: 1.0, rot: -Math.PI / 2, scale: 0.9 });
        // }
    }
    // Đặt Cánh Cửa Đỏ Rực cố định ở góc xa bản đồ
    const doorX = 0;
    const doorZ = -150;
    const doorY = getHeight(doorX, doorZ);
    STATE.obstacles.push({ type: 'redDoor', pos: { x: doorX, y: doorY - 1.0, z: doorZ }, radius: 8.0, rot: 0, scale: 1 });
    // Đã xóa vòng lặp spawn STATE.powerups để chỉ giữ lại 4 loại hòm cơ bản (STATE.loot)

    document.getElementById('main-menu').classList.add('hidden'); document.getElementById('game-over-screen').classList.add('hidden'); document.getElementById('ui-layer').style.display = 'block';

    // Tự động xoay ngang và full màn hình trên Mobile
    if (isMobile) {
        const docElm = document.documentElement;
        if (docElm.requestFullscreen) docElm.requestFullscreen().catch(e => console.log(e));
        else if (docElm.webkitRequestFullscreen) docElm.webkitRequestFullscreen().catch(e => console.log(e));
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(e => console.log(e));
        }
    }

    if (typeof sendLiveNotification === 'function') sendLiveNotification();
    gl.canvas.requestPointerLock(); requestAnimationFrame(window.loop);

}

// --- HỆ THỐNG SỐ DAME (DAMAGE INDICATORS) ---
function spawnDamageNumber(pos, damage, isHeadshot) {
    const screenPos = project3DToScreen(pos);
    if (!screenPos) return;

    const el = document.createElement('div');
    el.className = `damage-number ${isHeadshot ? 'damage-headshot' : 'damage-normal'}`;
    el.innerText = Math.round(damage);
    el.style.left = screenPos.x + 'px';
    el.style.top = screenPos.y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function project3DToScreen(pos) {
    if (!gl || !gl.canvas) return null;
    const p = STATE.player;
    const aspect = gl.canvas.width / gl.canvas.height;
    const zoomFactor = [0.3, 0.6, 0.95][p.weaponIdx];
    const fov = 1.2 - (STATE.aimLerp * zoomFactor) + (STATE.sprintLerp * 0.3);
    const projection = M4.perspective(fov, aspect, 0.1, 1000);

    // Tính chiều cao camera và độ nghiêng của đầu theo standUpTimer
    let camHeightOffset = 1.1;
    let standUpPitchOffset = 0;
    if ((p.standUpTimer || 0) > 0) {
        const elapsed = 3.0 - p.standUpTimer;
        if (elapsed < 1.5) {
            const ratio = elapsed / 1.5;
            camHeightOffset = 0.15 + ratio * (0.6 - 0.15);
            standUpPitchOffset = (1.0 - ratio) * 0.8;
        } else {
            const ratio = (elapsed - 1.5) / 1.5;
            camHeightOffset = 0.6 + ratio * (1.1 - 0.6);
            standUpPitchOffset = 0.0;
        }
    }

    const yaw = STATE.camera.rot.y + (p.standUpYawOffset || 0), pitch = STATE.camera.rot.x + standUpPitchOffset;
    const eye = V3.create(p.pos.x, p.pos.y + camHeightOffset, p.pos.z);
    const forward = V3.create(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const view = M4.lookAt(eye, V3.add(eye, forward), V3.create(0, 1, 0));

    // Project point
    let p4 = [pos.x, pos.y, pos.z, 1.0];
    let clip = [0, 0, 0, 0];
    const viewProj = M4.multiply(projection, view);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) clip[i] += p4[j] * viewProj[j * 4 + i];
    }
    if (clip[3] <= 0) return null; // Phía sau camera
    const ndc = [clip[0] / clip[3], clip[1] / clip[3]];
    return {
        x: (ndc[0] * 0.5 + 0.5) * window.innerWidth,
        y: (0.5 - ndc[1] * 0.5) * window.innerHeight
    };
}

function update(dt) {
    if (STATE.screen === 'pause' || STATE.inputLocked) return;
    if (!STATE.player || !STATE.player.pos) return; // Ensure player position is initialized
    // Phase 3: Hit-pause system
    if (STATE.hitPause > 0) { STATE.hitPause -= dt; return; }

    // === WAKE-UP ANIMATION 8s: Realistic, natural human motion ===
    const p = STATE.player;
    if ((p.standUpTimer || 0) > 0) {
        p.standUpTimer -= dt;
        const TOTAL = 8.0;
        const elapsed = TOTAL - Math.max(0, p.standUpTimer);

        // Smooth easing helpers
        const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);

        // === CAMERA PITCH (rot.x) — natural head movement ===
        // 0.0–1.0s: Lying still, unconscious (rot.x = -1.3)
        // 1.0–2.0s: Eyes open, still lying, tiny head micro-movements
        // 2.0–3.0s: Very slowly place hand on ground, head starts tilting forward
        // 3.0–4.0s: Push upper body up to supported sitting (slow, groggy)
        // 4.0–6.0s: Sitting position, looking around (head turns left then right)
        // 6.0–7.2s: Standing up gradually (longest phase, most effort)
        // 7.2–8.0s: Spine straightens, settle into idle pose
        if (elapsed < 1.0) {
            // Unconscious — subtle breathing micro-movement
            const breathe = Math.sin(elapsed * 4.0) * 0.015;
            STATE.camera.rot.x = -1.3 + breathe;
        } else if (elapsed < 2.0) {
            // Eyes opening, slight confused head movement
            const t = easeOut((elapsed - 1.0) / 1.0);
            const breathe = Math.sin(elapsed * 3.5) * 0.01;
            STATE.camera.rot.x = -1.3 + t * 0.1 + breathe; // -1.3 → -1.2
        } else if (elapsed < 3.0) {
            // Placing hand on ground, head starts to tilt
            const t = easeInOut((elapsed - 2.0) / 1.0);
            STATE.camera.rot.x = -1.2 + t * 0.3; // -1.2 → -0.9
        } else if (elapsed < 4.0) {
            // Pushing up to sitting — main effort
            const t = easeInOut((elapsed - 3.0) / 1.0);
            STATE.camera.rot.x = -0.9 + t * 0.75; // -0.9 → -0.15
        } else if (elapsed < 6.0) {
            // Sitting, looking around
            STATE.camera.rot.x = -0.15;
        } else if (elapsed < 7.2) {
            // Standing up — gradual, realistic
            const t = easeInOut((elapsed - 6.0) / 1.2);
            STATE.camera.rot.x = -0.15 + t * 0.15; // -0.15 → 0
        } else {
            // Final settle — tiny overshoot correction
            const t = easeOut((elapsed - 7.2) / 0.8);
            STATE.camera.rot.x = 0.02 * (1 - t); // tiny overshoot → 0
        }

        // === YAW OFFSET: Look left → pause → look right (4.0s–6.0s) ===
        let _yawOff = 0;
        if (elapsed >= 4.0 && elapsed < 4.6) {
            // Turn head left slowly
            const t = easeInOut((elapsed - 4.0) / 0.6);
            _yawOff = -0.38 * t;
        } else if (elapsed >= 4.6 && elapsed < 4.9) {
            // Pause at left — scanning environment
            _yawOff = -0.38;
        } else if (elapsed >= 4.9 && elapsed < 5.6) {
            // Turn from left to right — smooth sweep
            const t = easeInOut((elapsed - 4.9) / 0.7);
            _yawOff = -0.38 + t * 0.70; // -0.38 → +0.32
        } else if (elapsed >= 5.6 && elapsed < 5.8) {
            // Pause at right — brief check
            _yawOff = 0.32;
        } else if (elapsed >= 5.8 && elapsed < 6.0) {
            // Return to center
            const t = easeInOut((elapsed - 5.8) / 0.2);
            _yawOff = 0.32 * (1 - t); // 0.32 → 0
        }
        p.standUpYawOffset = _yawOff;

        // === VIGNETTE: Heavy while lying, fading as we stand ===
        const vignetteEl = document.getElementById('screen-vignette');
        if (elapsed < 2.0) {
            // Heavy dark vignette — just woke up, vision blurry
            if (vignetteEl) vignetteEl.style.opacity = 0.7;
        } else if (elapsed < 7.2) {
            // Gradually clear up vision
            const t = (elapsed - 2.0) / 5.2;
            if (vignetteEl) vignetteEl.style.opacity = 0.7 - t * 0.7;
        } else {
            if (vignetteEl) vignetteEl.style.opacity = '';
        }

        // === CAMERA SHAKE: Effort during push-up and standing ===
        if (elapsed >= 3.0 && elapsed < 4.0) {
            // Push-up effort shake
            const intensity = Math.sin((elapsed - 3.0) / 1.0 * Math.PI) * 0.035;
            STATE.camera.shake = intensity;
        } else if (elapsed >= 6.0 && elapsed < 7.0) {
            // Standing effort shake (lighter)
            const intensity = Math.sin((elapsed - 6.0) / 1.0 * Math.PI) * 0.02;
            STATE.camera.shake = intensity;
        } else {
            STATE.camera.shake = 0;
        }

        // === ANIMATION COMPLETE ===
        if (p.standUpTimer <= 0) {
            p.standUpTimer = 0;
            p.standUpYawOffset = 0;
            p.isInvincible = false;
            p.weaponSwitchTime = 0; // Trigger equip slide
            STATE.camera.rot.x = 0;
            STATE.camera.shake = 0;
            if (vignetteEl) vignetteEl.style.opacity = '';
            const _bo = document.getElementById('eye-blink-overlay');
            if (_bo) _bo.style.display = 'none';
        }
        // Lock all movement & shooting during wake-up
        return;
    }
    p.standUpYawOffset = 0;

    if (!STATE.gameEnded && STATE.screen === 'game' && Math.random() < 0.0005) {

        // Random lore ambient sounds/texts if needed
    }

    const P = window.GAME_CONFIG.player;

    // Quest System Update
    if (window.QuestManager) window.QuestManager.update(dt);

    // Quest item: E-key pickup
    let nearQuestItem = false;
    STATE.questItems = STATE.questItems.filter(q => {
        const dist = V3.dist(STATE.player.pos, q.pos);
        if (dist < 4.0) {
            nearQuestItem = true;
            if (STATE.keys['KeyE'] && window.QuestManager) {
                STATE.keys['KeyE'] = false; // consume key
                window.QuestManager.assignQuest();
                playAudio('ammo');
                return false;
            }
        }
        return true;
    });

    // finalPaper: E-key pickup (Chìa khóa đỏ)
    let nearFinalPaper = false;
    if (STATE.finalPaper && STATE.finalPaper.active && !STATE.finalPaper.pickedUp) {
        const dist = V3.dist(STATE.player.pos, STATE.finalPaper.pos);
        if (dist < 4.0) {
            nearFinalPaper = true;
            if (STATE.keys['KeyE']) {
                STATE.keys['KeyE'] = false; // consume key
                STATE.finalPaper.pickedUp = true;
                STATE.finalPaper.active = false;
                playAudio('ammo');

                if (window.QuestManager) {
                    window.QuestManager.onRedKeyPickup();
                }

                // Chuyển sang trạng thái giữ Chìa Khóa Đỏ
                STATE.hasRedKey = true;
                showGlobalAnnouncement("🔑 ĐÃ THU THẬP CHÌA KHÓA ĐỎ! Chạy theo vạch chỉ đường đỏ đến CÁNH CỬA ĐỎ để giải thoát!", 8000);
            }
        }
    }

    // Kiểm tra hoàn thành game khi mang Chìa Khóa Đỏ tới Cánh Cửa Đỏ (0, -150)
    let nearRedDoor = false;
    let nearRedDoorWithoutKey = false;
    const dxDoor = STATE.player.pos.x - 0;
    const dzDoor = STATE.player.pos.z - (-150);
    const distToDoor = Math.sqrt(dxDoor * dxDoor + dzDoor * dzDoor);

    if (distToDoor < 6.0) {
        if (STATE.hasRedKey) {
            nearRedDoor = true;
            if (STATE.keys['KeyE']) {
                STATE.keys['KeyE'] = false; // consume key

                // KHÔNG gửi Discord tại đây để tránh double-send với showRealEndScreen
                // Discord sẽ được gửi 1 lần duy nhất từ showRealEndScreen() sau khi cốt truyện kết thúc

                STATE.hasRedKey = false; // reset

                // Premium animation: Siêu chấn động màn hình và bùng nổ không gian đỏ rực rỡ từ cánh cổng
                STATE.shake = 30.0;
                spawnParticles({ x: 0, y: 3.0, z: -150 }, 300, [1.0, 0.05, 0.05], 8.0, 'fire');

                // Kích hoạt Chiến thắng và kết thúc game
                spawnHakariDance();
                playBossSound();
                showClickAnywhere(2000); // Đợi 2s rồi hiện Tiếp tục
            }
        } else {
            nearRedDoorWithoutKey = true;
        }
    }

    // Show E-key hint for quest items / final paper / red door
    const interMsg = document.getElementById('interaction-msg');
    const btnInteractEl = document.getElementById('btn-interact');
    if (nearQuestItem || nearFinalPaper || nearRedDoor || nearRedDoorWithoutKey) {
        if (interMsg) {
            interMsg.style.display = 'block';
            if (nearRedDoor) {
                interMsg.innerHTML = '🔑 [E] MỞ CÁNH CỬA ĐỎ<br><span style="font-size:10px">(Chạm vào đây để mở cửa)</span>';
            } else if (nearRedDoorWithoutKey) {
                interMsg.innerHTML = '🔒 CỔNG ĐANG KHÓA!<br><span style="font-size:10px; color:#ff3333;">Bạn cần thu thập Chìa Khóa Đỏ để thoát khỏi đảo</span>';
            } else if (nearFinalPaper) {
                interMsg.innerHTML = '🔑 [E] NHẶT CHÌA KHÓA ĐỎ<br><span style="font-size:10px">(Chạm vào đây để nhặt)</span>';
            } else {
                interMsg.innerHTML = '📦 [E] NHẶT CHIẾC HỘP THÔNG TIN<br><span style="font-size:10px">(Chạm vào đây để nhặt)</span>';
            }
        }
        if (btnInteractEl) {
            if (nearRedDoorWithoutKey) {
                btnInteractEl.classList.add('hidden'); // Mobile: Ẩn nút nhấn E ảo trên mobile nếu chưa có chìa khóa
            } else {
                btnInteractEl.classList.remove('hidden');
            }
        }
    } else {
        if (btnInteractEl) btnInteractEl.classList.add('hidden');
    }

    STATE.shake *= 0.9;
    if (STATE.player.damageFlash > 0) STATE.player.damageFlash -= dt;
    const prevCount = STATE.bots.length;

    let speedMult = 1.0, dmgMult = 1.0;
    if (p.powerup) {
        if (p.powerup.type === 0 || p.powerup.type === 3) speedMult = window.GAME_CONFIG.player.powerupSpeedMultiplier;
        if (p.powerup.type === 1 || p.powerup.type === 3) dmgMult = 2.0;
    }
    let move = V3.create(0, 0, 0); if (STATE.keys['KeyW']) move.z -= 1; if (STATE.keys['KeyS']) move.z += 1; if (STATE.keys['KeyA']) move.x -= 1; if (STATE.keys['KeyD']) move.x += 1;
    const isMoving = (move.x !== 0 || move.z !== 0);

    // === HỆ THỐNG THỂ LỰC (STAMINA) ===
    if (p.stamina === undefined) { p.stamina = 100; p.maxStamina = 100; p.staminaRegenDelay = 0; p.exhausted = false; }

    // Nếu bấm chạy, đang di chuyển và không cầm súng ngắm (weaponIdx 2) và đã tỉnh dậy và KHÔNG bị kiệt sức
    if (STATE.keys['ShiftLeft'] && isMoving && p.weaponIdx !== 2 && (p.standUpTimer || 0) <= 0 && !p.exhausted) {
        if (p.stamina > 0) {
            // Nếu đang có powerup Tốc Độ (type 0) hoặc Siêu Cấp (type 3) → chạy được 15 giây
            const hasSpeedPowerup = p.powerup && p.powerup.time > 0 && (p.powerup.type === 0 || p.powerup.type === 3);
            const staminaDrainTime = hasSpeedPowerup ? 15.0 : 8.0; // 15s khi có powerup, 8s bình thường
            p.stamina -= (100 / staminaDrainTime) * dt;
            p.staminaRegenDelay = 0.5; // Chờ 0.5s sau khi dừng chạy mới hồi
            if (p.stamina <= 0) {
                p.stamina = 0;
                p.exhausted = true; // Rơi vào trạng thái kiệt sức
                STATE.keys['ShiftLeft'] = false; // Buộc dừng chạy
                const btnSprint = document.getElementById('btn-sprint');
                if (btnSprint) btnSprint.classList.remove('pressed');
            }
        }
    } else {
        // Hủy trạng thái chạy nếu đang kiệt sức mà người chơi vẫn cố bấm phím
        if (p.exhausted) {
            STATE.keys['ShiftLeft'] = false;
            const btnSprint = document.getElementById('btn-sprint');
            if (btnSprint) btnSprint.classList.remove('pressed');
        }

        // Hồi phục thể lực
        if (p.staminaRegenDelay > 0) {
            p.staminaRegenDelay -= dt;
        } else if (p.stamina < p.maxStamina) {
            p.stamina += (100 / 3.0) * dt; // 3 giây để hồi đầy
            if (p.stamina >= p.maxStamina) {
                p.stamina = p.maxStamina;
                p.exhausted = false; // Hồi đầy bình thì hết kiệt sức
            }
        }
    }

    // Cập nhật giao diện UI thanh thể lực
    const staminaFill = document.getElementById('stamina-fill');
    if (staminaFill) {
        staminaFill.style.width = (p.stamina / p.maxStamina * 100) + '%';
        if (p.exhausted) {
            staminaFill.style.background = 'linear-gradient(90deg, #ff6666, #ff0000)'; // Đỏ nhạt
            staminaFill.style.boxShadow = '0 -2px 8px rgba(255, 0, 0, 0.6)';
        } else {
            staminaFill.style.background = 'linear-gradient(90deg, #00f3ff, #0099ff)'; // Xanh lơ nhạt
            staminaFill.style.boxShadow = '0 -2px 8px rgba(0, 243, 255, 0.6)';
        }
    }

    if (STATE.keys['ShiftLeft'] && p.stamina > 0) speedMult *= window.GAME_CONFIG.player.sprintMultiplier;

    // GIẢM TỐC ĐỘ: Đi bộ 8, Chạy nhanh 12 (8 * 1.5)
    const moveSpeed = (p.weaponIdx === 2 ? window.GAME_CONFIG.player.sniperSpeed : window.GAME_CONFIG.player.walkSpeed) * speedMult;

    // === STRAFE TILT: Camera nghiêng nhẹ khi di chuyển ngang (AAA FPS feel) ===
    const targetTilt = (STATE.keys['KeyD'] ? 1 : 0) - (STATE.keys['KeyA'] ? 1 : 0);
    STATE.strafeTilt = (STATE.strafeTilt || 0) + (targetTilt * 0.035 - (STATE.strafeTilt || 0)) * 6.0 * dt;

    // === LANDING IMPACT: Camera dập + bụi khi rơi từ bật nhảy/nhảy cao (không tính lúc tỉnh dậy) ===
    if (!p._prevVelY) p._prevVelY = 0;
    if (!p._landingDip) p._landingDip = 0;
    if (p._prevVelY < -8 && p.grounded && (p.standUpTimer || 0) <= 0) {
        // Rơi mạnh — tạo hiệu ứng va chạm
        const impactForce = Math.min(Math.abs(p._prevVelY) / 30, 1.0);
        p._landingDip = impactForce * 0.25; // Camera dập xuống
        // Spawn bụi đất khi đáp
        for (let i = 0; i < 8; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 1.5 + Math.random() * 3;
            spawnParticles(V3.create(
                p.pos.x + Math.cos(ang) * 0.5,
                p.pos.y + 0.1,
                p.pos.z + Math.sin(ang) * 0.5
            ), 1, [0.35, 0.28, 0.18], 0.8 + Math.random() * 0.5);
        }
    }
    p._prevVelY = p.vel.y;
    // Landing dip recovery (hồi phục camera dập)
    if (p._landingDip > 0.001) {
        p._landingDip *= (1.0 - 8.0 * dt); // Decay nhanh
    } else {
        p._landingDip = 0;
    }

    // === FOOTSTEP DUST: Bụi nhẹ bay lên khi chạy trên đất ===
    if (p.grounded && V3.len(move) > 0.3 && Math.random() < 0.15) {
        const dustX = p.pos.x + (Math.random() - 0.5) * 0.6;
        const dustZ = p.pos.z + (Math.random() - 0.5) * 0.6;
        spawnParticles(V3.create(dustX, p.pos.y + 0.05, dustZ), 1, [0.3, 0.25, 0.18], 0.4 + Math.random() * 0.3);
    }
    if (p.isChargingUlti) {
        move.x = 0; move.z = 0;
        // Hiệu ứng Aura xoay chậm quanh người chơi (Vòng xoáy năng lượng)
        const t = performance.now() * 0.003;
        const radius = 1.8;
        for (let i = 0; i < 3; i++) {
            const ang = t + i * (Math.PI * 2 / 3);
            const px = p.pos.x + Math.cos(ang) * radius;
            const pz = p.pos.z + Math.sin(ang) * radius;
            // Spawning glowing particles that hover
            spawnParticles(V3.create(px, p.pos.y + 0.2 + Math.sin(t * 3 + i) * 0.8, pz), 1, [1, 0.6, 0], 0.02);
        }
    } // Đứng yên khi gồng UNTI
    if (V3.len(move) > 0) move = V3.norm(move);

    // Quán tính (Lerp) di chuyển
    p.currentMove = p.currentMove || V3.create(0, 0, 0);
    p.currentMove.x += (move.x - p.currentMove.x) * 15 * dt;
    p.currentMove.z += (move.z - p.currentMove.z) * 15 * dt;

    if (Math.abs(p.currentMove.x) > 0.001 || Math.abs(p.currentMove.z) > 0.001) {
        const yaw = STATE.camera.rot.y, forward = V3.create(Math.sin(yaw), 0, -Math.cos(yaw)), right = V3.create(Math.cos(yaw), 0, Math.sin(yaw));
        let finalMove = V3.add(V3.mul(forward, -p.currentMove.z), V3.mul(right, p.currentMove.x));
        p.pos.x += finalMove.x * moveSpeed * dt; p.pos.z += finalMove.z * moveSpeed * dt;

        // Xử lý va chạm với vật cản
        for (let obs of STATE.obstacles) {
            // Cho phép nhảy lên nóc xe/nhà nếu nhân vật ở trên cao
            if ((obs.type === 'car' && p.pos.y > obs.pos.y + 1.2) ||
                (obs.type === 'house' && p.pos.y > obs.pos.y + 3.0)) continue;

            if (obs.type === 'redDoor') {
                // AABB box hitbox: chiều rộng ngang = 16 (halfX = 8.0), chiều dày dọc = 4 (halfZ = 2.0)
                // Kích thước của người chơi có bán kính khoảng 0.8
                const halfX = 8.0 + 0.8;
                const halfZ = 2.0 + 0.8;
                const minX = obs.pos.x - halfX;
                const maxX = obs.pos.x + halfX;
                const minZ = obs.pos.z - halfZ;
                const maxZ = obs.pos.z + halfZ;
                if (p.pos.x > minX && p.pos.x < maxX && p.pos.z > minZ && p.pos.z < maxZ) {
                    const pushX = p.pos.x > obs.pos.x ? (maxX - p.pos.x) : (minX - p.pos.x);
                    const pushZ = p.pos.z > obs.pos.z ? (maxZ - p.pos.z) : (minZ - p.pos.z);
                    if (Math.abs(pushX) < Math.abs(pushZ)) {
                        p.pos.x += pushX;
                    } else {
                        p.pos.z += pushZ;
                    }
                }
                continue;
            }

            let dx = p.pos.x - obs.pos.x;
            let dz = p.pos.z - obs.pos.z;
            let distSq = dx * dx + dz * dz;
            let rSq = obs.radius * obs.radius;
            if (distSq < rSq) {
                let dist = Math.sqrt(distSq);
                if (dist === 0) { dx = 1; dist = 1; }
                let pushAmt = obs.radius - dist;
                p.pos.x += (dx / dist) * pushAmt;
                p.pos.z += (dz / dist) * pushAmt;
            }
        }

        // Sửa lỗi Bức tường tàng hình (Giới hạn ranh giới bản đồ)
        p.pos.x = Math.max(-200, Math.min(200, p.pos.x));
        p.pos.z = Math.max(-200, Math.min(200, p.pos.z));
    }
    p.vel.y -= 25 * dt; p.pos.y += p.vel.y * dt;
    let floorH = getHeight(p.pos.x, p.pos.z);
    for (let obs of STATE.obstacles) {
        let dx = p.pos.x - obs.pos.x;
        let dz = p.pos.z - obs.pos.z;
        // Chỉ tính là mặt sàn nếu nhân vật đã thực sự nhảy vượt qua độ cao của trần nhà/xe trừ đi một khoảng sai số nhỏ
        if (dx * dx + dz * dz <= obs.radius * obs.radius) {
            if (obs.type === 'car' && p.pos.y >= obs.pos.y + 1.0) floorH = Math.max(floorH, obs.pos.y + 1.7); // Nóc xe
            if (obs.type === 'house' && p.pos.y >= obs.pos.y + 3.0) floorH = Math.max(floorH, obs.pos.y + 4.5); // Nóc nhà
        }
    }
    let onPad = false;
    for (let pad of STATE.pads) {
        if (V3.dist(p.pos, pad.pos) < 3 && Math.abs(p.pos.y - pad.pos.y) < 2) {
            const normal = pad.normal || V3.create(0, 1, 0);
            p.vel = V3.mul(normal, 30); // Đẩy người chơi dọc theo véc-tơ pháp tuyến dốc của bệ nhảy
            p.grounded = false;
            onPad = true;
            playAudio('jump');
            break;
        }
    }
    if (!onPad && p.pos.y < floorH) { p.pos.y = floorH; p.vel.y = 0; p.grounded = true; } else if (!onPad) p.grounded = false;
    if (STATE.keys['Space'] && p.grounded) { p.vel.y = window.GAME_CONFIG.player.jumpPower; p.grounded = false; }
    const now = performance.now(), weapon = STATE.weapons[p.weaponIdx];
    if (!STATE.hasRedKey && STATE.mouse.down && now - STATE.lastShot > weapon.rate && weapon.ammo > 0) { fireWeapon(p, STATE.camera.rot, weapon, true); weapon.ammo--; STATE.lastShot = now; p.recoil = 0.1; spawnMuzzleFlash(p.pos, STATE.camera.rot); }
    if (p.weaponIdx !== p.lastWeaponIdx) {
        p.weaponSwitchTime = 0;
        p.lastWeaponIdx = p.weaponIdx;
        playAudio('hit'); // Âm thanh đổi súng giả
    }
    if (p.weaponSwitchTime < 1.0) p.weaponSwitchTime += dt * 4.0; // Rút súng nhanh trong 0.25s

    p.recoil *= 0.8;
    if (!STATE.hasRedKey) {
        if (STATE.keys['Digit1']) p.weaponIdx = 0;
        if (STATE.keys['Digit2']) p.weaponIdx = 1;
        if (STATE.keys['Digit3']) p.weaponIdx = 2;
    }
    if (!STATE.hasRedKey && STATE.keys['KeyR'] && weapon.ammo < weapon.maxAmmo && !p.isReloading) {
        let needed = weapon.maxAmmo - weapon.ammo;
        if (weapon.res > 0) {
            p.isReloading = true; p.reloadTimer = 2.0;
            playAudio('reload');
            // Thêm hiệu ứng tia sáng lúc nạp đạn
            spawnParticles(V3.add(p.pos, V3.create(0, 0.8, 0)), 5, [0.2, 0.8, 1.0], 1.5, 'smoke');
            const rd = document.getElementById('ammo-current');
            if (rd) { rd.style.color = '#ff4444'; rd.style.animation = 'pulse 0.3s ease-in-out infinite'; rd.style.transform = 'scale(1.15)'; }
        }
    }
    // Tự động nạp khi hết đạn
    if (weapon.ammo <= 0 && weapon.res > 0 && !p.isReloading) {
        p.isReloading = true; p.reloadTimer = 2.0;
        playAudio('reload');
        spawnParticles(V3.add(p.pos, V3.create(0, 0.8, 0)), 5, [0.2, 0.8, 1.0], 1.5, 'smoke');
        const rd = document.getElementById('ammo-current');
        if (rd) { rd.style.color = '#ff4444'; rd.style.animation = 'pulse 0.3s ease-in-out infinite'; rd.style.transform = 'scale(1.15)'; }
    }
    // Đếm nghiều nạp
    if (p.isReloading) {
        p.reloadTimer = (p.reloadTimer || 2.0) - dt;
        const wn = document.getElementById('weapon-name');
        if (wn) wn.innerText = 'NẠP ĐẠN... ' + Math.ceil(Math.max(0, p.reloadTimer)) + 's';
        if (p.reloadTimer <= 0) {
            p.isReloading = false;
            let needed = weapon.maxAmmo - weapon.ammo;
            if (weapon.res >= needed) { weapon.res -= needed; weapon.ammo = weapon.maxAmmo; }
            else { weapon.ammo += weapon.res; weapon.res = 0; }

            // Hiệu ứng hoàn thành nạp đạn: Tia sáng xanh + camera shake nhẹ
            spawnParticles(V3.add(p.pos, V3.create(0, 1.0, 0)), 8, [0.0, 1.0, 0.2], 0.8, 'smoke');
            STATE.shake += 0.3;
            playAudio('hit'); // Âm thanh hoàn thành nạp

            const rd = document.getElementById('ammo-current');
            if (rd) {
                rd.style.color = '#00ff00';
                rd.style.animation = '';
                rd.style.transform = 'scale(1.2)';
                // Highlight xanh lá kỉm 0.3s rồi trở lại
                setTimeout(() => {
                    if (rd) { rd.style.color = ''; rd.style.transform = ''; }
                }, 300);
            }
            const wn2 = document.getElementById('weapon-name');
            if (wn2) wn2.innerText = ['ASSAULT RIFLE', 'SMG', 'SNIPER'][p.weaponIdx] || '';
        }
    }
    STATE.projectiles.forEach((proj, i) => {
        const speed = proj.speed || (proj.isBoss ? 40 : window.GAME_CONFIG.misc.playerProjectileSpeed);
        const step = V3.mul(proj.dir, speed * dt), nextPos = V3.add(proj.pos, step);

        // --- 1. VA CHẠM ĐỊA HÌNH & VẬT CẢN (Tường/Nhà/Xe) ---
        const floorY = getHeight(nextPos.x, nextPos.z);
        if (nextPos.y <= floorY) {
            proj.dead = true;
            if (proj.isUlti) createExplosion(nextPos, window.GAME_CONFIG.ultimate.explosionRange, window.GAME_CONFIG.ultimate.damage, true, true);
            return;
        }
        for (let obs of STATE.obstacles) {
            const dx = nextPos.x - obs.pos.x, dz = nextPos.z - obs.pos.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < obs.radius * obs.radius) {
                const hLimit = (obs.type === 'house' ? 6 : (obs.type === 'car' ? 2 : 10));
                if (nextPos.y < obs.pos.y + hLimit) {
                    proj.dead = true;
                    if (proj.isUlti) createExplosion(nextPos, window.GAME_CONFIG.ultimate.explosionRange, window.GAME_CONFIG.ultimate.damage, true, true);
                    return;
                }
            }
        }

        // --- 2. VA CHẠM THÙNG NỔ ---
        STATE.barrels.forEach(b => {
            if (b.hp > 0 && V3.dist(nextPos, V3.add(b.pos, V3.create(0, 0.8, 0))) < 4.0) {
                b.hp -= proj.dmg; playPositionalAudio('hit', nextPos); showHitMarker(); spawnParticles(nextPos, 5, [1, 0.5, 0]);
                proj.dead = true;
                if (b.hp <= 0) createExplosion(b.pos);
            }
        });

        // Bỏ qua va chạm gây dame với quái/boss nếu game quá lag (hệ số hiệu năng < 0.15) để giải phóng CPU
        const canDealDamage = (STATE.performanceMultiplier === undefined || STATE.performanceMultiplier >= 0.15);
        if (proj.isPlayer && !proj.dead && canDealDamage) {
            // --- 3. VA CHẠM QUÁI (BOT) ---
            STATE.bots.forEach(bot => {
                if (proj.dead || bot.hp <= 0 || bot.isEvolvingLv2 || bot.isEvolvingLv3) return;

                const dy = nextPos.y - bot.pos.y;
                const dx = nextPos.x - bot.pos.x, dz = nextPos.z - bot.pos.z;
                const distXZ = Math.sqrt(dx * dx + dz * dz);

                // Hitbox theo cấp độ (thực tế hơn)
                let hitboxScale = 1.0;
                if (bot.isFinal) hitboxScale = 1.8;       // Lv3: to nhưng không quá ưu tiên
                else if (bot.isHorror) hitboxScale = 1.3; // Lv2

                // Tăng hitbox radius để fix máy yếu không dính damage
                const hitRadius = (isMobile ? 1.8 : 1.2) * hitboxScale; // Tăng từ 0.7 lên 1.2 cho máy chậm
                const hitHeight = 1.8 * hitboxScale;     // Chiều cao cơ thể
                const headY = 1.5 * hitboxScale;      // Phần đầu: chỉ từ 1.5m trở lên

                // Mở rộng collision detection cho máy yếu: dùng 1.3x radius để kiểm tra
                if (distXZ < hitRadius * 1.3 && dy > -0.3 && dy < hitHeight) {
                    let dmg = proj.dmg;
                    // Headshot CHỈ tính khi đạn rõ ràng trúng vùng đầu
                    const isHead = (dy > headY && distXZ < hitRadius * 0.6);

                    if (isHead) {
                        dmg = Math.round(proj.dmg * 1.5);
                        spawnHeadshotEffect(nextPos); // Phase 3: Enhanced headshot VFX
                        if (window.QuestManager) window.QuestManager.onEvent('headshot', 1);
                    } else {
                        spawnBloodSplatter(nextPos, isMobile ? 10 : 18); // Phase 3: Blood splatter
                    }

                    bot.hp -= dmg;
                    spawnDamageNumber(nextPos, dmg, isHead);
                    if (!proj.isUlti) {
                        STATE.player.damageDealt += dmg;
                        if (window.QuestManager) window.QuestManager.onEvent('damage', dmg);
                    }
                    playPositionalAudio('hit', nextPos);
                    showHitMarker();
                    proj.dead = true; // Dánh dấu ngay để khỏng chế frame tiếp
                }
            });

            // --- 4. VA CHẠM BOSS --- (Chỉ xét khi đạn chưa chết)
            if (!proj.dead && STATE.boss && STATE.boss.active) {
                const b = STATE.boss;
                const dx = nextPos.x - b.pos.x, dz = nextPos.z - b.pos.z, dy = nextPos.y - b.pos.y;
                const distXZ = Math.sqrt(dx * dx + dz * dz);

                // Kiểm tra hitbox: Đầu TƯỚC TIÊN (nhỏ hơn, chaứa trong vùng thân)
                const headDist = V3.dist(nextPos, { x: b.pos.x, y: b.pos.y + 19, z: b.pos.z });
                const isHeadshot = headDist < 2.5;
                // Thân: chỉ tính nếu KHÔNG phải headshot
                const isBodyHit = !isHeadshot && distXZ < 4.5 && dy > -1 && dy < 17;

                if (isHeadshot || isBodyHit) {
                    let finalDmg = proj.dmg; // Đảm bảo là số nguyên (round)
                    if (isHeadshot) {
                        finalDmg = Math.round(proj.dmg * 1.5);
                        if (window.QuestManager) window.QuestManager.onEvent('headshot', 1);
                    }
                    b.hp -= finalDmg;
                    spawnDamageNumber(nextPos, finalDmg, isHeadshot);

                    if (!proj.isUlti) STATE.player.damageDealt += finalDmg;
                    proj.dead = true; playPositionalAudio('hit', nextPos); showHitMarker();
                    if (proj.isUlti) { STATE.shake = 10.0; b.flinchTime = 0.6; }
                    if (b.hp <= 0 && !b.dead) killBoss();
                }
            }
        }
        else {
            // Đạn địch trúng người chơi
            if (V3.dist(nextPos, V3.add(p.pos, V3.create(0, 1, 0))) < 1.5) {
                takeDamage(p, proj.dmg);
                showDamageDirection(proj.pos);
                proj.dead = true;
            }
        }

        if (proj.dead && proj.isUlti) {
            createExplosion(proj.pos, window.GAME_CONFIG.ultimate.explosionRange, window.GAME_CONFIG.ultimate.damage, true, true);
        }
        proj.pos = nextPos; proj.life -= dt; if (proj.life < 0) proj.dead = true;
    });
    STATE.projectiles = STATE.projectiles.filter(p => !p.dead);
    STATE.bots.forEach((bot, i) => {
        if (bot.hp <= 0) return; bot.fireCD -= dt; const dist = V3.dist(bot.pos, p.pos);

        // [PHASE 9] Tiếng gầm rú kinh dị ngẫu nhiên từ quái vật xung quanh
        if (Math.random() < 0.0003) {
            playPositionalAudio('roar', bot.pos);
        }

        // --- VA CHẠM GIỮA CÁC BOT (Tránh dính chùm) ---
        for (let j = i + 1; j < STATE.bots.length; j++) {
            const b2 = STATE.bots[j];
            if (b2.hp <= 0) continue;
            const dx = bot.pos.x - b2.pos.x, dz = bot.pos.z - b2.pos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < 5) { // Khoảng cách va chạm ~2.2m
                const d = Math.sqrt(dSq) || 0.1, push = (2.2 - d) * 0.5;
                bot.pos.x += (dx / d) * push; bot.pos.z += (dz / d) * push;
                b2.pos.x -= (dx / d) * push; b2.pos.z -= (dz / d) * push;
            }
        }

        // --- 3 GIAI ĐOẠN TIẾN HÓA CỦA BOT ---
        const botCount = STATE.bots.length;
        const initialCount = STATE.config.botCount || 25;
        const enragePct = window.GAME_CONFIG.bot.enrageLv2Pct || 0.40;
        const lv3Count = window.GAME_CONFIG.bot.lv3Count || 5;
        const isEnragedLv2 = botCount <= initialCount * enragePct; // Cuồng bạo theo độ khó
        const isEnragedLv3 = botCount <= lv3Count;                  // Lv3 count theo độ khó

        // [MỚI] Tăng máu khi tiến hóa + CƠ CHẾ BẤT TỬ
        if (isEnragedLv2 && !bot.hasEvolvedLv2) {
            bot.hasEvolvedLv2 = true;
            bot.hp += (window.GAME_CONFIG.bot.hpLv2 - window.GAME_CONFIG.bot.hpLv1);
            bot.isEvolvingLv2 = true;
            bot.evolveTimer = 1.2; // Bất tử 1.2 giây khi lên Lv2
            playAudio('hit');
        }
        if (isEnragedLv3 && !bot.hasEvolvedLv3) {
            bot.hasEvolvedLv3 = true;
            bot.hp = window.GAME_CONFIG.bot.hpLv3; // Hồi đầy máu Lv3
            bot.isEvolvingLv3 = true;
            bot.evolveTimer = window.GAME_CONFIG.bot.evolveTime;
            playAudio('hit');
        }

        bot.isHorror = isEnragedLv2 || isEnragedLv3;
        bot.isFinal = isEnragedLv3; // Cờ cho Lv3

        if (bot.isEvolvingLv2 || bot.isEvolvingLv3) {
            bot.evolveTimer -= dt;
            const color = bot.isEvolvingLv3 ? [1.0, 0.2, 0.2] : [1.0, 1.0, 0.0];
            if (Math.random() < 0.4) {
                spawnParticles(V3.add(bot.pos, V3.create((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)), 2, color);
            }
            if (bot.evolveTimer <= 0) {
                if (bot.isEvolvingLv3) {
                    spawnParticles(bot.pos, 50, [1.0, 0.0, 0.0]);
                    STATE.shake = 3.0;
                    playAudio('shoot');
                }
                bot.isEvolvingLv2 = false;
                bot.isEvolvingLv3 = false;
            }
        } else if ((isEnragedLv2 || isEnragedLv3 || dist < window.GAME_CONFIG.bot.detectRadius) && !(p.standUpTimer > 0)) {
            const dir = V3.norm(V3.sub(p.pos, bot.pos));
            // TỐC ĐỘ: Tinh chỉnh theo từng cấp độ
            const speed = isEnragedLv3 ? window.GAME_CONFIG.bot.speedLv3 : (isEnragedLv2 ? window.GAME_CONFIG.bot.speedLv2 : window.GAME_CONFIG.bot.speedLv1);
            const dist2D = Math.sqrt(Math.pow(p.pos.x - bot.pos.x, 2) + Math.pow(p.pos.z - bot.pos.z, 2));
            if (dist2D > 1.5) {
                // Tốc độ di chuyển giảm dần khi game lag (STATE.performanceMultiplier)
                const pMult = (STATE.performanceMultiplier !== undefined ? STATE.performanceMultiplier : 1.0);
                bot.pos.x += dir.x * speed * dt * pMult;
                bot.pos.z += dir.z * speed * dt * pMult;
            }
            // Quái không tấn công/gây dame nếu game quá lag (hệ số hiệu năng < 0.15)
            const canAttack = (STATE.performanceMultiplier === undefined || STATE.performanceMultiplier >= 0.15);
            if (dist2D < window.GAME_CONFIG.bot.attackRange && Math.abs(p.pos.y - bot.pos.y) < 3.0 && bot.fireCD <= 0 && canAttack) {
                // Sát thương: Lv1=10, Lv2=30, Lv3=60
                let damage = window.GAME_CONFIG.bot.baseDamage;
                let attackColor = [1.0, 0.3, 0.0]; // Orange default
                if (isEnragedLv3) {
                    damage = window.GAME_CONFIG.bot.enragedDamageLv3;
                    attackColor = [1.0, 0.0, 0.0]; // Red for Lv3
                } else if (isEnragedLv2) {
                    damage = window.GAME_CONFIG.bot.enragedDamageLv2;
                    attackColor = [1.0, 0.6, 0.0]; // Orange-red for Lv2
                }

                if (p && bot) {
                    takeDamage(p, damage);
                    showDamageDirection(bot.pos);
                    playAudio('hit');

                    // Hiệu ứng bot tấn công: Chỉ sinh hạt khi chất lượng đồ họa không ở mức Tối thiểu và không quá lag
                    const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
                    if (vfx !== 'low' && bot.pos) {
                        spawnParticles(V3.add(bot.pos, V3.create(0, 1.0, 0)), 8, attackColor, 1.2, 'smoke');
                        STATE.shake = Math.min(1.0, STATE.shake + 0.4);
                    }
                }

                bot.fireCD = window.GAME_CONFIG.bot.attackCD;
            }

            // AI Nhảy: Nếu bị kẹt ở xe/nhà nhưng người chơi ở trên cao
            if (dist2D < 3.5 && p.pos.y > bot.pos.y + 1.5 && bot.grounded) {
                bot.velY = 16;
                bot.grounded = false;
            }
        }
        else {
            bot.nextMove -= dt;
            if (bot.nextMove <= 0) {
                bot.targetDir = V3.create(Math.random() - 0.5, 0, Math.random() - 0.5);
                bot.nextMove = 2 + Math.random() * 3;
            }
            if (bot.targetDir) {
                const pMult = (STATE.performanceMultiplier !== undefined ? STATE.performanceMultiplier : 1.0);
                bot.pos.x += bot.targetDir.x * 3 * dt * pMult;
                bot.pos.z += bot.targetDir.z * 3 * dt * pMult;
            }
        }

        // [YÊU CẦU] Giới hạn bot không ra khỏi đảo (Bán kính 190m)
        const dFromCenterSq = bot.pos.x * bot.pos.x + bot.pos.z * bot.pos.z;
        if (dFromCenterSq > 190 * 190) {
            const dFromCenter = Math.sqrt(dFromCenterSq);
            const push = (dFromCenter - 190) / dFromCenter;
            bot.pos.x -= bot.pos.x * push;
            bot.pos.z -= bot.pos.z * push;
            bot.targetDir = null; // Đổi hướng khi đụng biên đảo
        }

        // Vật lý và Va chạm cho Bot
        for (let obs of STATE.obstacles) {
            if ((obs.type === 'car' && bot.pos.y > obs.pos.y + 1.2) ||
                (obs.type === 'house' && bot.pos.y > obs.pos.y + 3.0)) continue;
            let dx = bot.pos.x - obs.pos.x;
            let dz = bot.pos.z - obs.pos.z;
            let distSq = dx * dx + dz * dz;
            let rSq = obs.radius * obs.radius;
            if (distSq < rSq) {
                let dist = Math.sqrt(distSq);
                if (dist === 0) { dx = 1; dist = 1; }
                let pushAmt = obs.radius - dist;
                bot.pos.x += (dx / dist) * pushAmt;
                bot.pos.z += (dz / dist) * pushAmt;
            }
        }

        bot.velY = bot.velY || 0;
        bot.velY -= 25 * dt;
        bot.pos.y += bot.velY * dt;

        let bFloor = getHeight(bot.pos.x, bot.pos.z);
        for (let obs of STATE.obstacles) {
            let dx = bot.pos.x - obs.pos.x;
            let dz = bot.pos.z - obs.pos.z;
            // Tương tự, chỉ tính nóc xe/nhà là mặt sàn nếu bot đã thực sự bật nhảy vượt qua chiều cao đó
            if (dx * dx + dz * dz <= obs.radius * obs.radius) {
                if (obs.type === 'car' && bot.pos.y >= obs.pos.y + 1.0) bFloor = Math.max(bFloor, obs.pos.y + 1.7);
                if (obs.type === 'house' && bot.pos.y >= bot.pos.y + 3.0) bFloor = Math.max(bFloor, obs.pos.y + 4.5);
            }
        }

        if (bot.pos.y < bFloor) {
            bot.pos.y = bFloor;
            bot.velY = 0;
            bot.grounded = true;
        } else {
            bot.grounded = false;
        }
    });
    STATE.bots = STATE.bots.filter(b => {
        if (b.hp <= 0) {
            if (b.uiBar && b.uiBar.parentNode) {
                b.uiBar.parentNode.removeChild(b.uiBar);
            }
            return false;
        }
        return true;
    });
    // Tự động kích hoạt Boss CHỈ khi diệt sạch bot
    if (prevCount > 0 && STATE.bots.length === 0 && !STATE.bossTriggered) {
        triggerBossEvent();
    }
    STATE.barrels = STATE.barrels.filter(b => b.hp > 0);

    if (STATE.bots.length < prevCount) {
        const killsMade = prevCount - STATE.bots.length;
        p.kills += killsMade;
        if (window.QuestManager) {
            window.QuestManager.onEvent('kill', killsMade);
        }
        const n = performance.now(); if (n - p.lastKillTime < 5000) p.streak += killsMade; else p.streak = killsMade; p.lastKillTime = n;

        const feed = document.getElementById('kill-feed'); feed.innerHTML += `<div>Enemy eliminated</div>`; setTimeout(() => feed.removeChild(feed.firstChild), 3000);
        spawnParticles(p.pos, 20, [Math.random(), Math.random(), Math.random()]);
    }
    let closeLoot = null; STATE.loot.forEach(l => { if (V3.dist(p.pos, l.pos) < 2) closeLoot = l; });
    const msg = document.getElementById('interaction-msg');
    if (!nearQuestItem && !nearFinalPaper && !nearRedDoor && !nearRedDoorWithoutKey) {
        msg.style.display = 'none';
    }

    // Cập nhật hạt (Particles)
    STATE.particles.forEach(p => {
        if (!p.active) return;
        p.pos.x += p.vel.x * dt; p.pos.y += p.vel.y * dt; p.pos.z += p.vel.z * dt;
        if (p.type === 'smoke') {
            p.vel.y += 2 * dt; // Khói bay lên nhẹ hơn vì vel ban đầu đã cao
            p.vel.x *= 0.95; p.vel.z *= 0.95;
        } else {
            p.vel.y -= 35 * dt; // Trọng lực mạnh hơn cho lửa/máu
            p.vel.x *= 0.98; p.vel.z *= 0.98;
        }
        p.life -= dt;
        if (p.life <= 0) p.active = false;
    });

    // [CẢI TIẾN] Hiệu ứng tàn lửa rơi (Hellfire) khi đánh Boss
    if (STATE.boss && STATE.boss.active && Math.random() < 0.2) {
        const spawnPos = {
            x: p.pos.x + (Math.random() - 0.5) * 100,
            y: p.pos.y + 50 + Math.random() * 20,
            z: p.pos.z + (Math.random() - 0.5) * 100
        };
        spawnParticles(spawnPos, 1, [0.5 + Math.random() * 0.5, 0, 0], 0.2, 'smoke');
    }

    if (closeLoot) {
        let pickedName = "";
        if (closeLoot.type === 0) { STATE.weapons[p.weaponIdx].res += 30; pickedName = "NHẬN ĐẠN"; }
        else if (closeLoot.type === 1) {
            p.hp = Math.min(p.maxHp, p.hp + 200);
            p.damageFlash = 0;
            pickedName = "HỒI MÁU";
            if (window.QuestManager) window.QuestManager.onEvent('heal', 200);
        }
        else if (closeLoot.type === 2) { p.armor = Math.min(p.maxArmor, p.armor + 150); pickedName = "NHẬN GIÁP"; }
        else if (closeLoot.type === 3) {
            const puType = Math.random() < 0.5 ? 0 : 1;
            const hasActive = p.powerup && p.powerup.time > 0;
            if (window.QuestManager) window.QuestManager.onEvent('pickup_powerup', 1);

            if (hasActive && p.powerup.type !== puType && p.powerup.type !== 3) {
                // Đang có 1 cái khác loại -> Lên SIÊU CẤP (3)
                p.powerup = { type: 3, time: 20 };
                pickedName = "🔥 SIÊU CẤP (TỐC + X2) 🔥";
            } else if (hasActive && p.powerup.type === 3) {
                // Đang SIÊU CẤP -> Reset 20s
                p.powerup.time = 20;
                pickedName = "LÀM MỚI SIÊU CẤP!";
            } else {
                // Nhặt bình thường hoặc nhặt cùng loại -> Reset 15s
                p.powerup = { type: puType, time: 15 };
                pickedName = puType === 0 ? "⚡ TĂNG TỐC!" : "🔥 X2 SÁT THƯƠNG!";
            }

            // Khi nhặt được powerup Tốc Độ hoặc Siêu Cấp → Hồi đầy thể lực ngay lập tức
            if (p.powerup.type === 0 || p.powerup.type === 3) {
                p.stamina = p.maxStamina || 100;
                p.exhausted = false;
            }
        }

        const pMsg = document.getElementById('pickup-msg');
        let pColor = "#00ffaa";
        if (closeLoot.type === 0) pColor = "#ffcc00"; // Đạn - Vàng
        if (closeLoot.type === 1) pColor = "#ff3366"; // Máu - Hồng/Đỏ
        if (closeLoot.type === 2) pColor = "#00d4ff"; // Giáp - Xanh dương
        if (closeLoot.type === 3) {
            if (p.powerup.type === 3) pColor = "#bf00ff"; // Tím SIÊU CẤP
            else pColor = pickedName.includes("TỐC") ? "#00ffff" : "#ff6600";
        }

        pMsg.innerText = pickedName;
        pMsg.style.borderColor = pColor;
        pMsg.style.color = pColor;
        pMsg.style.boxShadow = `0 0 25px ${pColor}44`;
        pMsg.classList.add('show');

        // Reset animation
        clearTimeout(window.pickupTimer);
        window.pickupTimer = setTimeout(() => {
            if (pMsg) pMsg.classList.remove('show');
        }, 1500);

        // Hồi lại hòm sau 20s
        const respawnPos = { ...closeLoot.pos }, respawnType = closeLoot.type;
        setTimeout(() => {
            STATE.loot.push({ pos: respawnPos, type: respawnType });
        }, 20000);

        // Premium animation: Splash tàn lửa/hạt khói dạ quang màu tương ứng khi nhặt hòm
        let particleColor = [1.0, 0.8, 0.0]; // Mặc định Vàng cho Đạn
        if (closeLoot.type === 1) particleColor = [1.0, 0.2, 0.2]; // Hồng/Đỏ cho Máu
        else if (closeLoot.type === 2) particleColor = [0.0, 0.8, 1.0]; // Xanh dương cho Giáp
        else if (closeLoot.type === 3) particleColor = [0.8, 0.0, 1.0]; // Tím cho Powerup
        spawnParticles(closeLoot.pos, 35, particleColor, 3.5, 'fire');

        STATE.loot = STATE.loot.filter(l => l !== closeLoot);
        playAudio('pickup');
    }

    // Đã xóa vòng lặp nhặt STATE.powerups

    const puOverlay = document.getElementById('powerup-overlay');
    if (p.powerup && p.powerup.time > 0) {
        p.powerup.time -= dt;
        let color = "0, 255, 255"; // Mặc định Cyan
        if (p.powerup.type === 1) color = "255, 102, 0"; // Cam
        if (p.powerup.type === 3) {
            color = "191, 0, 255"; // Tím Siêu Cấp
            if (window.QuestManager) window.QuestManager.onEvent('purple_time', dt);
        }

        if (puOverlay) {
            puOverlay.style.boxShadow = `inset 0 0 200px rgba(${color}, 0.6), inset 0 0 50px rgba(${color}, 0.4)`;
            puOverlay.classList.add('active');
        }
    } else if (p.powerup) {
        p.powerup.type = null;
        if (puOverlay) {
            puOverlay.classList.remove('active');
            puOverlay.style.boxShadow = 'none';
        }
    }
    if (p.streak >= 3) document.getElementById('damage-overlay').style.boxShadow = `inset 0 0 100px rgba(255, 204, 0, 0.2)`;

    // Boss AI Logic
    if (STATE.boss && STATE.boss.active) {

        const b = STATE.boss;
        if (b.state === 'dying') {
            b.deathTimer -= dt;
            // Giai đoạn 1: Quỳ gối (3.5s -> 2.0s)
            if (b.deathTimer > 2.0) {
                b.bodyY += (-8.0 - b.bodyY) * 4 * dt;
                b.bodyRot += (0.8 - b.bodyRot) * 4 * dt;
                b.armLift += (-1.5 - b.armLift) * 4 * dt;
                STATE.shake = Math.max(STATE.shake, 0.5);
                if (Math.random() < 0.2) {
                    spawnParticles(b.pos, 5, [0.3, 0.25, 0.2], 1.2, 'smoke');
                }
            }
            // Giai đoạn 2: Quá tải giật mạnh & tàn lửa (2.0s -> 0.0s)
            else if (b.deathTimer > 0.0) {
                b.bodyRot = 0.8 + (Math.random() - 0.5) * 0.15;
                b.bodyY = -8.0 + (Math.random() - 0.5) * 0.2;
                b.armLift = -1.5 + (Math.random() - 0.5) * 0.2;
                STATE.shake = Math.max(STATE.shake, 1.2);
                if (Math.random() < 0.6) {
                    const color = Math.random() > 0.5 ? [1.0, 0.05, 0.05] : [1.0, 0.5, 0.0];
                    spawnParticles(V3.add(b.pos, V3.create(0, 10, 0)), 4, color, 2.5, 'fire');
                }
            }
            // Giai đoạn 3: Thực sự kết liễu
            else {
                finishKillBoss();
            }
            return;
        }

        const dist = V3.dist(b.pos, p.pos);
        b.skillCD -= dt;

        // --- HỒI PHỤC ANIMATION (Smoothing back to idle) ---
        if (b.state === 'fight' || b.state === 'idle') {
            b.armLift += (0 - b.armLift) * 5 * dt;
            b.bodyY += (0 - b.bodyY) * 5 * dt;
            b.bodyRot += (0 - b.bodyRot) * 5 * dt;
        }

        if (b.flinchTime > 0) {
            b.flinchTime -= dt;
            // Hiệu ứng rung nhẹ khi bị flinch
            b.bodyRot = (Math.random() - 0.5) * 0.15;
            b.bodyY = (Math.random() - 0.5) * 0.2;
            return; // Đứng yên khi bị giật
        }

        if (b.state === 'fight') {
            if (b.skillCD <= 0) {
                // --- DANH SÁCH CHIÊU THỨC --- 
                if (!b.skillSequence) {
                    let availableSkills = [
                        'chiêu 3', // Nhảy dậm (Slam)
                        'chiêu 1', // Lướt (Dash)
                        'chiêu 2', // Đại bác (Triple Shot)
                        'chiêu 4', // Cột máu (Crimson Pillars)
                        'chiêu 5', // Dịch chuyển (Teleport Strike)
                    ];
                    for (let i = availableSkills.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [availableSkills[i], availableSkills[j]] = [availableSkills[j], availableSkills[i]];
                    }
                    b.skillSequence = availableSkills;
                }
                const skill = b.skillSequence[b.skillIndex % b.skillSequence.length];
                b.skillIndex++;

                if (skill === 'chiêu 5') {
                    // [CHỈNH SỬA CHIÊU 5] Thời gian Boss "chìm" xuống (rặn chiêu)
                    b.state = 'teleport_start'; b.skillCD = window.GAME_CONFIG.boss.skill5.prepareTime;
                    spawnParticles(b.pos, 60, [0.8, 0, 0], 3.0, 'smoke'); // Hiệu ứng biến mất rực rỡ hơn
                    playPositionalAudio('boss_warning', b.pos);
                } else if (skill === 'chiêu 4') {
                    // [CHỈNH SỬA CHIÊU 4] Thời gian Boss gồng tay (hiện vòng cảnh báo)
                    b.state = 'pillar_prepare'; b.skillCD = window.GAME_CONFIG.boss.skill4.prepareTime; b.pillarSpots = [];
                    b.shotCount = 0;
                    playPositionalAudio('boss_warning', b.pos);
                } else if (skill === 'chiêu 3') {
                    // [CHỈNH SỬA CHIÊU 3] Thời gian Boss rặn trước khi nhảy
                    b.state = 'jump_start'; b.skillCD = window.GAME_CONFIG.boss.skill3.prepareTime;
                    spawnParticles(b.pos, 40, [1, 0.4, 0], 2.5, 'fire'); // Hiệu ứng lấy đà mạnh mẽ
                    const tx = p.pos.x, tz = p.pos.z;
                    b.targetPos = V3.create(tx, getHeight(tx, tz), tz);
                    if (b.indicatorMesh) deleteMesh(b.indicatorMesh);
                    // Đồng bộ bán kính 30 với tầm sát thương
                    b.indicatorMeshParams = { x: b.targetPos.x, z: b.targetPos.z, r: window.GAME_CONFIG.boss.skill3.range };
                    b.indicatorMesh = genTerrainFollowMesh(b.indicatorMeshParams.x, b.indicatorMeshParams.z, b.indicatorMeshParams.r);
                    playPositionalAudio('boss_warning', b.pos);
                } else if (skill === 'chiêu 1') {
                    // [CHỈNH SỬA CHIÊU 1] Thời gian rặn trước khi lướt
                    b.state = 'dash_prepare'; b.skillCD = window.GAME_CONFIG.boss.skill1.prepareTime;
                    b.targetDir = V3.norm(V3.sub(p.pos, b.pos));
                    b.targetAng = Math.atan2(b.targetDir.x, b.targetDir.z);
                    if (b.dashMesh) deleteMesh(b.dashMesh);
                    // Rộng hơn (8) và Dài hơn (150)
                    b.dashMeshParams = { x: b.pos.x, z: b.pos.z, ang: b.targetAng, w: window.GAME_CONFIG.boss.skill1.width, l: 150 };
                    b.dashMesh = genTerrainDashMesh(b.dashMeshParams.x, b.dashMeshParams.z, b.dashMeshParams.ang, b.dashMeshParams.w, b.dashMeshParams.l);
                    playPositionalAudio('boss_warning', b.pos);
                } else if (skill === 'chiêu 2') {
                    // [CHỈNH SỬA CHIÊU 2] Thời gian rặn trước khi bắn
                    b.state = 'shoot_prepare'; b.skillCD = window.GAME_CONFIG.boss.skill2.prepareTime;
                    playPositionalAudio('boss_warning', b.pos);
                }
            } else {
                const isRage = b.hp < b.maxHp * 0.4;
                const speed = isRage ? 15 : window.GAME_CONFIG.bot.speedLv1; // Sử dụng tốc độ cấp 1 cho Boss lúc thường

                const dir = V3.norm(V3.sub(p.pos, b.pos));
                b.pos.x += dir.x * speed * dt; b.pos.z += dir.z * speed * dt;
                b.pos.y = getHeight(b.pos.x, b.pos.z);

                // Animation đi bộ mượt mà (Sway body & arms)
                const walkCycle = Math.sin(performance.now() * 0.006) * 0.15;
                b.bodyRot += (walkCycle - b.bodyRot) * 0.1;
                b.armLift += (walkCycle * 2 - b.armLift) * 0.1;

                if (isRage && Math.random() < 0.2) spawnParticles(b.pos, 2, [1, 0, 0]);
                // Subtle Dark Aura particles for Boss - More frequent
                if (Math.random() < 0.3) {
                    spawnParticles(V3.add(b.pos, V3.create((Math.random() - 0.5) * 8, Math.random() * 15, (Math.random() - 0.5) * 8)), 3, [0.1, 0, 0], 0.8, 'smoke');
                }
            }
            // Xoay mặt mượt mà về phía người chơi
            const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z;
            b.targetAng = Math.atan2(dx, dz);
            let diff = b.targetAng - b.rotY;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            b.rotY += diff * 0.3; // Tăng tốc độ quay mặt (từ 0.1 lên 0.3)

        } else if (b.state === 'jump_start') {
            b.bodyRot += (0.4 - b.bodyRot) * 0.1; // Cúi người lấy đà hơi hơi thôi
            b.armLift += (1.4 - b.armLift) * 0.1; // Vung 2 tay ra sau lấy đà (POSITIVE là ra sau)
            if (b.skillCD <= 0) {
                const gravity = window.GAME_CONFIG.boss.skill3.gravity;
                b.state = 'jumping';
                const v0y = window.GAME_CONFIG.boss.skill3.jumpPower;
                b.vel.y = v0y;
                const dy = b.pos.y - b.targetPos.y;
                const airTime = (v0y + Math.sqrt(v0y * v0y + 2 * gravity * dy)) / gravity;
                b.vel.x = (b.targetPos.x - b.pos.x) / airTime;
                b.vel.z = (b.targetPos.z - b.pos.z) / airTime;
                b.armLift = -1.2; // Nhảy lên giơ 2 tay ra phía trước (NEGATIVE là ra trước)
                b.bodyRot = 0.2; // Bay người thẳng, hơi đổ tới xíu
            }
        } else if (b.state === 'jumping') {
            b.armLift = -1.2;
            b.bodyRot = 0.2;
            b.vel.y -= window.GAME_CONFIG.boss.skill3.gravity * dt; b.pos.x += b.vel.x * dt; b.pos.z += b.vel.z * dt; b.pos.y += b.vel.y * dt;
            if (b.pos.y <= getHeight(b.pos.x, b.pos.z)) {
                b.pos.y = getHeight(b.pos.x, b.pos.z);
                b.state = 'recover'; b.skillCD = 0.5;
                b.bodyRot = 0.6; b.armLift = -0.2; // Chạm đất tay chống đất phía trước (-0.2), người hơi cúi (0.6)
                const dmgDist = window.GAME_CONFIG.boss.skill3.range;
                const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
                if (Math.sqrt(dx * dx + dz * dz) < dmgDist) {
                    takeDamage(p, window.GAME_CONFIG.boss.skill3.damage);
                    showDamageDirection(b.pos);
                    STATE.shake = 5.0;
                }
                spawnParticles(b.pos, isMobile ? 50 : 400, [1, 0, 0], 2.5);
                spawnParticles(b.pos, isMobile ? 30 : 200, [0.2, 0.2, 0.2], 1.5, 'smoke'); // Thêm khói đen
                spawnParticles(b.pos, isMobile ? 20 : 150, [1, 0.5, 0], 3.0, 'fire');   // Thêm tia lửa
                STATE.shake = 15.0; // Tăng rung
            }
        } else if (b.state === 'recover') {
            b.bodyRot += (0.6 - b.bodyRot) * 0.2;
            b.armLift += (-0.2 - b.armLift) * 0.2;
            if (b.skillCD <= 0) {
                b.state = 'fight';
                b.skillCD = 1.0;
            }
        } else if (b.state === 'dash_prepare') {
            const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z;
            b.targetAng = Math.atan2(dx, dz);
            b.bodyRot = 0;
            // Boss rung nhẹ trước khi lướt và xả khói
            b.pos.x += (Math.random() - 0.5) * 0.8;
            b.pos.z += (Math.random() - 0.5) * 0.8;
            if (Math.random() < 0.5) spawnParticles(b.pos, 5, [0.1, 0.1, 0.1], 1.0, 'smoke');
            if (b.skillCD <= 0) {
                b.state = 'dashing'; b.skillCD = 0.8;
                playAudio('shoot');
            }
        } else if (b.state === 'dashing') {
            const speed = window.GAME_CONFIG.boss.skill1.speed;
            b.pos.x += b.targetDir.x * speed * dt;
            b.pos.z += b.targetDir.z * speed * dt;
            b.pos.y = getHeight(b.pos.x, b.pos.z);
            if (!b.hasHit) {
                const dist = V3.dist(b.pos, p.pos);
                if (dist < window.GAME_CONFIG.boss.skill1.width) {
                    takeDamage(p, window.GAME_CONFIG.boss.skill1.damage);
                    showDamageDirection(b.pos);
                    STATE.shake = 8.0;
                    spawnParticles(p.pos, 30, [1, 0, 0], 2.0);
                    b.hasHit = true;
                }
            }
            // Trail effects during dash
            if (Math.random() < 0.8) spawnParticles(b.pos, 5, [1, 0, 0], 0.5);
            if (b.skillCD <= 0) {
                b.state = 'fight'; b.skillCD = window.GAME_CONFIG.boss.postSkillRest;
                if (b.dashMesh) { deleteMesh(b.dashMesh); b.dashMesh = null; }
            }
        } else if (b.state === 'pillar_prepare') {
            b.armLift += (2.5 - b.armLift) * 0.1;
            if (b.pillarSpots.length < window.GAME_CONFIG.boss.skill4.count) {
                let ok = false, tx, tz;
                for (let attempt = 0; attempt < 50; attempt++) {
                    const ang = Math.random() * Math.PI * 2;
                    const d = Math.random() * 70;
                    tx = p.pos.x + Math.sin(ang) * d;
                    tz = p.pos.z + Math.cos(ang) * d;
                    let tooClose = false;
                    for (let s of b.pillarSpots) if (Math.sqrt((tx - s.x) ** 2 + (tz - s.z) ** 2) < 18) tooClose = true;
                    if (!tooClose) { ok = true; break; }
                }
                if (ok) {
                    const mesh = genTerrainFollowMesh(tx, tz, window.GAME_CONFIG.boss.skill4.pillarRange);
                    // Dùng timer nhỏ ngẫu nhiên để các cột máu trồi lên liên tiếp thay vì cùng lúc
                    b.pillarSpots.push({ x: tx, z: tz, h: getHeight(tx, tz), active: false, hasHit: false, timer: Math.random() * 0.5, mesh: mesh });
                }
            }
            if (b.skillCD <= 0) {
                b.state = 'pillar_active';
                // Sử dụng pillarTimer làm thời gian tồn tại của cột máu
                b.skillCD = window.GAME_CONFIG.boss.skill4.pillarTimer;
                b.armLift = 0;
                b.bodyRot = 0.5;
            }
        } else if (b.state === 'pillar_active') {
            b.bodyRot += (0 - b.bodyRot) * 0.1;
            b.pillarSpots.forEach(s => {
                if (!s.active) {
                    s.timer -= dt;
                    if (s.timer <= 0) {
                        s.active = true;
                        spawnParticles({ x: s.x, y: s.h, z: s.z }, 50, [1, 0, 0], 1.5);
                        STATE.shake = 1.5;
                    }
                }
                if (s.active && !s.hasHit) {
                    const d = Math.sqrt((p.pos.x - s.x) ** 2 + (p.pos.z - s.z) ** 2);
                    if (d < window.GAME_CONFIG.boss.skill4.pillarRange) {
                        takeDamage(p, window.GAME_CONFIG.boss.skill4.damage);
                        showDamageDirection({ x: s.x, y: s.h, z: s.z });
                        s.hasHit = true;
                    }
                }
            });
            if (b.skillCD <= 0) {
                b.state = 'fight'; b.skillCD = window.GAME_CONFIG.boss.postSkillRest;
                b.pillarSpots.forEach(s => { if (s.mesh) deleteMesh(s.mesh); });
                b.pillarSpots = [];
            }
        } else if (b.state === 'teleport_start') {
            b.bodyY -= 15 * dt;
            b.armLift += (0 - b.armLift) * 0.1; // Chìm xuống đứng yên không giơ tay làm gì
            const totalPre = window.GAME_CONFIG.boss.skill5.prepareTime;
            // Dừng dí người chơi trước khi đập 1s (thay vì 0.5s) để người chơi có cơ hội né
            if (b.skillCD > 1.0) {
                b.targetPos = V3.create(p.pos.x, 0, p.pos.z);
                b.targetPos.y = getHeight(b.targetPos.x, b.targetPos.z);

                b.indicatorUpdateTimer = (b.indicatorUpdateTimer || 0) - dt;
                if (b.indicatorUpdateTimer <= 0) {
                    if (b.indicatorMesh) deleteMesh(b.indicatorMesh);
                    // Đồng bộ với tầm đánh Skill 5 (Dùng range động)
                    b.indicatorMeshParams = { x: b.targetPos.x, z: b.targetPos.z, r: window.GAME_CONFIG.boss.skill5.range };
                    b.indicatorMesh = genTerrainFollowMesh(b.indicatorMeshParams.x, b.indicatorMeshParams.z, b.indicatorMeshParams.r);
                    b.indicatorUpdateTimer = 0.1;
                }
            }
            if (b.skillCD <= 0) {
                // [YÊU CẦU] Dịch chuyển và quay mặt về phía người chơi
                b.state = 'teleport_strike';
                b.skillCD = window.GAME_CONFIG.boss.skill5.activeTime;
                if (b.targetPos) {
                    b.pos.x = b.targetPos.x; b.pos.z = b.targetPos.z; b.pos.y = b.targetPos.y;
                    // Quay mặt về phía người chơi ngay khi trồi lên
                    const toP = V3.norm(V3.sub(p.pos, b.pos));
                    b.rotY = Math.atan2(toP.x, toP.z);
                }
                b.bodyY = -25; b.bodyRot = 0; b.hasHit = false; // Chìm sâu hơn (-25)
                if (b.fanMesh) deleteMesh(b.fanMesh);
                const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z;
                // Đồng bộ r cho khớp với tầm đánh động
                b.fanMeshParams = { x: b.pos.x, z: b.pos.z, ang: Math.atan2(dx, dz) - 1.2, arc: 2.4, r: window.GAME_CONFIG.boss.skill5.range };
                b.fanMesh = genTerrainFanMesh(b.fanMeshParams.x, b.fanMeshParams.z, b.fanMeshParams.ang, b.fanMeshParams.arc, b.fanMeshParams.r);
            }
        } else if (b.state === 'teleport_strike') {
            // --- THỜI GIAN CHIÊU 5 (DYNAMIC THEO ĐỘ KHÓ) ---
            const holdDur = window.GAME_CONFIG.boss.skill5.holdTime;
            const riseDur = 0.4;
            const strikeDur = 0.4;
            const recoverDur = 0.5;

            const riseLimit = holdDur + strikeDur + recoverDur;
            const strikeLimit = strikeDur + recoverDur;
            const hitTime = recoverDur + strikeDur - 0.15; // Đập trúng sau 0.15s bắt đầu vung tay

            // 1. THỜI GIAN TRỒI LÊN
            if (b.skillCD > riseLimit) {
                b.bodyY += 60 * dt; if (b.bodyY > 0) b.bodyY = 0;
                b.armLift += (-1.8 - b.armLift) * 0.1; // Tay giơ cao chuẩn bị đập

                // 2. THỜI GIAN GỒNG CHỜ (Rặn chiêu - Đây là đoạn ng chơi chạy thoát)
            } else if (b.skillCD > strikeLimit) {
                b.armLift = -1.8;
                b.bodyY = 0;

                // 3. VUNG TAY ĐẬP XUỐNG & HỒI CHIÊU
            } else {
                if (b.skillCD > recoverDur) {
                    b.armLift += (-0.2 - b.armLift) * 0.4; // Tay phải đập thẳng xuống
                    b.bodyRot += (0.6 - b.bodyRot) * 0.2; // Hơi cúi người
                } else {
                    b.armLift += (0 - b.armLift) * 0.1; // Co tay lại sau khi đập
                }

                const toP = V3.norm(V3.sub(p.pos, b.pos));
                const bYaw = Math.atan2(toP.x, toP.z);
                const handX = b.pos.x + Math.sin(bYaw) * 15;
                const handZ = b.pos.z + Math.cos(bYaw) * 15;

                if (Math.random() < 0.7 && b.skillCD > recoverDur) {
                    spawnParticles({ x: handX, y: b.pos.y + 10, z: handZ }, 5, [1, 0, 0], 1.5);
                }

                // 4. THỜI ĐIỂM GÂY SÁT THƯƠNG
                if (b.skillCD < hitTime && !b.hasHit) {
                    // Hiệu ứng đất gãy, vỡ vụn tại vị trí tay đập
                    spawnParticles({ x: handX, y: getHeight(handX, handZ), z: handZ }, 150, [0.8, 0.4, 0.1], 3.0);
                    spawnParticles({ x: handX, y: getHeight(handX, handZ), z: handZ }, 200, [0.1, 0.1, 0.1], 2.5, 'smoke');
                    spawnParticles({ x: handX, y: getHeight(handX, handZ), z: handZ }, 100, [1.0, 0, 0], 2.0);
                    STATE.shake = 25;

                    const d = V3.dist(b.pos, p.pos);
                    const pAng = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
                    let diff = Math.abs(pAng - bYaw);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;

                    if (d < window.GAME_CONFIG.boss.skill5.range && diff < 1.2) {
                        takeDamage(p, window.GAME_CONFIG.boss.skill5.damage);
                        showDamageDirection(b.pos);
                        spawnParticles(p.pos, 50, [1, 0, 0], 2.0);
                        playAudio('hit');
                    }
                    b.hasHit = true;
                }
            }
            if (b.skillCD <= 0) {
                b.state = 'fight';
                // [QUAN TRỌNG] Thời gian Boss nghỉ (3s) sau cú đập Jump/Teleport
                b.skillCD = 3;
                if (b.indicatorMesh) gl.deleteVertexArray(b.indicatorMesh.vao); b.indicatorMesh = null;
                if (b.fanMesh) gl.deleteVertexArray(b.fanMesh.vao); b.fanMesh = null;
            }

        } else if (b.state === 'shoot_prepare') {
            b.pos.x += (Math.random() - 0.5) * 0.4; b.pos.z += (Math.random() - 0.5) * 0.4;
            // HIỆU ỨNG: Tia laser nhắm bắn
            const targetPoint = V3.add(p.pos, { x: 0, y: 1.5, z: 0 });
            // Tính toạ độ ngực chính xác (giống mChest trong draw: y=16, z=3)
            const spawnPoint = V3.create(b.pos.x + Math.sin(b.rotY) * 3, b.pos.y + (b.bodyY || 0) + 16, b.pos.z + Math.cos(b.rotY) * 3);
            const dir = V3.norm(V3.sub(targetPoint, spawnPoint));
            const ang = Math.atan2(dir.x, dir.z);
            if (b.dashMesh) gl.deleteVertexArray(b.dashMesh.vao);
            // Tăng độ rộng laser (1.2) để nhìn rõ hơn, bám đất mượt mà
            b.dashMesh = genTerrainDashMesh(spawnPoint.x, spawnPoint.z, ang, 1.2, 200);

            if (b.skillCD <= 0) {
                b.state = 'shooting'; b.skillCD = 0.15; b.shotCount = 15; // Bắn nhanh hơn (0.15s) và nhiều hơn (8 viên)
            }
        } else if (b.state === 'shooting') {
            b.bodyY = Math.sin(Date.now() * 0.1) * 0.3; // Giật lùi nhẹ khi bắn
            if (b.skillCD <= 0) {
                const targetPoint = V3.add(p.pos, { x: 0, y: 1.5, z: 0 });
                const spawnPoint = V3.create(b.pos.x + Math.sin(b.rotY) * 3, b.pos.y + (b.bodyY || 0) + 16, b.pos.z + Math.cos(b.rotY) * 3);
                const dir = V3.norm(V3.sub(targetPoint, spawnPoint));
                // [CHỈNH SỬA CHIÊU 2] Sát thương mỗi viên đạn (Bác vừa chỉnh xuống 200)
                STATE.projectiles.push({ pos: spawnPoint, dir: dir, dmg: window.GAME_CONFIG.boss.skill2.damage, speed: window.GAME_CONFIG.boss.skill2.speed, life: 3, isPlayer: false, dead: false, isBoss: true });

                playAudio('shoot');
                b.shotCount--;
                b.skillCD = 0.1;
                if (b.shotCount <= 0) {
                    b.state = 'fight';
                    // [QUAN TRỌNG] Thời gian Boss nghỉ (3s) sau khi bắn hết đạn
                    b.skillCD = window.GAME_CONFIG.boss.postSkillRest;
                }
            }
        }





        if (b.state === 'fight' && dist < 10) {
            takeDamage(p, window.GAME_CONFIG.boss.passiveDamage * dt, true); // [YÊU CẦU] Im lặng khi dính dame áp sát Boss
            showDamageDirection(b.pos);
        }

        if (b.hp <= 0 && !b.dead) {
            killBoss();
        }
        if (b.active) {
            const bossHpContainer = document.getElementById('boss-hp-container');
            if (bossHpContainer) bossHpContainer.style.display = 'block';
            document.getElementById('boss-hp-fill').style.width = (b.hp / b.maxHp) * 100 + '%';
        }
    }

    // Xóa vòng lặp đạn bị thừa




    if (STATE.player.hp <= 0) endGame(false);


}

function killBoss() {
    const combatSound1 = document.getElementById('combat-theme1-sound');
    if (combatSound1) combatSound1.pause();
    const combatSound3 = document.getElementById('combat-theme3-sound');
    if (combatSound3) combatSound3.pause();
    const b = STATE.boss;
    if (!b || b.dead || b.state === 'dying') return;

    b.state = 'dying';
    b.deathTimer = 3.5;
    STATE.inputLocked = true;
    STATE.keys = {}; // Stop player movement immediately
    setTimeout(() => { STATE.inputLocked = false; }, 1500);

    showGlobalAnnouncement("HAKARI ĐÃ BỊ TRIỆT TIÊU!", 5000);
}

function finishKillBoss() {
    const b = STATE.boss;
    if (!b || b.dead) return;

    b.dead = true;
    b.active = false;
    STATE.player.kills += 1;
    // Thông báo cho QuestManager để kill quest được tính khi hạ Boss
    if (window.QuestManager) window.QuestManager.onEvent('kill', 1);

    // DỌN DẸP MESH KHI BOSS CHẾT
    if (b.indicatorMesh) { deleteMesh(b.indicatorMesh); b.indicatorMesh = null; }
    if (b.dashMesh) { deleteMesh(b.dashMesh); b.dashMesh = null; }
    if (b.fanMesh) { deleteMesh(b.fanMesh); b.fanMesh = null; }
    if (b.pillarSpots) {
        b.pillarSpots.forEach(s => { if (s.mesh) deleteMesh(s.mesh); });
        b.pillarSpots = [];
    }

    document.getElementById('boss-hp-container').style.display = 'none';

    // Tạo chiếc Chìa Khóa Đỏ (isRedKey = true) rơi tại vị trí của Boss thay cho chiếc hộp
    STATE.finalPaper = {
        pos: V3.create(b.pos.x, b.pos.y + 0.2, b.pos.z),
        active: true,
        pickedUp: false,
        isRedKey: true
    };

    showGlobalAnnouncement("🔑 KẺ CANH CÁNH CỬA ĐÃ BỊ HẠ! HÃY NHẶT CHÌA KHÓA ĐỎ!", 6000);

    // Hiệu ứng nổ lớn
    STATE.shake = 3.5;
    spawnParticles(b.pos, 500, [1, 0, 0], 5.0);
}

function createExplosion(pos, customRange, customDamage, isFriendly = false, noCharge = false) {
    STATE.shake = 0.8; playAudio('shoot');
    spawnParticles(pos, 40, [1, 0.5, 0], 1.5, 'fire'); // Lửa cam
    spawnParticles(pos, 25, [0.4, 0.4, 0.4], 0.8, 'smoke'); // Khói xám
    const range = customRange || window.GAME_CONFIG.misc.barrelExplosionRange;
    const damage = customDamage || window.GAME_CONFIG.misc.barrelExplosionDamage;
    // Player chỉ nhận 30% dame từ thùng nổ (để khỏ thùng nổ thoải mái hơn)
    if (!isFriendly && V3.dist(pos, STATE.player.pos) < range) {
        takeDamage(STATE.player, damage * 0.3);
        showDamageDirection(pos);
    }
    // [CƠ CHẾ MỚI] Giới hạn số bot chết để không bỏ qua giai đoạn tiến hóa
    const aliveBots = STATE.bots.filter(b => b.hp > 0);
    const initialCount = STATE.config.botCount || 25;
    const t2 = Math.floor(initialCount * (window.GAME_CONFIG.bot.enrageLv2Pct || 0.4));
    const t3 = window.GAME_CONFIG.bot.lv3Count || 5;

    let floor = 0;
    if (aliveBots.length > t2) floor = t2;
    else if (aliveBots.length > t3) floor = t3;

    let deathsInThisExplosion = 0;
    const botsInRange = STATE.bots
        .filter(b => b.hp > 0 && !b.isEvolvingLv2 && !b.isEvolvingLv3 && V3.dist(pos, b.pos) < range)
        .sort((a, b) => V3.dist(pos, a.pos) - V3.dist(pos, b.pos));

    botsInRange.forEach(b => {
        let finalDmg = damage;
        if (b.hp <= finalDmg) {
            if (aliveBots.length - deathsInThisExplosion <= floor) {
                finalDmg = 0; // Bỏ qua sát thương hoàn toàn để giữ máu cho quái chuyển dạng
            } else {
                deathsInThisExplosion++;
                if (!isFriendly) {
                    b.killedByBarrel = true;
                }
            }
        }
        if (finalDmg > 0) {
            b.hp -= finalDmg;
            spawnDamageNumber(V3.add(b.pos, V3.create(0, 1, 0)), Math.round(finalDmg), false);
            if (!noCharge) STATE.player.damageDealt += finalDmg;
            if (!isFriendly && window.QuestManager) {
                window.QuestManager.onEvent('barrel_kill', 1);
            }
        }
    });
    if (STATE.boss && STATE.boss.active && V3.dist(pos, STATE.boss.pos) < range + 5) {
        STATE.boss.hp -= damage;
        spawnDamageNumber(V3.add(STATE.boss.pos, V3.create(0, 5, 0)), damage, false);
        if (!noCharge) STATE.player.damageDealt += damage;
        if (!isFriendly && window.QuestManager) {
            window.QuestManager.onEvent('barrel_kill', 1);
        }
    }
}

function fireWeapon(shooter, rot, weapon, isPlayer, dirOverride) {
    if (isPlayer && STATE.player.isChargingUlti) return;
    let dir; if (isPlayer) { const yaw = rot.y, pitch = rot.x; dir = V3.create(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); } else dir = V3.norm(dirOverride);
    const spread = (isPlayer && isMobile) ? 0 : weapon.spread; // Không tản đạn trên mobile
    dir.x += (Math.random() - 0.5) * spread; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread; dir = V3.norm(dir);
    STATE.projectiles.push({ pos: V3.add(shooter.pos, V3.create(0, 0.5, 0)), dir: dir, dmg: weapon.damage * (shooter.powerup && (shooter.powerup.type === 1 || shooter.powerup.type === 3) ? 2 : 1), life: 2.0, isPlayer: isPlayer, dead: false });
    if (isPlayer) {
        playAudio('shoot');
    } else {
        playPositionalAudio('shoot', shooter.pos);
    }
}

function takeDamage(p, amt, silent = false) {
    if (STATE.gameEnded || p.isInvincible) return;
    // FIX CRASH: Kiểm tra p.powerup tồn tại trước khi truy cập type
    if (p.powerup && p.powerup.time > 0 && p.powerup.type === 2) amt *= 0.2;
    if (p.armor > 0) {
        const armDmg = amt * 0.7;
        p.armor -= armDmg;
        p.hp -= amt * 0.3;
        if (p.armor < 0) { p.hp += p.armor; p.armor = 0; }

        // Premium animation: Điện màu xanh dương bảo vệ phát ra từ giáp
        const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
        if (vfx !== 'low') {
            spawnParticles(p.pos, 15, [0.0, 0.8, 1.0], 2.0, 'fire');
        }
    } else {
        p.hp -= amt;

        // Premium animation: Máu đỏ phát ra khi mất máu trực tiếp
        const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
        if (vfx !== 'low') {
            spawnParticles(p.pos, 15, [1.0, 0.1, 0.1], 2.0, 'fire');
        }
    }

    const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
    if (!isMobile && vfx !== 'low') STATE.shake = Math.min(1.5, STATE.shake + amt * 0.08);

    // Cooldown âm thanh trúng đòn
    const now = performance.now();
    if (!silent && now - p.lastDamageSoundTime > 200) {
        playAudio('hit');
        p.lastDamageSoundTime = now;
    }

    p.damageFlash = 0.0; // Tắt nháy đỏ hoàn toàn

    // Tắt hiệu ứng đỏ viền màn hình (Aura) để đỡ lag và chống nháy
    // document.body.classList.add('taking-damage');
    // setTimeout(() => document.body.classList.remove('taking-damage'), 100);

    // const overlay = document.getElementById('damage-overlay');
    // if (overlay) {
    //     overlay.style.opacity = '0';
    // }
}

function showHitMarker() {
    const el = document.getElementById('hit-marker');
    const ch = document.getElementById('crosshair');
    el.style.opacity = 1;
    if (ch) {
        ch.style.borderColor = '#ff3333';
        ch.style.transform = 'translate(-50%, -50%) scale(1.6)';
    }
    setTimeout(() => {
        el.style.opacity = 0;
        if (ch) {
            ch.style.borderColor = '#00ffcc';
            ch.style.transform = 'translate(-50%, -50%) scale(1.0)';
        }
    }, 120);
}
function spawnParticles(pos, count, color, speedMult = 1.0, type = 'fire') {
    // Giới hạn particles dựa trên chất lượng hiệu ứng đồ họa để chống lag
    const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
    if (vfx === 'low') return; // Tắt HOÀN TOÀN particles ở mức Tối thiểu để không bị hộp xanh bay
    if (vfx === 'medium' || isMobile) {
        count = Math.min(count, 12); // Tiết kiệm vừa phải
    } else {
        count = Math.min(count, 80); // Giới hạn trên để tránh lag cực đoan
    }
    for (let i = 0; i < count; i++) {
        const spread = 0.5;
        STATE.particles.push({
            pos: {
                x: pos.x + (Math.random() - 0.5) * spread,
                y: pos.y + (Math.random() - 0.5) * spread,
                z: pos.z + (Math.random() - 0.5) * spread
            },
            vel: {
                x: (Math.random() - 0.5) * 15 * speedMult,
                y: (Math.random() - 0.5) * 15 * speedMult + (type === 'smoke' ? 5 : 2),
                z: (Math.random() - 0.5) * 15 * speedMult
            },
            color: color,
            life: 1.0 + Math.random() * 0.5,
            type: type
        });
    }
}
function endGame(win) {
    const combatSound1 = document.getElementById('combat-theme1-sound');
    if (combatSound1) combatSound1.pause();
    const combatSound3 = document.getElementById('combat-theme3-sound');
    if (combatSound3) combatSound3.pause();
    if (STATE.gameEnded) return;
    STATE.gameEnded = true;

    const duration = Math.floor((Date.now() - STATE.startTime) / 1000);

    if (win) {
        const pcScreen = document.getElementById('post-credit-screen');
        const pcContent = document.getElementById('post-credit-content');
        if (pcScreen && pcContent) {
            document.exitPointerLock();
            document.getElementById('ui-layer').style.display = 'none';
            pcScreen.style.display = 'flex';

            // DỪNG CÁC ÂM THANH RÈ (Oscillators/Boss synthesized drones)
            if (window.bossOsc) {
                try { window.bossOsc.stop(); } catch (e) { }
                window.bossOsc = null;
            }
            if (window.bossNodes && window.bossNodes.length > 0) {
                window.bossNodes.forEach(n => { try { n.stop(); } catch (e) { } });
                window.bossNodes = [];
            }

            // PHÁT NHẠC NỀN COMBAT 1 HÀO HÙNG CHO CẢ 2 ENDING
            const combatSound1 = document.getElementById('combat-theme1-sound');
            const combatSound3 = document.getElementById('combat-theme3-sound');
            if (combatSound3) combatSound3.pause();
            if (combatSound1) {
                combatSound1.volume = 0.55;
                combatSound1.currentTime = 0;
                combatSound1.loop = true;
                combatSound1.play().catch(() => { });
            }

            let lines = [];
            const currentFragments = getLoreFragments();
            const currentMax = currentFragments.length;
            const collectedCount = window.QuestManager ? window.QuestManager.totalCollected : 0;
            const completedCount = window.QuestManager ? window.QuestManager.totalCompleted : 0;
            const pName = STATE.playerName || "bạn";
            const diff = window.CURRENT_DIFFICULTY || 'normal';
            const diffName = { easy: 'DỄ', normal: 'THƯỜNG', hard: 'KHÓ', extreme: 'SIÊU KHÓ' }[diff] || 'THƯỜNG';

            lines.push(`--- BÁO CÁO GIẢI MÃ HỒ SƠ SINH TỒN CỦA ${pName.toUpperCase()} ---`);
            lines.push(`⚙️ Chế độ hiện tại: ${diffName}`);
            lines.push(`🔑 Bí mật đã giải mã: ${completedCount}/${currentMax} (Đã nhặt hộp: ${collectedCount}/${currentMax})`);

            const totalUnlockedAll = window.LoreSystem ? window.LoreSystem.getTotalUnlockedCount() : completedCount;
            lines.push(`🏆 Tổng tiến trình sinh tồn: ${totalUnlockedAll} / 24 Bí mật đã giải mã (Mọi Chế Độ)`);

            if (diff !== 'extreme') {
                lines.push(`⚠️ [THÔNG BÁO HỆ THỐNG]: Hãy thử thách bản thân ở ĐỘ KHÓ CAO HƠN để mở khóa thêm nhiều bí mật ẩn giấu mới!`);
            } else {
                lines.push(`🌟 [HỆ THỐNG]: Bạn đã chinh phục chế độ khó nhất và đang tiếp cận tài liệu sinh tồn tối mật!`);
            }
            lines.push("");

            for (let i = 0; i < currentMax; i++) {
                if (i < completedCount) {
                    lines.push(`[BÍ MẬT PHẦN ${i + 1}]: ${currentFragments[i].text}`);
                } else if (i < collectedCount) {
                    lines.push(`[BÍ MẬT PHẦN ${i + 1}]: 🔒 [NHIỆM VỤ CHƯA HOÀN THÀNH] — ??? (Cần hoàn thành thử thách để giải mã)`);
                } else {
                    lines.push(`[BÍ MẬT PHẦN ${i + 1}]: 📦 [CHƯA NHẶT HỘP] — ??? (Tìm kiếm và nhặt hộp thông tin trên bản đồ)`);
                }
            }

            lines.push("");

            if (completedCount >= currentMax) {
                lines = lines.concat([
                    "Những chiếc hộp thông tin là gì tại sao nó lại rải khắp nơi trên đảo hoang này?",
                    "Liệu có là là tôi của trước đây mắc kẹt và để lại những chiếc hộp này chăng?",
                    "Vậy ra những kỹ năng của tôi được luyện tập qua những lần tôi mất trí nhớ và chiến đấu ở đây.",
                    "Điều gì đã xảy ra trước khi tôi đặt chân đến nơi này?, những vũ khí và trang bị rải rác khắp mọi nơi là của ai?",
                    "tôi cần tập trung hơn để tìm ra sự thật về hòn đảo cũng như thứ gọi là CÁNH CỬA ĐỎ"
                ]);
            } else {
                lines = lines.concat([
                    "vẫn còn quá nhìu bí ẩn vẫn chưa thể giải đáp...",
                    "Vì sao lại có những vũ khí và trang bị rải rác khắp mọi nơi trên hòn đảo hoang này?",
                    "Rốt cuộc ai đã để lại nó và với mục đích gì?",
                    "Cánh cửa đỏ rực đó vẫn còn là một bí ẩn",
                    "Tôi cần phải tìm hiểu sự thật..."
                ]);
            }

            let endingTimeout = null;
            let ended = false;

            const btnSkipEnding = document.getElementById('btn-skip-ending');
            if (btnSkipEnding) {
                // Thiết lập nhãn ban đầu của nút là BỎ QUA
                btnSkipEnding.innerText = 'BỎ QUA ⏭';
                btnSkipEnding.style.opacity = '0';
                btnSkipEnding.style.pointerEvents = 'none';

                // Đợi 10 giây mới hiển thị nút Bỏ qua Ending
                setTimeout(() => {
                    if (!ended) {
                        btnSkipEnding.style.opacity = '1';
                        btnSkipEnding.style.pointerEvents = 'auto';
                    }
                }, 10000);

                btnSkipEnding.onclick = () => {
                    if (ended) return;
                    ended = true;
                    if (endingTimeout) clearTimeout(endingTimeout);

                    // Tắt nhạc lặp khi thoát ra bảng điểm
                    if (combatSound1) combatSound1.loop = false;

                    showRealEndScreen(win, duration);
                };
            }

            // Tốc độ mặc định (Chậm để đọc trên mobile)
            let endingSpeedMode = 1; // 1 = x1, 2 = x2, 3 = x3
            let charSpeed = 45;
            let lineSpeed = 2200;

            const getEndingBaseSpeed = () => {
                if (endingSpeedMode === 2) return { char: 20, line: 1000 };
                if (endingSpeedMode === 3) return { char: 5, line: 300 };
                return { char: 45, line: 2200 };
            };

            // Đè màn hình để tua nhanh chữ, thả ra sẽ chạy chậm lại
            const speedUpEnding = () => { charSpeed = 5; lineSpeed = 300; };
            const slowDownEnding = () => {
                const base = getEndingBaseSpeed();
                charSpeed = base.char;
                lineSpeed = base.line;
            };

            // Lập trình sự kiện cho nút Tua Tốc Độ Cốt Truyện kết thúc
            const btnSpeedEnding = document.getElementById('btn-speed-ending');
            if (btnSpeedEnding) {
                btnSpeedEnding.innerText = '⚡ x1';
                btnSpeedEnding.onclick = (e) => {
                    e.stopPropagation(); // Ngăn sự kiện chạm/click lan ra màn hình gây trigger mousedown/touchstart
                    endingSpeedMode = endingSpeedMode === 3 ? 1 : endingSpeedMode + 1;
                    btnSpeedEnding.innerText = `⚡ x${endingSpeedMode}`;

                    // Đồng bộ ngay lập tức tốc độ hiện tại
                    const base = getEndingBaseSpeed();
                    charSpeed = base.char;
                    lineSpeed = base.line;
                };
                // Ngăn chặn mousedown/touchstart trên nút speed khỏi kích hoạt speedUpEnding/slowDownEnding
                btnSpeedEnding.addEventListener('mousedown', (e) => e.stopPropagation());
                btnSpeedEnding.addEventListener('touchstart', (e) => e.stopPropagation());
            }

            pcScreen.addEventListener('mousedown', speedUpEnding);
            pcScreen.addEventListener('touchstart', speedUpEnding);
            pcScreen.addEventListener('mouseup', slowDownEnding);
            pcScreen.addEventListener('mouseleave', slowDownEnding);
            pcScreen.addEventListener('touchend', slowDownEnding);
            pcScreen.addEventListener('touchcancel', slowDownEnding);

            setTimeout(() => {
                pcScreen.style.opacity = '1';
                let lineIdx = 0;

                function typeCurrentLine() {
                    if (ended) return;
                    if (lineIdx >= lines.length) {
                        // KHI HIỂN THỊ HẾT: Không tự thoát, mà đổi nhãn nút thành XEM KẾT QUẢ và bắt buộc bấm!
                        if (btnSkipEnding) {
                            btnSkipEnding.innerText = 'XEM KẾT QUẢ ⏭';
                            btnSkipEnding.style.opacity = '1';
                            btnSkipEnding.style.pointerEvents = 'auto';
                        }
                        return;
                    }

                    const lineText = lines[lineIdx];
                    const p = document.createElement('div');
                    p.className = 'post-credit-text';
                    p.style.opacity = '1';
                    pcContent.appendChild(p);
                    pcContent.scrollTop = pcContent.scrollHeight;

                    let charIdx = 0;
                    function typeChar() {
                        if (ended) return;
                        if (charIdx < lineText.length) {
                            p.textContent += lineText.charAt(charIdx);
                            charIdx++;
                            pcContent.scrollTop = pcContent.scrollHeight;
                            endingTimeout = setTimeout(typeChar, charSpeed);
                        } else {
                            lineIdx++;
                            endingTimeout = setTimeout(typeCurrentLine, lineSpeed);
                        }
                    }
                    typeChar();
                }
                typeCurrentLine();
            }, 500);
            return;
        }
    }

    showRealEndScreen(win, duration);
}

function showRealEndScreen(win, duration) {
    STATE.screen = 'end'; document.exitPointerLock(); document.getElementById('ui-layer').style.display = 'none';
    const pcScreen = document.getElementById('post-credit-screen');
    if (pcScreen) pcScreen.style.display = 'none';
    STATE.finalStats = { win, kills: STATE.player.kills, duration, date: new Date().toLocaleString('vi-VN') };

    // Gửi thông báo Discord ngay lập tức khi trận đấu kết thúc (thắng hoặc thua) (không reload trang)
    if (window.sendFinalResultToDiscord) {
        window.sendFinalResultToDiscord(false);
    }

    const gameOver = document.getElementById('game-over-screen'), playAgainBtn = document.getElementById('play-again-btn');
    gameOver.classList.remove('hidden');
    if (win) {
        document.getElementById('end-title').innerText = "VICTORY";
        document.getElementById('end-title').style.color = "#ffd700";
    } else {
        document.getElementById('end-title').innerText = "GAME OVER!!!";
        document.getElementById('end-title').style.color = "#ff0000";
    }
    if (playAgainBtn) playAgainBtn.style.display = 'inline-block';
    document.getElementById('end-stats').innerText = `Kills: ${STATE.player.kills} | Thời gian: ${duration}s`;
}




document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo hiển thị của menu cài đặt Đồ họa & Hiệu năng
    const resSelect = document.getElementById('graphics-resolution-select');
    const vfxSelect = document.getElementById('graphics-vfx-select');

    if (resSelect) {
        const savedRes = localStorage.getItem('graphicsResolution') || (isMobile ? 'medium' : 'high');
        resSelect.value = savedRes;

        const resValEl = document.getElementById('graphics-resolution-val');
        if (resValEl) {
            if (savedRes === 'ultralow') resValEl.innerText = "Siêu Mượt (360p - 0.25x)";
            else if (savedRes === 'low') resValEl.innerText = "Mượt (480p - 0.45x)";
            else if (savedRes === 'medium') resValEl.innerText = "Trung bình (720p - 0.7x)";
            else resValEl.innerText = "Cao (1080p - 1.0x)";
        }

        resSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const resValEl = document.getElementById('graphics-resolution-val');
            if (resValEl) {
                if (val === 'ultralow') resValEl.innerText = "Siêu Mượt (360p - 0.25x)";
                else if (val === 'low') resValEl.innerText = "Mượt (480p - 0.45x)";
                else if (val === 'medium') resValEl.innerText = "Trung bình (720p - 0.7x)";
                else resValEl.innerText = "Cao (1080p - 1.0x)";
            }
        });
    }

    if (vfxSelect) {
        const savedVfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
        vfxSelect.value = savedVfx;

        const vfxValEl = document.getElementById('graphics-vfx-val');
        if (vfxValEl) {
            if (savedVfx === 'low') vfxValEl.innerText = "Tối thiểu";
            else if (savedVfx === 'medium') vfxValEl.innerText = "Bình thường";
            else vfxValEl.innerText = "Tối đa";
        }

        vfxSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const vfxValEl = document.getElementById('graphics-vfx-val');
            if (vfxValEl) {
                if (val === 'low') vfxValEl.innerText = "Tối thiểu";
                else if (val === 'medium') vfxValEl.innerText = "Bình thường";
                else vfxValEl.innerText = "Tối đa";
            }
        });
    }

    // Logic Cài đặt HUD

    const btnSettings = document.getElementById('btn-settings');
    const modalSettings = document.getElementById('settings-modal');
    const btnSaveHud = document.getElementById('btn-save-hud');
    const btnResetHud = document.getElementById('btn-reset-hud');
    const mobileBtns = [
        'btn-shoot', 'btn-jump', 'btn-aim', 'btn-reload',
        'btn-ulti', 'btn-interact', 'btn-sprint',
        'mobile-weapons', 'health-bar-container', 'armor-bar-container',
        'ammo-display', 'stats-display', 'loot-legend',
        'minimap-container', 'btn-settings', 'quest-tracker-ui', 'kill-feed'
    ];
    let draggedBtn = null;

    const savedHUD = JSON.parse(localStorage.getItem('hudSettings'));
    if (savedHUD) {
        mobileBtns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn && savedHUD[id]) {
                const settings = savedHUD[id];
                // Tự động chuyển đổi toạ độ pixel (px) cũ sang dạng phần trăm (%) để đồng bộ thiết bị
                if (settings.left && settings.left.includes('px')) {
                    const pxVal = parseFloat(settings.left);
                    settings.left = ((pxVal / window.innerWidth) * 100).toFixed(3) + '%';
                }
                if (settings.top && settings.top.includes('px')) {
                    const pxVal = parseFloat(settings.top);
                    settings.top = ((pxVal / window.innerHeight) * 100).toFixed(3) + '%';
                }

                Object.assign(btn.style, settings);
                if (settings.scale) btn.style.setProperty('--btn-scale', settings.scale);
                // Triệt tiêu translateX(-50%) của bảng đạn khi có vị trí kéo thả tuỳ chỉnh
                if (id === 'ammo-display') {
                    btn.style.transform = 'none';
                }
            }
        });
        // Lưu lại dữ liệu đã tự động migrate vào localStorage
        localStorage.setItem('hudSettings', JSON.stringify(savedHUD));
    }

    let activeEditBtn = null;
    const slider = document.getElementById('hud-scale-slider');
    const scaleVal = document.getElementById('hud-scale-val');

    function selectEditBtn(btn) {
        if (activeEditBtn) activeEditBtn.classList.remove('hud-selected');
        activeEditBtn = btn;
        if (btn) {
            btn.classList.add('hud-selected');
            const currentScale = btn.style.getPropertyValue('--btn-scale') || '1.0';
            if (slider) {
                slider.value = currentScale;
                scaleVal.innerText = Math.round(currentScale * 100) + '%';
            }
        }
    }

    if (slider) {
        slider.addEventListener('input', (e) => {
            if (!activeEditBtn) return;
            const scale = e.target.value;
            scaleVal.innerText = Math.round(scale * 100) + '%';
            activeEditBtn.style.setProperty('--btn-scale', scale);
        });
    }

    window.aimSensitivity = parseFloat(localStorage.getItem('aimSensitivity')) || 2.0;
    const sensSlider = document.getElementById('sensitivity-slider');
    const sensVal = document.getElementById('sensitivity-val');
    if (sensSlider) {
        sensSlider.value = window.aimSensitivity;
        sensVal.innerText = window.aimSensitivity.toFixed(1);
        sensSlider.addEventListener('input', (e) => {
            window.aimSensitivity = parseFloat(e.target.value);
            sensVal.innerText = window.aimSensitivity.toFixed(1);
            localStorage.setItem('aimSensitivity', window.aimSensitivity);
        });
    }

    let preEditHUD = {};
    if (btnSettings) {
        const handleSettingsOpen = (e) => {
            e.preventDefault();
            window.isEditingHUD = true;
            if (STATE.screen === 'game') STATE.screen = 'pause'; // Tạm dừng
            modalSettings.classList.remove('hidden');
            preEditHUD = {};
            mobileBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    preEditHUD[id] = {
                        top: btn.style.top, left: btn.style.left,
                        bottom: btn.style.bottom, right: btn.style.right,
                        position: btn.style.position,
                        scale: btn.style.getPropertyValue('--btn-scale') || '1.0'
                    };
                    btn.classList.add('hud-editing');
                    btn.style.pointerEvents = 'auto'; // Cho phép touch khi edit
                }
            });

            // Hiển thị bản xem trước của bảng nhiệm vụ để dễ căn chỉnh trong chế độ Edit
            const qt = document.getElementById('quest-tracker-ui');
            if (qt) {
                qt.classList.remove('hidden');
                if (!window.QuestManager || window.QuestManager.activeQuests.length === 0) {
                    const list = document.getElementById('quest-list');
                    if (list) {
                        list.innerHTML = `
                            <div class="quest-item">
                                <div class="quest-desc">[PREVIEW] Tiêu diệt quái</div>
                                <div class="quest-bar-wrap">
                                    <div class="quest-bar-fill" style="width:60%"></div>
                                    <span class="quest-progress-txt">3/5</span>
                                </div>
                            </div>
                        `;
                    }
                }
            }

            // Hiển thị nút Unti để dễ căn chỉnh trong chế độ Edit
            const btnUlti = document.getElementById('btn-ulti');
            if (btnUlti) {
                btnUlti.classList.remove('hidden');
            }

            // Tự động chọn nút Bắn mặc định
            const btnShoot = document.getElementById('btn-shoot');
            if (btnShoot) selectEditBtn(btnShoot);
        };
        btnSettings.addEventListener('click', handleSettingsOpen);
        btnSettings.addEventListener('touchstart', handleSettingsOpen);
    }

    const btnCancelHud = document.getElementById('btn-cancel-hud');
    if (btnCancelHud) {
        btnCancelHud.addEventListener('click', () => {
            window.isEditingHUD = false;
            if (STATE.screen === 'pause') STATE.screen = 'game'; // Tiếp tục
            modalSettings.classList.add('hidden');
            if (activeEditBtn) activeEditBtn.classList.remove('hud-selected');
            activeEditBtn = null;

            mobileBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn && preEditHUD[id]) {
                    btn.classList.remove('hud-editing');
                    if (!['action-bar', 'btn-sprint', 'mobile-weapons', 'btn-ulti'].includes(id)) {
                        btn.style.pointerEvents = ''; // Trả về mặc định
                    }
                    btn.style.top = preEditHUD[id].top;
                    btn.style.left = preEditHUD[id].left;
                    btn.style.bottom = preEditHUD[id].bottom;
                    btn.style.right = preEditHUD[id].right;
                    btn.style.position = preEditHUD[id].position;
                    btn.style.setProperty('--btn-scale', preEditHUD[id].scale);
                }
            });

            // Khôi phục trạng thái bảng nhiệm vụ
            if (window.QuestManager) {
                window.QuestManager.updateUI();
                if (window.QuestManager.activeQuests.length === 0) {
                    const qt = document.getElementById('quest-tracker-ui');
                    if (qt) qt.classList.add('hidden');
                }
            }

            // Khôi phục trạng thái nút Unti
            const btnUlti = document.getElementById('btn-ulti');
            if (btnUlti) {
                if (!STATE.player || typeof STATE.player.damageDealt !== 'number' || STATE.player.damageDealt < (window.GAME_CONFIG?.ultimate?.requiredDamage || 500)) {
                    btnUlti.classList.add('hidden');
                }
            }
        });
    }

    if (btnSaveHud) {
        btnSaveHud.addEventListener('click', () => {
            window.isEditingHUD = false;
            if (STATE.screen === 'pause') STATE.screen = 'game'; // Tiếp tục
            modalSettings.classList.add('hidden');
            if (activeEditBtn) activeEditBtn.classList.remove('hud-selected');
            activeEditBtn = null;
            let newHUD = {};
            mobileBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.classList.remove('hud-editing');
                    if (!['action-bar', 'btn-sprint', 'mobile-weapons', 'btn-ulti'].includes(id)) {
                        btn.style.pointerEvents = ''; // Trả về mặc định
                    }
                    newHUD[id] = {
                        top: btn.style.top, left: btn.style.left,
                        bottom: btn.style.bottom, right: btn.style.right,
                        position: 'fixed',
                        scale: btn.style.getPropertyValue('--btn-scale') || '1.0'
                    };
                }
            });
            localStorage.setItem('hudSettings', JSON.stringify(newHUD));

            // Lưu cài đặt Đồ họa & Hiệu năng
            const resSelect = document.getElementById('graphics-resolution-select');
            const vfxSelect = document.getElementById('graphics-vfx-select');
            if (resSelect) localStorage.setItem('graphicsResolution', resSelect.value);
            if (vfxSelect) localStorage.setItem('graphicsVfx', vfxSelect.value);
            if (typeof applyGraphicsSettings === 'function') {
                applyGraphicsSettings();
            }

            // Khôi phục trạng thái bảng nhiệm vụ
            if (window.QuestManager) {
                window.QuestManager.updateUI();
                if (window.QuestManager.activeQuests.length === 0) {
                    const qt = document.getElementById('quest-tracker-ui');
                    if (qt) qt.classList.add('hidden');
                }
            }

            // Khôi phục trạng thái nút Unti
            const btnUltiSave = document.getElementById('btn-ulti');
            if (btnUltiSave) {
                if (!STATE.player || typeof STATE.player.damageDealt !== 'number' || STATE.player.damageDealt < (window.GAME_CONFIG?.ultimate?.requiredDamage || 500)) {
                    btnUltiSave.classList.add('hidden');
                }
            }
        });
    }

    if (btnResetHud) {
        btnResetHud.addEventListener('click', () => {
            mobileBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.style.top = ''; btn.style.left = ''; btn.style.bottom = ''; btn.style.right = '';
                    btn.style.position = ''; btn.style.transform = '';
                    btn.style.removeProperty('--btn-scale');
                }
            });
            localStorage.removeItem('hudSettings');
            if (activeEditBtn) {
                if (slider) { slider.value = 1.0; scaleVal.innerText = '100%'; }
            }

            // Khôi phục trạng thái bảng nhiệm vụ
            if (window.QuestManager) {
                window.QuestManager.updateUI();
                if (window.QuestManager.activeQuests.length === 0) {
                    const qt = document.getElementById('quest-tracker-ui');
                    if (qt) qt.classList.add('hidden');
                }
            }

            // Khôi phục trạng thái nút Unti
            const btnUltiReset = document.getElementById('btn-ulti');
            if (btnUltiReset) {
                if (!STATE.player || typeof STATE.player.damageDealt !== 'number' || STATE.player.damageDealt < (window.GAME_CONFIG?.ultimate?.requiredDamage || 500)) {
                    btnUltiReset.classList.add('hidden');
                }
            }
        });
    }

    document.addEventListener('touchstart', (e) => {
        if (!window.isEditingHUD) return;
        let targetId = null;
        for (let id of mobileBtns) {
            if (e.target.closest('#' + id)) {
                targetId = id;
                break;
            }
        }
        if (targetId) {
            draggedBtn = document.getElementById(targetId);
            selectEditBtn(draggedBtn);
        }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!window.isEditingHUD || !draggedBtn) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        draggedBtn.style.position = 'fixed';
        draggedBtn.style.bottom = 'auto'; draggedBtn.style.right = 'auto';

        // Tính toán vị trí theo phần trăm màn hình (%) để đồng bộ tuyệt đối giữa PC và Mobile
        const rect = draggedBtn.getBoundingClientRect();
        const pctLeft = ((t.clientX - rect.width / 2) / window.innerWidth) * 100;
        const pctTop = ((t.clientY - rect.height / 2) / window.innerHeight) * 100;

        draggedBtn.style.left = Math.max(0, Math.min(95, pctLeft)).toFixed(3) + '%';
        draggedBtn.style.top = Math.max(0, Math.min(95, pctTop)).toFixed(3) + '%';
        draggedBtn.style.transform = 'scale(var(--btn-scale, 1.0))'; // Giữ nguyên tỉ lệ thu phóng khi di chuyển
    }, { passive: false });

    document.addEventListener('touchend', () => { draggedBtn = null; });

    // Mouse drag (PC HUD edit)
    document.addEventListener('mousedown', (e) => {
        if (!window.isEditingHUD) return;
        let targetId = null;
        for (let id of mobileBtns) {
            if (e.target.closest('#' + id)) { targetId = id; break; }
        }
        if (targetId) {
            draggedBtn = document.getElementById(targetId);
            selectEditBtn(draggedBtn);
            e.preventDefault();
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (!window.isEditingHUD || !draggedBtn) return;
        draggedBtn.style.position = 'fixed';
        draggedBtn.style.bottom = 'auto'; draggedBtn.style.right = 'auto';

        // Tính toán vị trí theo phần trăm màn hình (%) để đồng bộ tuyệt đối giữa PC và Mobile
        const rect = draggedBtn.getBoundingClientRect();
        const pctLeft = ((e.clientX - rect.width / 2) / window.innerWidth) * 100;
        const pctTop = ((e.clientY - rect.height / 2) / window.innerHeight) * 100;

        draggedBtn.style.left = Math.max(0, Math.min(95, pctLeft)).toFixed(3) + '%';
        draggedBtn.style.top = Math.max(0, Math.min(95, pctTop)).toFixed(3) + '%';
        draggedBtn.style.transform = 'scale(var(--btn-scale, 1.0))'; // Giữ nguyên tỉ lệ thu phóng khi di chuyển
    });
    document.addEventListener('mouseup', () => { draggedBtn = null; });
});








// Giảm mạnh grass trên mobile và chất lượng đồ hoạ thấp để giảm draw call cực đoan
const GRASS_PATCHES = [];
function initGrassPatches() {
    GRASS_PATCHES.length = 0;
    const vfx = localStorage.getItem('graphicsVfx') || (isMobile ? 'medium' : 'high');
    let grassCount = 200;
    if (vfx === 'low') grassCount = 15;
    else if (vfx === 'medium' || isMobile) grassCount = 45;

    for (let i = 0; i < grassCount; i++) {
        const x = Math.sin(i * 12.989) * MAP_SIZE * 0.45;
        const z = Math.cos(i * 78.233) * MAP_SIZE * 0.45;
        const y = getHeight(x, z);
        const scale = 0.6 + Math.random() * 0.6;
        GRASS_PATCHES.push({ x, y, z, scale });
    }
}
initGrassPatches();

function draw() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const p = STATE.player;
    if (!p || !p.pos) return;

    // === LOW HEALTH ADRENALINE (Nhịp tim chớp đỏ + rung mờ khi máu < 30%) ===
    let heartbeatPulse = 0;
    if (p.hp > 0 && p.hp <= p.maxHp * 0.3) {
        const time = performance.now() / 1000;
        const beat = Math.pow(Math.sin(time * 8.0) * Math.sin(time * 4.0), 4.0);
        heartbeatPulse = beat * 0.4;
        document.getElementById('damage-overlay').style.opacity = heartbeatPulse.toFixed(2);
        STATE.shake = (STATE.shake || 0) + heartbeatPulse * 0.05;
    }

    // CHUYỂN ĐỔI KHÔNG KHÍ: Chiều tà (Bot) vs Kinh dị (Boss)
    let fogCol = [0.6, 0.3, 0.2]; // Trả lại màu cam chiều tà mặc định (u ám)
    let bgCol = [0.7, 0.4, 0.3];  // Trả lại bầu trời buổi chiều cũ

    if (STATE.boss && STATE.boss.active) {
        const dist = V3.dist(p.pos, STATE.boss.pos);
        const intensity = Math.max(0, 1 - dist / 50);
        // Bầu trời máu nhấp nháy u ám (Hell Vibe)
        const skyPulse = 0.05 + Math.sin(Date.now() * 0.0015) * 0.04;
        fogCol = [0.6 + intensity * 0.3, 0.2, 0.2]; // Tăng mạnh độ sáng sương mù
        bgCol = [0.4 + skyPulse, 0.1, 0.1];         // Tăng mạnh độ sáng bầu trời
        // CSS filter: Trả lại độ tối u ám cũ
        if (!isMobile) document.body.style.filter = intensity > 0.4 ? `contrast(${140 + intensity * 60}%) brightness(${0.7 - intensity * 0.25})` : 'brightness(0.7) contrast(1.2)';
        if (!isMobile && intensity > 0.6) STATE.shake += intensity * 0.02;
    } else {
        // GIAI ĐOẠN CHIỀU TÀ (Trả lại độ tối u ám)
        fogCol = [0.6, 0.3, 0.2];
        bgCol = [0.7, 0.4, 0.3];
        if (!isMobile) document.body.style.filter = 'brightness(0.7) contrast(1.2)';
    }

    gl.clearColor(bgCol[0], bgCol[1], bgCol[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.useProgram(prog);

    // Xử lý Aim & Sprint Lerp (Mượt mà)
    // Khóa ngắm bắn khi cầm Chìa Khóa Đỏ hoặc Súng lục (weaponIdx === 0)
    if (STATE.hasRedKey || p.weaponIdx === 0) {
        STATE.isAiming = false;
    }
    STATE.aimLerp += ((STATE.isAiming ? 1 : 0) - STATE.aimLerp) * 0.2;
    STATE.sprintLerp = (STATE.sprintLerp || 0) + (((STATE.keys['ShiftLeft'] && !STATE.isAiming) ? 1 : 0) - (STATE.sprintLerp || 0)) * 0.05;

    const aspect = gl.canvas.width / gl.canvas.height;
    const zoomFactor = [0.3, 0.6, 0.95][p.weaponIdx];
    const fov = 1.2 - (STATE.aimLerp * zoomFactor) + (STATE.sprintLerp * 0.3);

    const proj = M4.perspective(fov, aspect, 0.1, isMobile ? 2500 : 10000);
    // Thêm visual recoil (giật camera lên rồi tự động hồi về khi p.recoil giảm)
    let camHeightOffset = 1.1;
    let standUpPitchOffset = 0;
    if ((p.standUpTimer || 0) > 0) {
        const TOTAL = 8.0;
        const elapsed = TOTAL - p.standUpTimer;
        const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Camera height timeline for 8s:
        // 0.0–2.0s: Lying on ground (height = 0.15)
        // 2.0–3.0s: Placing hand and slight head raise (0.15 → 0.25)
        // 3.0–4.0s: Pushing up to sitting (0.25 → 0.55)
        // 4.0–6.0s: Sitting position (height = 0.55)
        // 6.0–7.2s: Standing up gradually (0.55 → 1.1)
        // 7.2–8.0s: Settle (height = 1.1)
        if (elapsed < 2.0) {
            camHeightOffset = 0.15;
        } else if (elapsed < 3.0) {
            const t = easeInOut((elapsed - 2.0) / 1.0);
            camHeightOffset = 0.15 + t * 0.10; // 0.15 → 0.25
        } else if (elapsed < 4.0) {
            const t = easeInOut((elapsed - 3.0) / 1.0);
            camHeightOffset = 0.25 + t * 0.30; // 0.25 → 0.55
        } else if (elapsed < 6.0) {
            camHeightOffset = 0.55;
        } else if (elapsed < 7.2) {
            const t = easeInOut((elapsed - 6.0) / 1.2);
            camHeightOffset = 0.55 + t * 0.55; // 0.55 → 1.1
        } else {
            camHeightOffset = 1.1;
        }
        standUpPitchOffset = 0; // Pitch is handled in update() now
    }

    const yaw = STATE.camera.rot.y + (p.standUpYawOffset || 0);
    const pitch = STATE.camera.rot.x + (p.recoil * (p.weaponIdx === 2 ? 0.4 : 0.05)) + standUpPitchOffset;

    // === LANDING DIP: Camera dập xuống khi hạ cánh ===
    const landingDip = p._landingDip || 0;

    // Giật cam chỉ trên PC (mobile tắt để mượt hơn)
    const shakeAmt = isMobile ? 0 : STATE.shake;
    const eye = V3.create(p.pos.x + (Math.random() - 0.5) * shakeAmt, p.pos.y + camHeightOffset - landingDip + (Math.random() - 0.5) * shakeAmt, p.pos.z);
    const forward = V3.create(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)), center = V3.add(eye, forward);

    // === STRAFE TILT: Camera nghiêng khi strafe (roll) ===
    const tiltAmt = STATE.strafeTilt || 0;
    const upVec = V3.norm(V3.create(tiltAmt, 1.0, 0)); // Nghiêng up-vector sang trái/phải
    const view = M4.lookAt(eye, center, upVec);

    gl.uniformMatrix4fv(locs.proj, false, proj);
    gl.uniformMatrix4fv(locs.view, false, view);
    gl.uniform3f(locs.camPos, eye.x, eye.y, eye.z);
    gl.uniform3f(locs.sunDir, 0.5, 0.8, 0.3);
    gl.uniform3f(locs.fogColor, fogCol[0], fogCol[1], fogCol[2]);
    gl.uniform3f(locs.emitColor, 0, 0, 0); // Reset emissive color
    gl.uniform1f(locs.time, performance.now() / 1000);

    // Phase 1: Dynamic point light (boss aura, barrel fire)
    let _plPos = [0, -500, 0], _plCol = [0, 0, 0];
    if (STATE.boss && STATE.boss.active) {
        const _isRage = STATE.boss.hp < STATE.boss.maxHp * 0.5;
        _plPos = [STATE.boss.pos.x, STATE.boss.pos.y + 10, STATE.boss.pos.z];
        _plCol = _isRage ? [2.0, 0.05, 0.0] : [1.0, 0.0, 0.25];
    }
    if (locs.pointLightPos) gl.uniform3fv(locs.pointLightPos, _plPos);
    if (locs.pointLightColor) gl.uniform3fv(locs.pointLightColor, _plCol);
    // Muzzle flash decay
    STATE.muzzleFlashTime = Math.max(0, (STATE.muzzleFlashTime || 0) - 0.018);
    if (locs.muzzleFlash) gl.uniform1f(locs.muzzleFlash, STATE.muzzleFlashTime / 0.08);

    const drawMeshActual = (mesh, pos, scale = 1, rotY = 0) => {
        // [PHASE 8] Frustum culling đơn giản để tăng hiệu năng vẽ vật thể xa sau lưng camera
        if (mesh !== ASSETS.sky && mesh !== ASSETS.cosmicSky) {
            const toObj = V3.sub(pos, eye);
            const dist = V3.len(toObj);

            // [PHASE 10] LOD (Level of Detail) & Khoảng cách vẽ tối đa dựa trên loại Mesh và chất lượng hiện tại
            const isReduced = STATE.qualityReduced;
            if (mesh === ASSETS.grass) {
                if (dist > (isReduced ? 40.0 : 70.0)) return;
            } else if (mesh === ASSETS.debris || mesh === ASSETS.warningSign) {
                if (dist > (isReduced ? 60.0 : 100.0)) return;
            } else if (mesh === ASSETS.tree || mesh === ASSETS.rock || mesh === ASSETS.barrel || mesh === ASSETS.lampPost || mesh === ASSETS.pad) {
                if (dist > (isReduced ? 110.0 : 180.0)) return;
            }

            if (dist > 6.0) {
                const dirToObj = V3.norm(toObj);
                const dot = V3.dot(forward, dirToObj);
                // Cắt culling rộng hơn một chút (-0.25) để tránh pop-in ở khóe mắt camera
                if (dot < -0.25) return;
            }
        }

        let m = M4.translation(pos.x, pos.y, pos.z);
        m = M4.multiply(m, M4.rotationY(rotY));
        m = M4.multiply(m, M4.scaling(scale, scale, scale));
        gl.uniformMatrix4fv(locs.model, false, m);
        if (locs.isGrass) gl.uniform1i(locs.isGrass, mesh === ASSETS.grass);
        if (locs.isTree) gl.uniform1i(locs.isTree, mesh === ASSETS.tree);
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
        if (locs.isGrass && mesh === ASSETS.grass) gl.uniform1i(locs.isGrass, false);
        if (locs.isTree && mesh === ASSETS.tree) gl.uniform1i(locs.isTree, false);
    };
    const drawMeshRaw = (mesh, matrix) => {
        gl.uniformMatrix4fv(locs.model, false, matrix);
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    };

    gl.disable(gl.DEPTH_TEST);
    gl.uniform1i(locs.isSky, true);
    gl.uniform1i(locs.isWater, false);
    gl.uniform1i(locs.instanced, false);
    drawMeshActual(ASSETS.sky, eye, 1, 0);

    // Vẽ Bầu trời Sao & Thiên thạch
    gl.uniform1i(locs.isSky, false);
    drawMeshActual(ASSETS.cosmicSky, eye, 1, 0);

    // Trăng máu: khán giả bỏ hào quang BLEND tốn GPU, chỉ vẽ mặt trăng tĩnh
    if (STATE.boss && STATE.boss.active) {
        gl.uniform1i(locs.isSky, false);
        const moonPos = { x: eye.x + 200, y: eye.y + 180, z: eye.z - 400 };
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        const pulse = 0.9 + Math.sin(Date.now() * 0.001) * 0.1;
        gl.uniform3f(locs.fogColor, 0.4 * pulse, 0, 0);
        drawMeshActual(ASSETS.bloodMoon, moonPos, 100, 0);
        gl.disable(gl.BLEND);
        gl.uniform3f(locs.fogColor, 2.0, 0, 0);
        drawMeshActual(ASSETS.bloodMoon, moonPos, 80, 0);
        gl.uniform3f(locs.fogColor, fogCol[0], fogCol[1], fogCol[2]);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.uniform1i(locs.isSky, false);

    gl.uniformMatrix4fv(locs.model, false, M4.identity()); gl.bindVertexArray(ASSETS.ground.vao); gl.drawArrays(gl.TRIANGLES, 0, ASSETS.ground.count);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1i(locs.isWater, true);
    // Dùng M4.identity() vì biển đã đủ lớn để bao phủ toàn bộ map từ tâm
    gl.uniformMatrix4fv(locs.model, false, M4.identity());
    gl.bindVertexArray(ASSETS.water.vao); gl.drawArrays(gl.TRIANGLES, 0, ASSETS.water.count);
    gl.uniform1i(locs.isWater, false); gl.disable(gl.BLEND);
    const drawShadow = (pos, size) => { let h = getHeight(pos.x, pos.z) + 0.05, m = M4.translation(pos.x, h, pos.z); m = M4.multiply(m, M4.scaling(size, 0.01, size)); gl.uniformMatrix4fv(locs.model, false, m); gl.bindVertexArray(ASSETS.crate.vao); gl.drawArrays(gl.TRIANGLES, 0, ASSETS.crate.count); };
    if (!isMobile) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform3f(locs.fogColor, 0, 0, 0);
        STATE.bots.forEach(b => drawShadow(b.pos, 1.5)); drawShadow(p.pos, 1.5);
        gl.uniform3f(locs.fogColor, fogCol[0], fogCol[1], fogCol[2]);
        gl.disable(gl.BLEND);
    }

    STATE.barrels.forEach(b => drawMeshActual(ASSETS.barrel, b.pos, 3, 0));

    // Draw Quest Items — dạng hình thoi nổi
    STATE.questItems.forEach(q => {
        const bob = Math.sin(Date.now() / 400) * 0.3;
        drawMeshActual(ASSETS.lootAmmo, { x: q.pos.x, y: q.pos.y + bob + 1.2, z: q.pos.z }, 2.0, Date.now() / 500);

        // Hạt vàng bay lên thay vì cột sáng cứng
        if (Math.random() < 0.35) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.6;
            STATE.particles.push({
                pos: V3.create(q.pos.x + Math.cos(angle) * r, q.pos.y + bob + 1.2, q.pos.z + Math.sin(angle) * r),
                vel: V3.create((Math.random() - 0.5) * 0.5, 6.0 + Math.random() * 5.0, (Math.random() - 0.5) * 0.5),
                life: 1.5 + Math.random() * 1.0,
                color: [1.0, 0.8, 0.0], // Vàng óng
                type: 'fire'
            });
        }
    });

    // Draw Final Red Key (Chìa khóa đỏ rơi)
    if (STATE.finalPaper && STATE.finalPaper.active && !STATE.finalPaper.pickedUp) {
        const bob = Math.sin(Date.now() / 250) * 0.4;

        // 1. Vẽ chìa khóa đỏ rực rỡ
        gl.uniform3f(locs.emitColor, 1.2, 0.1, 0.1);
        drawMeshActual(ASSETS.redKey, { x: STATE.finalPaper.pos.x, y: STATE.finalPaper.pos.y + bob + 1.0, z: STATE.finalPaper.pos.z }, 12.0, Date.now() / 400);
        gl.uniform3f(locs.emitColor, 0, 0, 0);

        // 2. Vẽ MŨI TÊN KHỔNG LỒ CHỈ XUỐNG CHÌA KHÓA (Tự quay quanh trục Y và chúi đầu thẳng xuống đất)
        let arrowMatrix = M4.translation(STATE.finalPaper.pos.x, STATE.finalPaper.pos.y + bob + 6.5, STATE.finalPaper.pos.z);
        arrowMatrix = M4.multiply(arrowMatrix, M4.rotationY(Date.now() / 200));  // Xoay tròn xung quanh trục đứng Y
        arrowMatrix = M4.multiply(arrowMatrix, M4.rotationX(-Math.PI / 2));     // Quay 90 độ X hướng đầu thẳng xuống đất
        arrowMatrix = M4.multiply(arrowMatrix, M4.scaling(2.5, 2.5, 2.5));       // Kích thước khổng lồ 2.5x cực kỳ nổi bật

        gl.uniform3f(locs.emitColor, 2.0, 0.05, 0.05); // Phát sáng đỏ rực rỡ siêu cấp
        drawMeshRaw(ASSETS.arrow, arrowMatrix);
        gl.uniform3f(locs.emitColor, 0, 0, 0); // Reset emit

        // 3. Tạo hiệu ứng hào quang đỏ (hạt khói đỏ bay lên nhẹ nhàng xung quanh chìa khóa)
        if (Math.random() < 0.35) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.8;
            STATE.particles.push({
                pos: V3.create(STATE.finalPaper.pos.x + Math.cos(angle) * r, STATE.finalPaper.pos.y + bob + 1.0, STATE.finalPaper.pos.z + Math.sin(angle) * r),
                vel: V3.create((Math.random() - 0.5) * 0.4, 5.0 + Math.random() * 4.0, (Math.random() - 0.5) * 0.4),
                life: 1.5 + Math.random() * 1.0,
                color: [1.0, 0.2, 0.2], // Khói đỏ dạ quang
                type: 'fire'
            });
        }
    }

    // Vẽ nhiều mũi tên nhỏ gọn phát sáng từ thân người chơi hướng tới Cánh Cửa Đỏ (càng gần số lượng càng giảm)
    if (STATE.hasRedKey) {
        const pPos = STATE.player.pos;
        const targetX = 0;
        const targetZ = -150;
        const dx = targetX - pPos.x;
        const dz = targetZ - pPos.z;
        const len = Math.sqrt(dx * dx + dz * dz);

        if (len > 3.0) {
            const dirX = dx / len;
            const dirZ = dz / len;
            const ang = Math.atan2(dx, dz) + Math.PI; // Góc xoay chuẩn xác hướng tới cửa

            // Số lượng mũi tên tỷ lệ thuận với khoảng cách (tối đa 8 mũi tên, cách nhau 6 mét, giảm dần khi tiến lại gần)
            const maxArrows = Math.min(8, Math.floor(len / 6.0));
            for (let i = 1; i <= maxArrows; i++) {
                const dist = i * 6.0;
                if (dist < len - 3.0) { // Đảm bảo không vẽ đè sát sàn cửa
                    const ax = pPos.x + dirX * dist;
                    const az = pPos.z + dirZ * dist;
                    const ay = getHeight(ax, az) + 0.15; // Nổi nhẹ trên mặt đất

                    gl.uniform3f(locs.emitColor, 1.0, 0.05, 0.05); // Phát sáng đỏ rực rỡ
                    drawMeshActual(ASSETS.arrow, { x: ax, y: ay, z: az }, 0.8, ang); // Nhỏ gọn (scale 0.8)
                    gl.uniform3f(locs.emitColor, 0, 0, 0); // Trả lại ban đầu
                }
            }
        }
    }

    // Grass:
    if (GRASS_PATCHES.length > 0) {
        gl.disable(gl.CULL_FACE);
        GRASS_PATCHES.forEach(g => {
            const dx = p.pos.x - g.x;
            const dz = p.pos.z - g.z;
            if (dx * dx + dz * dz < 8100) { // 90 units distance culling
                drawMeshActual(ASSETS.grass, { x: g.x, y: g.y, z: g.z }, g.scale, 0);
            }
        });
        gl.enable(gl.CULL_FACE);
    }
    STATE.pads.forEach(p => {
        const mat = makeAlignedMatrix(p.pos, p.normal || V3.create(0, 1, 0), 2);
        drawMeshRaw(ASSETS.pad, mat);
    });

    // Vẽ vật cản (Cây, Nhà, Xe, Cột, Cửa) - Có culling tối ưu cho máy yếu
    STATE.obstacles.forEach(obs => {
        const isRedDoor = obs.type === 'redDoor';
        const dx = p.pos.x - obs.pos.x;
        const dz = p.pos.z - obs.pos.z;
        if (!isRedDoor && (dx * dx + dz * dz > 22500)) return; // 150 units distance culling

        if (obs.type === 'tree') drawMeshActual(ASSETS.tree, obs.pos, obs.scale, 0);
        else if (obs.type === 'house') drawMeshActual(ASSETS.house, obs.pos, obs.scale, obs.rot);
        else if (obs.type === 'car') drawMeshActual(ASSETS.car, obs.pos, obs.scale, obs.rot);
        else if (obs.type === 'debris') drawMeshActual(ASSETS.debris, obs.pos, obs.scale, obs.rot);
        else if (obs.type === 'warningSign') drawMeshActual(ASSETS.warningSign, obs.pos, obs.scale, obs.rot);
        else if (obs.type === 'lampPost') {
            // [PHASE 8] Đèn đỏ chớp tắt dẫn đường ghê rợn dọc Void Path / Landmarks
            const isLit = (Math.floor(performance.now() / 400) % 2 === 0);
            if (isLit) {
                gl.uniform3f(locs.emitColor, 3.5, 0.05, 0.05); // Đỏ dạ quang rực rỡ
            } else {
                gl.uniform3f(locs.emitColor, 0.1, 0.0, 0.0); // Tắt đèn (tối mờ)
            }
            drawMeshActual(ASSETS.lampPost, obs.pos, obs.scale, obs.rot);
            gl.uniform3f(locs.emitColor, 0, 0, 0);
        }
        else if (obs.type === 'pillar') {
            gl.uniform3f(locs.emitColor, 0, 0.5, 0.5); // Kích hoạt Bloom cho rune
            drawMeshActual(ASSETS.pillar, obs.pos, obs.scale, obs.rot);
            gl.uniform3f(locs.emitColor, 0, 0, 0);
        }
        else if (obs.type === 'redDoor') {
            if (STATE.hasRedKey) {
                gl.uniform3f(locs.emitColor, 0.0, 0.0, 0.456); // Magic flag: isRedDoor = true, hasKey = true

                // Spawn các hạt không gian đỏ bay ra từ cánh cửa để mời gọi người chơi
                if (Math.random() < 0.25) {
                    const cosR = Math.cos(obs.rot);
                    const sinR = Math.sin(obs.rot);
                    // Dịch chuyển ngẫu nhiên trên bề mặt phẳng cánh cửa
                    const localX = (Math.random() - 0.5) * 3.0;
                    const localY = Math.random() * 5.0;
                    const worldX = obs.pos.x + localX * cosR;
                    const worldZ = obs.pos.z - localX * sinR;

                    STATE.particles.push({
                        pos: V3.create(worldX, obs.pos.y + localY, worldZ),
                        vel: V3.create(sinR * (2.0 + Math.random() * 3.0), (Math.random() - 0.5) * 0.5, cosR * (2.0 + Math.random() * 3.0)), // Bay ra phía trước cánh cửa
                        life: 1.0 + Math.random() * 0.8,
                        color: [1.2, 0.1, 0.1], // Đỏ dạ quang
                        type: 'fire'
                    });
                }
            } else {
                gl.uniform3f(locs.emitColor, 0.0, 0.0, 0.123); // Magic flag: isRedDoor = true, hasKey = false
            }
            drawMeshActual(ASSETS.redDoor, obs.pos, obs.scale, obs.rot);
            gl.uniform3f(locs.emitColor, 0, 0, 0);
        }
    });

    STATE.loot.forEach(l => {
        let mesh = ASSETS.lootAmmo; // Default Yellow
        if (l.type === 1) mesh = ASSETS.lootHP; // Green
        else if (l.type === 2) mesh = ASSETS.lootArmor; // Blue
        else if (l.type === 3) mesh = ASSETS.lootWeapon; // Orange (Powerup)
        drawMeshActual(mesh, { x: l.pos.x, y: l.pos.y + Math.sin(performance.now() / 200) * 0.2, z: l.pos.z }, 0.5, performance.now() / 1000);
    });

    // Effects & Boss Indicators (Player projectiles = Yellow, Boss = Red)
    STATE.projectiles.forEach(p => {
        if (p.isBoss) {
            gl.uniform3f(locs.emitColor, 2.0, 0.2, 0.2); // Boss = Red glow
            drawMeshActual(ASSETS.bossProj, p.pos, 1, 0);
            gl.uniform3f(locs.emitColor, 0, 0, 0);
        } else {
            gl.uniform3f(locs.emitColor, 1.2, 1.2, 0.2); // Player = Yellow glow
            drawMeshActual(ASSETS.crate, p.pos, 0.2, 0);
            gl.uniform3f(locs.emitColor, 0, 0, 0);
        }
    });
    // [ĐÃ XÓA] Không render particles nữa - tránh hộp bay gây khó chịu
    // spawnParticles() vẫn chạy cho camera shake / gameplay logic nhưng không vẽ gì
    gl.uniform3f(locs.emitColor, 0, 0, 0); // Reset emissive
    gl.uniform3f(locs.fogColor, fogCol[0], fogCol[1], fogCol[2]);

    // Boss Rendering
    if (STATE.boss && STATE.boss.active) {
        const b = STATE.boss;
        const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z;
        const ang = Math.atan2(dx, dz);

        let bossEmitCol = [0.45, 0.1, 0.1];
        if (b.state === 'dying') {
            if (b.deathTimer > 2.0) {
                bossEmitCol = [0.45, 0.1, 0.1];
            } else {
                const intensity = (2.0 - b.deathTimer) / 2.0; // 0 to 1
                const flash = Math.abs(Math.sin(performance.now() * 0.02)) * 0.5 + 0.5;
                const r = 0.45 + intensity * 4.0 * flash;
                const g = 0.1 + intensity * 0.8 * flash;
                const bVal = 0.1 + intensity * 0.8 * flash;
                bossEmitCol = [r, g, bVal];
            }
        }

        // Boss Body (Static for spectators)
        let mBody = M4.translation(b.pos.x, b.pos.y + b.bodyY, b.pos.z);
        mBody = M4.multiply(mBody, M4.rotationY(b.rotY || ang));
        mBody = M4.multiply(mBody, M4.rotationX(b.bodyRot));

        // === STENCIL: Vẽ Boss Body trước, đánh dấu stencil ===
        gl.enable(gl.STENCIL_TEST);
        gl.clear(gl.STENCIL_BUFFER_BIT);
        gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.stencilMask(0xFF);

        // 1. Vẽ Boss Body bình thường (ghi stencil = 1)
        gl.uniform3f(locs.emitColor, bossEmitCol[0], bossEmitCol[1], bossEmitCol[2]);
        gl.uniformMatrix4fv(locs.model, false, mBody);
        gl.bindVertexArray(ASSETS.bossBody.vao);
        gl.drawArrays(gl.TRIANGLES, 0, ASSETS.bossBody.count);
        gl.uniform3f(locs.emitColor, 0, 0, 0);

        // 2. Vẽ Outline chỉ ở nơi stencil != 1 (không xuyên qua chính thân Boss)
        gl.stencilFunc(gl.NOTEQUAL, 1, 0xFF);
        gl.stencilMask(0x00);
        gl.disable(gl.DEPTH_TEST);
        gl.cullFace(gl.FRONT);
        gl.uniform3f(locs.emitColor, 5.0, 5.0, 5.0);
        let mBodyOutline = M4.multiply(mBody, M4.scaling(1.05, 1.05, 1.05));
        gl.uniformMatrix4fv(locs.model, false, mBodyOutline);
        gl.bindVertexArray(ASSETS.bossBody.vao);
        gl.drawArrays(gl.TRIANGLES, 0, ASSETS.bossBody.count);
        gl.cullFace(gl.BACK);
        gl.enable(gl.DEPTH_TEST);
        gl.uniform3f(locs.emitColor, 0, 0, 0);
        gl.disable(gl.STENCIL_TEST);

        // Hiệu ứng tụ năng lượng ở ngực (Chiêu 2)
        if (b.state === 'shoot_prepare' || b.state === 'shooting') {
            const pulse = 0.8 + Math.sin(performance.now() * 0.02) * 0.2;
            gl.uniform3f(locs.emitColor, 1.5, 0.6, 0); // Cam rực (Emissive)
            let mChest = M4.multiply(mBody, M4.translation(0, 16, 3));
            mChest = M4.multiply(mChest, M4.scaling(3 * pulse, 3 * pulse, 3 * pulse));
            drawMeshRaw(ASSETS.crate, mChest);
            gl.uniform3f(locs.emitColor, 0, 0, 0);
        }

        // Boss Arms - HIỆU ỨNG TAY TÙY BIẾN CHO CẢ 5 SKILL
        const drawArm = (side) => {
            let armScale = 1.0;
            let armColor = null;
            let lift = b.armLift || 0;
            let forward = 0;

            // Skill 2: SHOOT (Bắn) - Hai tay đưa về phía trước nhắm bắn
            if (b.state === 'shoot_prepare' || b.state === 'shooting') {
                lift = Math.PI * 0.45;
                forward = 1.5;
            }
            // Skill 3: JUMP (Nhảy dậm) - Cả 3 giai đoạn tay đều to và đỏ
            else if (b.state === 'jump_start' || b.state === 'jumping' || b.state === 'recover') {
                armScale = 2.0; armColor = [1.5, 0, 0];
            }
            // Skill 4: PILLAR (Cột máu) - Hai tay hóa đỏ, giơ thẳng lên trời
            else if (b.state === 'pillar_prepare') {
                armColor = [1.5, 0, 0];
                lift = -Math.PI * 0.7; // Giơ tay lên trời vừa phải
            }
            // Skill 5: TELEPORT STRIKE (Chìm/Trồi đập) - Tay phải đập cực mạnh
            else if (b.state === 'teleport_strike') {
                if (side === 1) { // Tay phải
                    armColor = [2.0, 0, 0];
                    armScale = b.skillCD > 1.0 ? 1.3 : 1.8;
                    lift = b.armLift; // Sử dụng giá trị b.armLift từ AI (mượt mà)
                } else { // Tay trái hạ xuống tự nhiên
                    lift = 0.5; // Hơi đưa ra sau lưng
                }
            } else if (b.state === 'teleport_start') {
                lift = b.armLift; // Cả hai tay giơ lên khi chìm xuống
            }

            // Gắn chặt tay vào vai (Kế thừa vị trí và góc nghiêng của thân)
            let mArm = M4.translation(b.pos.x, b.pos.y + b.bodyY, b.pos.z);
            mArm = M4.multiply(mArm, M4.rotationY(b.rotY || ang));
            mArm = M4.multiply(mArm, M4.rotationX(b.bodyRot)); // Thân gập, vai gập theo
            mArm = M4.multiply(mArm, M4.translation(side * 3.5, 16, forward)); // Gắn chết vào khớp vai (có hỗ trợ vươn tay forward)
            mArm = M4.multiply(mArm, M4.rotationX(lift)); // Cử động cánh tay từ khớp vai
            mArm = M4.multiply(mArm, M4.scaling(armScale, armScale, armScale)); // Phóng to cánh tay từ khớp
            // === STENCIL: Vẽ Arm trước, đánh dấu stencil ===
            gl.enable(gl.STENCIL_TEST);
            gl.clear(gl.STENCIL_BUFFER_BIT);
            gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
            gl.stencilMask(0xFF);

            // 1. Vẽ Boss Arm bình thường (ghi stencil = 1)
            if (armColor) {
                gl.uniform3f(locs.emitColor, armColor[0], armColor[1], armColor[2]);
            } else {
                gl.uniform3f(locs.emitColor, bossEmitCol[0], bossEmitCol[1], bossEmitCol[2]);
            }
            gl.uniformMatrix4fv(locs.model, false, mArm);
            gl.bindVertexArray(ASSETS.bossArm.vao); gl.drawArrays(gl.TRIANGLES, 0, ASSETS.bossArm.count);
            gl.uniform3f(locs.emitColor, 0, 0, 0);

            // 2. Vẽ Outline chỉ ở nơi stencil != 1 (không xuyên qua chính thân Arm)
            gl.stencilFunc(gl.NOTEQUAL, 1, 0xFF);
            gl.stencilMask(0x00);
            gl.disable(gl.DEPTH_TEST);
            gl.cullFace(gl.FRONT);
            gl.uniform3f(locs.emitColor, 5.0, 5.0, 5.0);
            let mArmOutline = M4.multiply(mArm, M4.scaling(1.08, 1.08, 1.08));
            gl.uniformMatrix4fv(locs.model, false, mArmOutline);
            gl.bindVertexArray(ASSETS.bossArm.vao);
            gl.drawArrays(gl.TRIANGLES, 0, ASSETS.bossArm.count);
            gl.cullFace(gl.BACK);
            gl.enable(gl.DEPTH_TEST);
            gl.uniform3f(locs.emitColor, 0, 0, 0);
            gl.disable(gl.STENCIL_TEST);
        };
        drawArm(-1); drawArm(1);

        // Ground Indicators - ONLY FOR PLAYER
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
        gl.uniform3f(locs.fogColor, 0.6 + Math.sin(Date.now() * 0.015) * 0.4, 0, 0);

        if (b.indicatorMesh) {
            gl.uniformMatrix4fv(locs.model, false, M4.identity());
            gl.bindVertexArray(b.indicatorMesh.vao);
            gl.drawArrays(gl.TRIANGLES, 0, b.indicatorMesh.count);
        }
        if (b.fanMesh && b.state === 'teleport_strike' && b.skillCD > 0.8) {
            gl.uniformMatrix4fv(locs.model, false, M4.identity());
            gl.bindVertexArray(b.fanMesh.vao);
            gl.drawArrays(gl.TRIANGLES, 0, b.fanMesh.count);
        }
        if (b.dashMesh && (b.state === 'dash_prepare' || b.state === 'dashing' || b.state === 'shoot_prepare')) {
            gl.uniformMatrix4fv(locs.model, false, M4.identity());
            gl.bindVertexArray(b.dashMesh.vao);
            gl.drawArrays(gl.TRIANGLES, 0, b.dashMesh.count);
        }
        b.pillarSpots.forEach(s => {
            if (!s.active && s.mesh) {
                gl.uniformMatrix4fv(locs.model, false, M4.identity());
                gl.bindVertexArray(s.mesh.vao);
                gl.drawArrays(gl.TRIANGLES, 0, s.mesh.count);
            } else if (s.active) {
                gl.uniform3f(locs.fogColor, 1, 0, 0);
                const mMat = M4.multiply(M4.translation(s.x, s.h - 1, s.z), M4.scaling(4, 25, 4));
                gl.uniformMatrix4fv(locs.model, false, mMat);
                gl.bindVertexArray(ASSETS.crate.vao); gl.drawArrays(gl.TRIANGLES, 0, ASSETS.crate.count);
            }
        });
        gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);


        // RESET TRẠNG THÁI RENDER
        gl.uniform3f(locs.fogColor, fogCol[0], fogCol[1], fogCol[2]);
    }

    // -------------------------------------------------------------
    // Vẽ BOTS (Vẽ sau cùng để hỗ trợ viền trắng xuyên qua TẤT CẢ vật thể như Cây, Nhà, Đá...)
    // -------------------------------------------------------------
    STATE.bots.forEach(b => {
        const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z, ang = Math.atan2(dx, dz);

        const botCount = STATE.bots.length;
        const initialCount = STATE.config.botCount || 25;
        const isLv2 = botCount <= initialCount * (window.GAME_CONFIG.bot.enrageLv2Pct || 0.40);
        const isLv3 = botCount <= (window.GAME_CONFIG.bot.lv3Count || 5);

        let mesh = ASSETS.bot;
        let scale = 1.0;
        let drawPos = { ...b.pos };

        if (b.isEvolvingLv3) {
            const pulse = (Math.sin(performance.now() * 0.05) > 0) ? 2.0 : 0.0;
            gl.uniform3f(locs.fogColor, pulse, pulse * 0.5, pulse * 0.5);
            drawPos.x += (Math.random() - 0.5) * 0.4;
            drawPos.z += (Math.random() - 0.5) * 0.4;
            scale = 1.0 + (2.0 - Math.max(0, b.evolveTimer)) * 0.5;
            mesh = ASSETS.botEnraged;
        } else if (isLv3) {
            mesh = ASSETS.botFinal;
            scale = 2.0;
        } else if (isLv2) {
            mesh = ASSETS.botEnraged;
            scale = 1.15; // Chỉ cao hơn dạng 1 chút thôi
        }

        // === STENCIL: Vẽ Bot trước, đánh dấu stencil ===
        gl.enable(gl.STENCIL_TEST);
        gl.clear(gl.STENCIL_BUFFER_BIT);
        gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.stencilMask(0xFF);

        // 1. Vẽ Bot bình thường trước (ghi stencil = 1)
        let emitVal = isLv3 ? [0.85, 0.2, 0.2] : (isLv2 ? [0.5, 0.25, 0.25] : [0.4, 0.1, 0.1]);
        gl.uniform3f(locs.emitColor, emitVal[0], emitVal[1], emitVal[2]);
        drawMeshActual(mesh, drawPos, scale, ang);
        gl.uniform3f(locs.emitColor, 0, 0, 0);

        // 2. Vẽ Outline chỉ ở nơi stencil != 1 (xuyên vật cản nhưng KHÔNG xuyên chính thân Bot)
        gl.stencilFunc(gl.NOTEQUAL, 1, 0xFF);
        gl.stencilMask(0x00);
        gl.disable(gl.DEPTH_TEST);
        gl.cullFace(gl.FRONT);
        gl.uniform3f(locs.emitColor, 5.0, 5.0, 5.0);
        drawMeshActual(mesh, drawPos, scale * 1.08, ang);
        gl.cullFace(gl.BACK);
        gl.enable(gl.DEPTH_TEST);
        gl.uniform3f(locs.emitColor, 0, 0, 0);
        gl.disable(gl.STENCIL_TEST);

        if (b.isEvolvingLv3) gl.uniform3f(locs.fogColor, fogCol[0], fogCol[1], fogCol[2]);
    });






    // Draw View Model (Arms + Current Weapon)
    if (STATE.screen === 'game') {
        gl.clear(gl.DEPTH_BUFFER_BIT);
        let weaponMesh = [ASSETS.pistol, ASSETS.smg, ASSETS.sniper][p.weaponIdx];
        if (p.isChargingUlti) weaponMesh = ASSETS.cannon;
        if (STATE.hasRedKey) weaponMesh = ASSETS.redKey;

        // Phase 5: Weapon animation system
        const _wa = STATE.weaponAnim;
        const _t = performance.now() * 0.001;
        const _isMoving = (STATE.keys['KeyW'] || STATE.keys['KeyS'] || STATE.keys['KeyA'] || STATE.keys['KeyD']);
        const _walkSpeed = _isMoving ? 1.0 : 0.0;
        _wa.bobPhase += _walkSpeed * 0.15;
        _wa.swayX += (Math.sin(_t * 0.9) * 0.018 + (_isMoving ? Math.sin(_wa.bobPhase * 7) * 0.025 : 0) - _wa.swayX) * 0.12;
        _wa.swayY += (Math.abs(Math.sin(_wa.bobPhase * 7)) * (_isMoving ? 0.022 : 0) + Math.sin(_t * 1.3) * 0.010 - _wa.swayY) * 0.12;
        _wa.recoilZ += (0 - _wa.recoilZ) * 0.22; // Spring back from recoil
        if (p.recoil > 0.05) _wa.recoilZ = Math.min(_wa.recoilZ + p.recoil * 0.08, 0.12);

        const bob = _wa.swayY; // Use animated bob instead of simple sin
        const kick = p.recoil * 0.4 + _wa.recoilZ;
        const vmProj = M4.perspective(fov, aspect, 0.01, 10);
        gl.uniformMatrix4fv(locs.proj, false, vmProj);
        gl.uniformMatrix4fv(locs.view, false, M4.identity());

        // Free Fire style scope for ALL weapons
        const isFFScope = STATE.aimLerp > 0.9;

        const scopeEl = document.getElementById('scope-overlay');

        if (isFFScope) {
            scopeEl.style.display = 'block';
            scopeEl.style.opacity = (STATE.aimLerp - 0.9) * 10;
        } else {
            scopeEl.style.display = 'none';
        }

        // Ẩn vũ khí khi đang trong animation ngồi dậy
        const _isStandingUp = (p.standUpTimer || 0) > 0;

        if (!isFFScope && !_isStandingUp) {
            // Anim rút súng (Equip animation)
            const equipOffset = (1.0 - Math.min(1.0, p.weaponSwitchTime)) * 0.5;

            // === ANIMATION NẠP ĐẠN ===
            // Phase 1 (2.0→1.2): Hạ súng xuống + xoay ra ngoài (tháo băng đạn)
            // Phase 2 (1.2→0.5): Đẩy súng vào + xoay ngược (lắp băng đạn mới)
            // Phase 3 (0.5→0.0): Súng trở về + bounce (kéo cơ / ready)
            let reloadDropY = 0, reloadTiltX = 0, reloadTiltZ = 0;
            if (p.isReloading) {
                const rt = Math.max(0, p.reloadTimer || 0);
                if (rt > 1.2) {
                    const t1 = (rt - 1.2) / 0.8;
                    reloadDropY = t1 * 0.30;
                    reloadTiltX = t1 * 0.60;
                    reloadTiltZ = t1 * 0.40;
                } else if (rt > 0.5) {
                    const t2 = (rt - 0.5) / 0.7;
                    reloadDropY = 0.04 + t2 * 0.10;
                    reloadTiltX = -t2 * 0.28;
                    reloadTiltZ = t2 * 0.14;
                } else {
                    const t3 = rt / 0.5;
                    reloadDropY = t3 * 0.04;
                    reloadTiltX = 0;
                    reloadTiltZ = 0;
                }
            }

            // Right Arm
            let armX = 0.35 - STATE.aimLerp * 0.35;
            let armY = -0.4 + bob + STATE.aimLerp * 0.05 - equipOffset - reloadDropY;
            let mArm = M4.translation(armX, armY, -0.5);
            mArm = M4.multiply(mArm, M4.rotationY(-0.3 * (1 - STATE.aimLerp)));
            if (p.isReloading) mArm = M4.multiply(mArm, M4.rotationX(reloadTiltX * 0.5));
            drawMeshRaw(ASSETS.arm, mArm);

            // Weapon ADS Positioning
            let targetWepY = -0.12;
            if (p.weaponIdx === 1) targetWepY = -0.15;
            if (p.weaponIdx === 2) targetWepY = -0.25;
            if (STATE.hasRedKey) targetWepY = -0.15;

            let wepX = STATE.hasRedKey ? 0.35 : (0.25 - STATE.aimLerp * 0.25);
            let wepY = STATE.hasRedKey ? (-0.38 + bob - equipOffset) : (-0.3 + bob + STATE.aimLerp * (targetWepY + 0.3) - equipOffset - reloadDropY);
            let wepZ = STATE.hasRedKey ? -0.52 : (-0.6 - kick - STATE.aimLerp * 0.2);
            let mWep = M4.translation(wepX, wepY, wepZ);

            if (STATE.hasRedKey) {
                // Cầm thẳng tiến về phía trước từ tay phải của người chơi, nằm chính xác trên phần tay trắng
                mWep = M4.multiply(mWep, M4.rotationY(-0.15)); // Xoay nhẹ sang trái để lộ rõ răng cưa chìa khóa
                mWep = M4.multiply(mWep, M4.rotationX(0.0));   // Cầm thẳng tắp về phía trước, không hướng lên trên
                mWep = M4.multiply(mWep, M4.scaling(3.8, 3.8, 3.8)); // Phóng to đáng kể, gần bằng kích thước lúc rớt
            } else {
                mWep = M4.multiply(mWep, M4.rotationY(-0.15 * (1 - STATE.aimLerp)));
                if (STATE.aimLerp < 0.9) mWep = M4.multiply(mWep, M4.rotationX(0.05 * (1 - STATE.aimLerp)));
                if (p.isReloading) {
                    mWep = M4.multiply(mWep, M4.rotationX(reloadTiltX));
                    mWep = M4.multiply(mWep, M4.rotationY(reloadTiltZ));
                }
                mWep = M4.multiply(mWep, M4.scaling(1 + STATE.aimLerp * 0.1, 1 + STATE.aimLerp * 0.1, 1 + STATE.aimLerp * 0.1));
            }
            drawMeshRaw(weaponMesh, mWep);
        }


    }


    drawMinimap(p, STATE.bots);

    // --- THREE.JS Render Update ---
    if (window.scene && window.renderer) {
        try {
            // Sương mù + background
            window.scene.fog = new THREE.FogExp2(new THREE.Color(fogCol[0], fogCol[1], fogCol[2]), 0.003);
            window.scene.background = new THREE.Color(bgCol[0], bgCol[1], bgCol[2]);

            // 1. Render main scene
            if (window.composer) {
                window.composer.render();
            } else {
                window.renderer.render(window.scene, window.camera);
            }

            // 2. Render viewmodel (arm + weapon) trên cùng với depth riêng
            if (window.vmScene && window.vmCamera) {
                window.vmCamera.fov = fov * (180 / Math.PI);
                window.vmCamera.aspect = aspect;
                window.vmCamera.updateProjectionMatrix();
                window.renderer.autoClear = false;
                window.renderer.clearDepth();
                window.renderer.render(window.vmScene, window.vmCamera);
                window.renderer.autoClear = true;
            }
        } catch (e) {
            console.error("RENDER ERROR:", e);
        }
    }
}

function drawMinimap(p, bots) {
    const canvas = document.getElementById('minimap');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const scale = w / MAP_SIZE;
    const cx = w / 2, cy = h / 2;
    const yaw = STATE.camera.rot.y;

    ctx.save();

    // Tạo clip viền tròn cho minimap (phong cách Cosmic Void)
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "rgba(5, 10, 20, 0.8)"; // Tím đen obsidian
    ctx.fill();

    // Dịch tâm về chính giữa, quay map ngược chiều góc nhìn, sau đó tịnh tiến về vị trí người chơi
    ctx.translate(cx, cy);
    ctx.rotate(-yaw);
    ctx.translate(-p.pos.x * scale, -p.pos.z * scale);

    // Vẽ viền map thực tế
    ctx.strokeStyle = "rgba(255, 60, 60, 0.24)";
    ctx.lineWidth = 2;
    const mapRenderSize = MAP_SIZE * scale;
    ctx.strokeRect(-mapRenderSize / 2, -mapRenderSize / 2, mapRenderSize, mapRenderSize);

    // Vẽ quân địch (Chấm đỏ kinh dị, không hiển thị ID)
    ctx.fillStyle = "rgba(255, 30, 40, 0.95)";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(255, 40, 60, 0.45)";
    bots.forEach(b => {
        if (b.hp <= 0) return;
        ctx.beginPath();
        ctx.arc(b.pos.x * scale, b.pos.z * scale, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 80, 80, 0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    if (STATE.boss && STATE.boss.active) {
        ctx.fillStyle = "#9900ff";
        ctx.shadowBlur = 15; ctx.shadowColor = "#9900ff";
        ctx.beginPath();
        ctx.arc(STATE.boss.pos.x * scale, STATE.boss.pos.z * scale, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // Vẽ mũi tên người chơi cố định ở giữa màn hình chỉ lên trên
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#00f3ff";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00f3ff";
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(-8, 8); ctx.lineTo(0, 4); ctx.lineTo(8, 8); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Viền minimap tĩnh
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 80, 80, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
}


function showGlobalAnnouncement(text, duration = 3000) {
    const el = document.getElementById('global-announcement');
    if (!el) return;
    el.innerText = text;
    el.classList.add('show');
    setTimeout(() => {
        el.classList.remove('show');
    }, duration);
}

function updateHUD() {
    const p = STATE.player, hpPercent = Math.max(0, (p.hp / p.maxHp) * 100), armorPercent = Math.max(0, (p.armor / p.maxArmor) * 100);

    // [YÊU CẦU] Xử lý nháy đỏ khi mất máu - Đã tắt hiệu ứng này
    // const overlay = document.getElementById('damage-overlay');
    // if (overlay) {
    //     if (p.damageFlash > 0) {
    //         const hpRatio = 1.0 - (p.hp / p.maxHp);
    //         const intensity = p.damageFlash * (0.3 + hpRatio * 0.4);
    //         overlay.style.display = 'block';
    //         overlay.style.opacity = Math.min(0.6, intensity);
    //         overlay.style.background = `radial-gradient(circle, transparent 20%, rgba(${150 + hpRatio * 105}, 0, 0, 0.7) 100%)`;
    //     } else {
    //         overlay.style.display = 'none';
    //     }
    // }

    document.getElementById('health-fill').style.width = hpPercent + '%';
    document.getElementById('armor-fill').style.width = armorPercent + '%';
    // Hiển thị số máu trong thanh HP
    const hpTextEl = document.getElementById('health-hp-text');
    if (hpTextEl) hpTextEl.innerText = Math.ceil(p.hp) + ' / ' + p.maxHp;
    document.getElementById('ammo-current').innerText = STATE.weapons[p.weaponIdx].ammo; document.getElementById('ammo-reserve').innerText = STATE.weapons[p.weaponIdx].res;
    document.getElementById('weapon-name').innerText = STATE.weapons[p.weaponIdx].name.toUpperCase();
    document.getElementById('alive-count').innerText = "CÒN SỐNG: " + (STATE.bots.length + 1);
    document.getElementById('kill-count').innerText = "KILLS: " + p.kills;


    const btnKillBoss = document.getElementById('kill-last-bot-btn');
    if (btnKillBoss) {
        if (!STATE.bossTriggered && STATE.bots.length > 0 && STATE.bots.length <= 3) {
            btnKillBoss.style.display = 'block';
            btnKillBoss.innerText = `TRIỆU HỒI BOSS (${STATE.bots.length} BOT CÒN LẠI)`;
        } else {
            btnKillBoss.style.display = 'none';
        }
    }

    const btnUlti = document.getElementById('btn-ulti');
    if (btnUlti) {
        if (!STATE.player.alive || typeof p.damageDealt !== 'number' || p.damageDealt < (window.GAME_CONFIG?.ultimate?.requiredDamage || 500)) {
            btnUlti.classList.add('hidden');
        } else {
            btnUlti.classList.remove('hidden');
        }
    }

    // [CẬP NHẬT] Thanh Máu trên đầu Bot
    STATE.bots.forEach((b) => {
        if (b.hp <= 0) {
            if (b.uiBar) b.uiBar.style.display = 'none';
            return;
        }

        if (!b.uiBar) {
            b.uiBar = document.createElement('div');
            b.uiBar.style.position = 'absolute';
            b.uiBar.style.width = '30px';
            b.uiBar.style.height = '4px';
            b.uiBar.style.background = 'rgba(0,0,0,0.6)';
            b.uiBar.style.border = '1px solid #00f3ff';
            b.uiBar.style.pointerEvents = 'none';
            b.uiBar.style.transform = 'translate(-50%, -50%)';
            b.uiBar.style.zIndex = '50';

            b.uiFill = document.createElement('div');
            b.uiFill.style.height = '100%';
            b.uiFill.style.background = '#ff0033';
            b.uiBar.appendChild(b.uiFill);

            // Không hiển thị nhãn P-X cho bot nữa

            document.getElementById('ui-layer').appendChild(b.uiBar);
        }

        const dx = p.pos.x - b.pos.x;
        const dz = p.pos.z - b.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 80) {
            b.uiBar.style.display = 'none';
            return;
        }

        // Project position to screen (above the bot's head)
        const screenPos = project3DToScreen(V3.create(b.pos.x, b.pos.y + 2.0, b.pos.z));
        if (screenPos) {
            b.uiBar.style.display = 'block';
            b.uiBar.style.left = screenPos.x + 'px';
            b.uiBar.style.top = screenPos.y + 'px';
            const maxHp = (b.isEvolvingLv3) ? window.GAME_CONFIG.bot.hpLv3 : window.GAME_CONFIG.bot.hpLv1;
            b.uiFill.style.width = Math.min(100, (b.hp / maxHp) * 100) + '%';
            b.uiBar.style.opacity = Math.max(0, 1 - (dist / 80));
        } else {
            b.uiBar.style.display = 'none';
        }
    });

    // CẢNH BÁO CUỒNG BẠO — dùng đúng ngưỡng theo độ khó
    const _bc = STATE.bots.length;
    const _total = STATE.config.botCount || 25;
    const _enragePct = window.GAME_CONFIG.bot.enrageLv2Pct || 0.40;
    const _lv3Count = window.GAME_CONFIG.bot.lv3Count || 5;
    const _lv2Thresh = Math.round(_total * _enragePct);

    // Lv2: Cuồng Bạo
    if (!STATE.enragedAnnounced && _bc > 0 && _bc <= _lv2Thresh) {
        const pct = Math.round(_enragePct * 100);
        showGlobalAnnouncement(`⚠️ CẢNH BÁO: ${_bc} QUÁI VẬT HÓA CUỒNG BẠO! (${pct}% còn lại)`, 4000);
        STATE.enragedAnnounced = true;
        STATE.shake = 5.0;
    }

    // Lv3: Giai đoạn cuối — thông báo riêng
    if (!STATE.finalAnnounced && _bc > 0 && _bc <= _lv3Count) {
        showGlobalAnnouncement(`💀 GIAI ĐOẠN CUỐI: ${_bc} CON CUỐI CÙNG — SIÊU NGUY HIỂM!`, 5000);
        STATE.finalAnnounced = true;
        STATE.shake = 8.0;
    }
}

function activateUltimate() {
    const p = STATE.player;
    if (p.damageDealt < window.GAME_CONFIG.ultimate.requiredDamage || p.isChargingUlti) return;

    p.isChargingUlti = true;
    p.isInvincible = true; // Bất tử NGAY LẬP TỨC khi bắt đầu gồng
    p.damageDealt = 0; // Reset điểm
    if (window.QuestManager) window.QuestManager.onEvent('use_ultimate', 1);
    showGlobalAnnouncement("🔥 ĐANG GỒM ĐẠI BÁC... 🔥", 1000);
    STATE.shake = 1.0; // Rung nhẹ khi gồng

    // Gồng 1s
    setTimeout(() => {
        p.isChargingUlti = false;

        // Bắn đại bác
        const yaw = STATE.camera.rot.y, pitch = STATE.camera.rot.x;
        const dir = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };

        const proj = {
            pos: V3.add(p.pos, V3.create(0, 1.2, 0)),
            dir: dir,
            dmg: window.GAME_CONFIG.ultimate.damage,
            life: 3, dead: false, isPlayer: true, isUlti: true
        };
        STATE.projectiles.push(proj);
        playAudio('shoot');
        STATE.shake = 5.0; // Rung cực mạnh khi bắn

        // Bất tử thêm 1s sau khi bắn để an toàn
        setTimeout(() => {
            p.isInvincible = false;
        }, window.GAME_CONFIG.ultimate.invincibleTime * 1000);

    }, window.GAME_CONFIG.ultimate.chargeTime * 1000);
}



// ============================================================
// PHASE 3 & 4: VFX UPGRADE FUNCTIONS
// ============================================================

// Muzzle flash — orange particles + screen glow
function spawnMuzzleFlash(playerPos, cameraRot) {
    // Disabled visual muzzle flash and yellow smoke for cleaner shooting.
    if (!playerPos || STATE.screen !== 'game') return;
    STATE.muzzleFlashTime = 0;
}

// Blood splatter — realistic red particle burst
function spawnBloodSplatter(pos, count) {
    count = count || 15;
    if (STATE.particles.length > 800) return; // Performance guard
    for (let i = 0; i < count; i++) {
        const speed = 1.5 + Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        const upVel = Math.random() * 4.5;
        STATE.particles.push({
            pos: V3.create(pos.x + (Math.random() - 0.5) * 0.4, pos.y + 0.4 + Math.random() * 0.6, pos.z + (Math.random() - 0.5) * 0.4),
            vel: V3.create(Math.cos(angle) * speed, upVel, Math.sin(angle) * speed),
            life: 0.35 + Math.random() * 0.45,
            color: [0.75 + Math.random() * 0.25, 0.0, 0.0], type: 'fire'
        });
    }
}

// Headshot special effect — golden + blood burst
function spawnHeadshotEffect(pos) {
    const count = isMobile ? 12 : 22;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 6;
        STATE.particles.push({
            pos: V3.create(pos.x, pos.y + 1.6, pos.z),
            vel: V3.create(Math.cos(angle) * speed, Math.random() * 5 - 0.5, Math.sin(angle) * speed),
            life: 0.4 + Math.random() * 0.45,
            color: [1.0, 0.88, 0.0], type: 'fire' // Gold
        });
    }
    spawnBloodSplatter({ x: pos.x, y: pos.y + 1.6, z: pos.z }, isMobile ? 6 : 10);
    STATE.hitPause = 0.025; // 25ms freeze for impact feel
    showHeadshotText();
    playAudio('headshot');
}

// Headshot CSS text pop
function showHeadshotText() {
    const el = document.getElementById('headshot-text');
    if (!el) return;
    el.classList.add('show');
    clearTimeout(window._hsTimer);
    window._hsTimer = setTimeout(() => el.classList.remove('show'), 700);
}

// Directional damage indicator
function showDamageDirection(sourcePos) {
    return; // Đã tắt hoàn toàn theo yêu cầu người chơi
    const el = document.getElementById('damage-directional');
    if (!el) return;
    const dx = sourcePos.x - STATE.player.pos.x;
    const dz = sourcePos.z - STATE.player.pos.z;
    const worldAngle = Math.atan2(dx, -dz);
    const screenAngle = worldAngle - STATE.camera.rot.y;
    const deg = ((screenAngle * 180 / Math.PI) + 360) % 360;
    el.style.setProperty('--dmg-angle', deg + 'deg');
    el.style.opacity = '1';
    clearTimeout(window._dmgDirTimer);
    window._dmgDirTimer = setTimeout(() => { if (el) el.style.opacity = '0'; }, 900);
}

// ============================================================

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const AudioCtx = AudioContextClass ? new AudioContextClass() : null;
function playAudio(type) {
    if (!AudioCtx) return;
    if (AudioCtx.state === 'suspended') AudioCtx.resume();
    const osc = AudioCtx.createOscillator(), gain = AudioCtx.createGain(); osc.connect(gain); gain.connect(AudioCtx.destination); const now = AudioCtx.currentTime;
    if (type === 'shoot') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(900, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.12); gain.gain.setValueAtTime(0.28, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12); osc.start(now); osc.stop(now + 0.12); }
    else if (type === 'hit') { osc.type = 'square'; osc.frequency.setValueAtTime(280, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.12); gain.gain.setValueAtTime(0.18, now); gain.gain.linearRampToValueAtTime(0, now + 0.12); osc.start(now); osc.stop(now + 0.12); }
    else if (type === 'headshot') { osc.type = 'square'; osc.frequency.setValueAtTime(1400, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.08); gain.gain.setValueAtTime(0.22, now); gain.gain.linearRampToValueAtTime(0, now + 0.12); osc.start(now); osc.stop(now + 0.15); }
    else if (type === 'pickup') { osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.linearRampToValueAtTime(880, now + 0.12); gain.gain.setValueAtTime(0.12, now); osc.start(now); osc.stop(now + 0.18); }
    else if (type === 'jump') { osc.type = 'triangle'; osc.frequency.setValueAtTime(130, now); osc.frequency.linearRampToValueAtTime(320, now + 0.22); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.22); }
    else if (type === 'reload') {
        // Âm thanh nạp đạn 3 giai đoạn (Web Audio synthesized)
        // Giai đoạn 1 (t=0): Tiếng "rắc" tháo băng đạn ra — white noise ngắn + click
        const buf1 = AudioCtx.createBuffer(1, AudioCtx.sampleRate * 0.08, AudioCtx.sampleRate);
        const d1 = buf1.getChannelData(0);
        for (let i = 0; i < d1.length; i++) d1[i] = (Math.random() * 2 - 1) * (1 - i / d1.length);
        const src1 = AudioCtx.createBufferSource(); src1.buffer = buf1;
        const g1 = AudioCtx.createGain(); g1.gain.setValueAtTime(0.22, now); g1.gain.linearRampToValueAtTime(0, now + 0.08);
        src1.connect(g1); g1.connect(AudioCtx.destination); src1.start(now);

        // Giai đoạn 2 (t=0.75): Tiếng "cạch" lắp băng mới vào — click + tone thấp
        const o2 = AudioCtx.createOscillator(); const g2 = AudioCtx.createGain();
        o2.type = 'square'; o2.frequency.setValueAtTime(320, now + 0.75); o2.frequency.exponentialRampToValueAtTime(90, now + 0.82);
        g2.gain.setValueAtTime(0.0, now + 0.75); g2.gain.linearRampToValueAtTime(0.20, now + 0.76); g2.gain.linearRampToValueAtTime(0, now + 0.82);
        o2.connect(g2); g2.connect(AudioCtx.destination); o2.start(now + 0.75); o2.stop(now + 0.82);

        // Tiếng noise ngắn kèm theo
        const buf2 = AudioCtx.createBuffer(1, AudioCtx.sampleRate * 0.06, AudioCtx.sampleRate);
        const d2 = buf2.getChannelData(0);
        for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() * 2 - 1) * (1 - i / d2.length);
        const src2 = AudioCtx.createBufferSource(); src2.buffer = buf2;
        const g2b = AudioCtx.createGain(); g2b.gain.setValueAtTime(0.18, now + 0.75); g2b.gain.linearRampToValueAtTime(0, now + 0.81);
        src2.connect(g2b); g2b.connect(AudioCtx.destination); src2.start(now + 0.75);

        // Giai đoạn 3 (t=1.55): Tiếng "cách" kéo cơ — metallic click cao
        const o3 = AudioCtx.createOscillator(); const g3 = AudioCtx.createGain();
        o3.type = 'sawtooth'; o3.frequency.setValueAtTime(1200, now + 1.55); o3.frequency.exponentialRampToValueAtTime(300, now + 1.61);
        g3.gain.setValueAtTime(0.0, now + 1.55); g3.gain.linearRampToValueAtTime(0.25, now + 1.555); g3.gain.linearRampToValueAtTime(0, now + 1.61);
        o3.connect(g3); g3.connect(AudioCtx.destination); o3.start(now + 1.55); o3.stop(now + 1.62);

        // Đừng dùng osc / gain mặc định — stop chúng luôn
        osc.start(now); osc.stop(now + 0.001); gain.gain.setValueAtTime(0, now);
    }
}

function playPositionalAudio(type, pos) {
    if (!AudioCtx || !STATE.player.pos) return;
    if (AudioCtx.state === 'suspended') AudioCtx.resume();

    const delta = V3.sub(pos, STATE.player.pos);
    const dist = V3.len(delta);
    const maxRange = 60.0; // Tầm nghe tối đa
    if (dist >= maxRange) return; // Quá xa không nghe thấy gì

    const vol = Math.max(0, 1.0 - dist / maxRange);

    // Tính góc xoay tương đối so với hướng mặt của camera để tạo hiệu ứng Stereo Panning
    const dx = delta.x, dz = delta.z;
    const worldAngle = Math.atan2(dx, -dz);
    const relativeAngle = worldAngle - STATE.camera.rot.y;
    let panVal = Math.sin(relativeAngle); // [-1..1]
    panVal = Math.max(-1.0, Math.min(1.0, panVal));

    const osc = AudioCtx.createOscillator();
    const gain = AudioCtx.createGain();

    // Kết nối panning
    if (AudioCtx.createStereoPanner) {
        const panner = AudioCtx.createStereoPanner();
        panner.pan.setValueAtTime(panVal, AudioCtx.currentTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(AudioCtx.destination);
    } else {
        osc.connect(gain);
        gain.connect(AudioCtx.destination);
    }

    const now = AudioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.25 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    }
    else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
        gain.gain.setValueAtTime(0.15 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
    else if (type === 'boss_warning') {
        // Còi báo động/tiếng hú của boss (siren/howl)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(350, now + 0.5);
        osc.frequency.linearRampToValueAtTime(120, now + 1.0);
        gain.gain.setValueAtTime(0.3 * vol, now);
        gain.gain.linearRampToValueAtTime(0.3 * vol, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.start(now);
        osc.stop(now + 1.2);
    }
    else if (type === 'roar') {
        // Tiếng gầm rú đe dọa từ xa của quái
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(45, now + 0.6);

        // Thêm oscillator layer để tiếng gầm đục và ghê rợn hơn
        const osc2 = AudioCtx.createOscillator();
        const gain2 = AudioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(75, now);
        osc2.frequency.linearRampToValueAtTime(30, now + 0.6);

        if (AudioCtx.createStereoPanner) {
            const panner2 = AudioCtx.createStereoPanner();
            panner2.pan.setValueAtTime(panVal, now);
            osc2.connect(gain2);
            gain2.connect(panner2);
            panner2.connect(AudioCtx.destination);
        } else {
            osc2.connect(gain2);
            gain2.connect(AudioCtx.destination);
        }
        gain2.gain.setValueAtTime(0.25 * vol, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.start(now);
        osc2.stop(now + 0.6);

        gain.gain.setValueAtTime(0.3 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

window.addEventListener('keydown', e => {
    if (STATE.inputLocked || (STATE.player && STATE.player.standUpTimer > 0)) return;
    STATE.keys[e.code] = true;
    if (e.code === 'Escape') {
        if (STATE.screen === 'game') {
            document.exitPointerLock();
            STATE.screen = 'pause';
            document.getElementById('pause-menu').classList.remove('hidden');
        } else if (STATE.screen === 'pause') resumeGame();
    }
    // Toggle chuột bằng phím Ctrl
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        if (STATE.screen === 'game') {
            if (gl && gl.canvas && document.pointerLockElement === gl.canvas) {
                document.exitPointerLock();
            } else {
                if (gl && gl.canvas) gl.canvas.requestPointerLock();
            }
        }
    }
    if (e.code === 'KeyE') {
        const nearQuest = STATE.questItems && STATE.questItems.some(q =>
            V3.dist(STATE.player.pos, q.pos) < 4.0);
        const nearFinal = STATE.finalPaper && STATE.finalPaper.active && !STATE.finalPaper.pickedUp &&
            V3.dist(STATE.player.pos, STATE.finalPaper.pos) < 4.0;

        // Kiểm tra xem có đang đứng gần Cánh Cửa Đỏ (0, -150) và giữ Chìa Khóa Đỏ không
        const dx = STATE.player.pos.x - 0;
        const dz = STATE.player.pos.z - (-150);
        const distToDoor = Math.sqrt(dx * dx + dz * dz);
        const nearDoor = STATE.hasRedKey && distToDoor < 6.0;

        if (nearQuest || nearFinal || nearDoor) { STATE.keys['KeyE'] = true; } else { activateUltimate(); }
    }
    if (e.code && e.code.startsWith('Digit')) STATE.keys[e.code] = true;
});
window.addEventListener('keyup', e => STATE.keys[e.code] = false);
window.addEventListener('mousedown', e => {
    if (STATE.inputLocked || STATE.screen !== 'game' || (STATE.player && STATE.player.standUpTimer > 0)) return;
    if (e.button === 0) STATE.mouse.down = true;
    if (e.button === 2) STATE.isAiming = true; // Right Click ADS
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) STATE.mouse.down = false;
    if (e.button === 2) STATE.isAiming = false;
});

window.addEventListener('mousemove', e => {
    if (STATE.inputLocked || (STATE.player && STATE.player.standUpTimer > 0)) return;
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    if (!gl || !gl.canvas) return;
    if (document.pointerLockElement === gl.canvas) {
        // Sử dụng kẹp (clamp) thay vì bỏ qua lệnh để vuốt nhanh vẫn mượt mà
        const mx = Math.max(-150, Math.min(150, e.movementX));
        const my = Math.max(-150, Math.min(150, e.movementY));

        STATE.camera.rot.y += mx * 0.002 * (window.aimSensitivity || 1.0);
        STATE.camera.rot.x -= my * 0.002 * (window.aimSensitivity || 1.0);
        STATE.camera.rot.x = Math.max(-1.5, Math.min(1.5, STATE.camera.rot.x));
    }
});

// --- BOSS EVENT LOGIC ---
// Đợi DOM tải xong rồi gán sự kiện cho nút
setTimeout(() => {
    const btn = document.getElementById('kill-last-bot-btn');
    if (btn) btn.onclick = () => triggerBossEvent();
}, 100);

function triggerBossEvent() {
    if (STATE.bossTriggered) return;
    STATE.bossTriggered = true;

    // Hiệu ứng rung màn hình và chớp đỏ cực mạnh
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) {
        uiLayer.style.animation = 'cameraShake 0.1s infinite';
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.inset = '0';
        flash.style.backgroundColor = 'rgba(255, 0, 0, 0.4)';
        flash.style.zIndex = '999999';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 3s ease';
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 3000); }, 500);
        setTimeout(() => uiLayer.style.animation = '', 4000);
    }

    const combatSound1 = document.getElementById('combat-theme1-sound');
    if (combatSound1) combatSound1.pause();
    const combatSound3 = document.getElementById('combat-theme3-sound');
    if (combatSound3) {
        combatSound3.currentTime = 0;
        combatSound3.play().catch(e => console.log(e));
    }

    STATE.inputLocked = true;
    STATE.keys = {};

    setTimeout(() => {
        const overlay = document.getElementById('boss-overlay');
        const container = document.getElementById('boss-container');
        const visual = document.getElementById('boss-visual');

        overlay.classList.remove('hidden');
        container.classList.remove('hidden');
        overlay.classList.add('active');
        visual.classList.add('boss-appear');

        document.body.classList.add('shake-screen');
    }, 500);

    // XUẤT HIỆN BOSS 3D NGAY ĐỂ CHIẾN ĐẤU
    setTimeout(() => {
        // Khởi tạo Boss 3D (Hakari)
        const yaw = STATE.camera.rot.y;
        const spawnDist = 45;
        STATE.boss = {
            pos: V3.add(STATE.player.pos, V3.create(Math.sin(yaw) * spawnDist, 0, -Math.cos(yaw) * spawnDist)),
            hp: window.GAME_CONFIG.boss.hp,
            maxHp: window.GAME_CONFIG.boss.hp,
            active: true,
            state: 'fight',
            skillCD: 3,
            vel: V3.create(0, 0, 0),
            armLift: 0, bodyRot: 0, bodyY: 0,
            rotY: yaw + Math.PI, targetAng: yaw + Math.PI,
            pillarSpots: [],
            dead: false,
            skillIndex: 0,
            skillSequence: null,
            deathTimer: 0
        };
        STATE.boss.pos.y = getHeight(STATE.boss.pos.x, STATE.boss.pos.z);

        document.getElementById('boss-msg').classList.add('boss-text-show');
        STATE.inputLocked = false;
        document.body.classList.remove('shake-screen');

        // Ẩn các overlay cinematic
        document.getElementById('boss-overlay').classList.remove('active');
        document.getElementById('boss-container').classList.add('hidden');

        // Hiện thanh máu Boss
        document.getElementById('boss-hp-container').style.display = 'block';
    }, 3000);
}



let bossOsc = null;
let ambientLoop = null;

// playAmbientHorror() đã xóa — chưa từng được gọi, ambientLoop vẫn giữ cho playBossSound()

let bossNodes = [];
function playBossSound() {
    if (!AudioCtx) return;
    if (AudioCtx.state === 'suspended') AudioCtx.resume();
    if (bossNodes.length > 0) return;

    // Dừng nhạc nền khi đánh Boss
    if (ambientLoop) {
        ambientLoop.gain.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + 1);
        setTimeout(() => { if (ambientLoop) ambientLoop.osc.stop(); ambientLoop = null; }, 1000);
    }

    // TỔNG HỢP NHẠC KINH DỊ (Oscillator layers)
    const createDrone = (freq, type = 'sine') => {
        const osc = AudioCtx.createOscillator();
        const gain = AudioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, AudioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, AudioCtx.currentTime);
        // LFO tạo nhịp thở
        const lfo = AudioCtx.createOscillator();
        const lfoGain = AudioCtx.createGain();
        lfo.frequency.value = 0.5; lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain); lfoGain.connect(gain.gain);
        lfo.start();
        osc.connect(gain); gain.connect(AudioCtx.destination);
        osc.start();
        bossNodes.push(osc, lfo);
    };

    // 3 tầng âm thanh lệch tông tạo cảm giác bất an
    createDrone(40, 'sawtooth');
    createDrone(43.5, 'sine');
    createDrone(47, 'triangle');

    // Thỉnh thoảng chèn tiếng rít cao
    setInterval(() => {
        if (!STATE.boss || !STATE.boss.active) return;
        const sting = AudioCtx.createOscillator();
        const sGain = AudioCtx.createGain();
        sting.type = 'square';
        sting.frequency.setValueAtTime(800 + Math.random() * 400, AudioCtx.currentTime);
        sGain.gain.setValueAtTime(0.02, AudioCtx.currentTime);
        sGain.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + 1);
        sting.connect(sGain); sGain.connect(AudioCtx.destination);
        sting.start(); sting.stop(AudioCtx.currentTime + 1);
    }, 4000);
}
// -------------------------


function resumeGame() {
    STATE.screen = 'game';
    document.getElementById('pause-menu').classList.add('hidden'); if (gl && gl.canvas) gl.canvas.requestPointerLock();
}

function spawnHakariDance() {
    HAKARI_DANCE.spawned = true;
    const img = document.getElementById("hakari-dance-img"), sound = document.getElementById("hakari-dance-sound");
    const vBg = document.getElementById("victory-bg");
    if (vBg) vBg.style.display = "block";
    if (img) img.style.display = "block";
    if (sound) { sound.currentTime = 0; sound.play(); }
}

function loop(now) {
    try {
        if (!STATE.lastTime) STATE.lastTime = now;
        const dt = Math.min((now - STATE.lastTime) / 1000, 0.1);
        STATE.lastTime = now;

        update(dt);
        draw();
        updateHUD();
        // Dùng window.loop để chạy qua wrapper đồng bộ khán giả mỗi frame
        requestAnimationFrame(window.loop || loop);
    } catch (e) {
        console.error("MAIN LOOP ERROR", e);
    }
}
window.loop = loop;

function showClickAnywhere(delay = 1000) {
    setTimeout(() => {
        const overlay = document.getElementById("click-anywhere");
        const continueText = document.getElementById("continue-text");

        if (document.pointerLockElement) document.exitPointerLock();

        overlay.style.display = "block";
        continueText.style.display = "block";

        overlay.onclick = () => {
            overlay.style.display = "none";
            continueText.style.display = "none";
            const img = document.getElementById("hakari-dance-img");
            const vBg = document.getElementById("victory-bg");
            // Không tắt nhạc, để nó tiếp tục cháy
            if (img) img.style.display = "none";
            if (vBg) vBg.style.display = "none";
            // Không tắt nhạc, để nó tiếp tục cháy
            overlay.onclick = null;
            endGame(true); // GỌI ENDGAME(TRUE) ĐỂ CHẠY ĐÚNG LOGIC!
        };
    }, delay);
}

// window.onload đã được gộp vào addEventListener('load') ở trên
// window.onload = () => {
//     gl.canvas.width = window.innerWidth;
//     gl.canvas.height = window.innerHeight;
//     initAssets();
// };





function checkOrientation() {
    const warning = document.getElementById('portrait-warning');
    if (warning) {
        // Chỉ hiện cảnh báo nếu là Mobile và chiều dọc dài hơn ngang
        if (isMobile && window.innerHeight > window.innerWidth) {
            warning.style.display = 'flex';
        } else {
            warning.style.display = 'none';
        }
    }
}
window.onresize = () => {
    applyGraphicsSettings();
    checkOrientation();
};
window.addEventListener('load', checkOrientation);
// Tự động điền tên cũ khi vào trang
window.addEventListener('load', () => {
    const savedName = localStorage.getItem('savedPlayerName');
    if (savedName) {
        document.getElementById('player-name-input').value = savedName;
    }
});

// --- CẤU HÌNH SỐ LƯỢNG BOT (ĐÃ FIX OVERWRITE & CLAMP MIN 1) ---
const savedBotCount = localStorage.getItem('botCount');
if (savedBotCount) {
    STATE.config.botCount = Math.max(10, parseInt(savedBotCount) || 25);
} else {
    STATE.config.botCount = isMobile ? 15 : 25;
}

let joyActive = false, joyCenter = { x: 0, y: 0 };
let aimTouchId = null, lastAimPos = { x: 0, y: 0 };

window.addEventListener('DOMContentLoaded', () => {
    // --- XỬ LÝ THANH CHỈNH BOT ---
    const botSlider = document.getElementById('bot-count-slider');
    const botVal = document.getElementById('bot-count-val');
    if (botSlider && botVal) {
        botSlider.value = STATE.config.botCount;
        botVal.innerText = STATE.config.botCount;
        const updateBotVal = (e) => {
            const val = Math.max(10, parseInt(e.target.value) || 10);
            botVal.innerText = val;
            STATE.config.botCount = val;
            localStorage.setItem('botCount', val);
        };
        botSlider.addEventListener('input', updateBotVal);
        botSlider.addEventListener('change', updateBotVal);
    }

    // --- NÚT CHỌN ĐỘ KHÓ ---
    const diffBtns = document.querySelectorAll('.diff-btn');
    const diffDesc = document.getElementById('diff-desc');
    const diffDescTexts = {
        easy: '😊 Bot/Boss yếu, máu +20% | Unti: cần 1500 dame (dễ charge)',
        normal: '⚔️ Cân bằng | Unti: cần 2000 dame, dame +20%',
        hard: '🔥 Bot/Boss mạnh | Unti: cần 2600 dame, dame +40%',
        extreme: '💀 Cực nguy hiểm | Unti: cần 3000 dame, dame +60%!',
    };
    function syncDiffButtons() {
        diffBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.diff === window.CURRENT_DIFFICULTY));
        if (diffDesc) diffDesc.textContent = diffDescTexts[window.CURRENT_DIFFICULTY] || '';
    }
    syncDiffButtons();
    diffBtns.forEach(btn => btn.addEventListener('click', () => {
        window.applyDifficulty(btn.dataset.diff);
        syncDiffButtons();
    }));

    // --- XỬ LÝ SỔ TAY HƯỚNG DẪN ---
    const btnGuide = document.getElementById('btn-open-guide');
    const btnCloseGuide = document.getElementById('close-guide-btn');
    const guideModal = document.getElementById('guide-modal');

    if (btnGuide && guideModal) {
        btnGuide.onclick = () => guideModal.classList.remove('hidden');
    }
    if (btnCloseGuide && guideModal) {
        btnCloseGuide.onclick = () => guideModal.classList.add('hidden');
    }

    // --- XỬ LÝ THÀNH TỰU / BÍ MẬT KHÔNG GIAN ---
    const btnAchievements = document.getElementById('btn-open-achievements');
    const btnCloseAchievements = document.getElementById('close-achievements-btn');
    const achievementsModal = document.getElementById('achievements-modal');
    const achievementsSummary = document.getElementById('achievements-player-summary');
    const achievementsList = document.getElementById('achievements-list-container');

    if (btnAchievements && achievementsModal && achievementsSummary && achievementsList) {
        btnAchievements.onclick = () => {
            achievementsModal.classList.remove('hidden');

            // Lấy tên người chơi hiện tại nhập ở input (hoặc mặc định 'BẠN')
            const inputEl = document.getElementById('player-name-input');
            const pName = (inputEl && inputEl.value.trim()) ? inputEl.value.trim() : "BẠN";

            const unlocked = window.LoreSystem ? window.LoreSystem.getUnlocked() : { easy: [], normal: [], hard: [], extreme: [] };
            const totalUnlocked = window.LoreSystem ? window.LoreSystem.getTotalUnlockedCount() : 0;

            achievementsSummary.innerHTML = `
                🌟 HỒ SƠ SINH TỒN CỦA <span style="color:#bf00ff; text-shadow: 0 0 8px rgba(191,0,255,0.6);">${pName.toUpperCase()}</span><br>
                🏆 ĐÃ GIẢI MÃ: <span style="color:#00ff88;">${totalUnlocked} / 24</span> BÍ MẬT ĐẢO HOANG
            `;

            achievementsList.innerHTML = '';

            const diffs = [
                { id: 'easy', name: '🟢 CHẾ ĐỘ DỄ', count: 3, label: 'Dễ' },
                { id: 'normal', name: '🟡 CHẾ ĐỘ THƯỜNG', count: 5, label: 'Thường' },
                { id: 'hard', name: '🟠 CHẾ ĐỘ KHÓ', count: 7, label: 'Khó' },
                { id: 'extreme', name: '🔴 CHẾ ĐỘ CỰC KHÓ', count: 9, label: 'Cực Khó' }
            ];

            diffs.forEach(d => {
                const completedCount = unlocked[d.id] ? unlocked[d.id].length : 0;

                const header = document.createElement('h4');
                header.style.color = '#bf00ff';
                header.style.fontSize = '9px';
                header.style.marginTop = '8px';
                header.style.borderBottom = '1px solid rgba(191,0,255,0.2)';
                header.style.paddingBottom = '2px';
                header.style.fontWeight = 'bold';
                header.innerHTML = `${d.name} <span style="float: right; color: #ffcc00;">${completedCount} / ${d.count}</span>`;
                achievementsList.appendChild(header);

                for (let i = 0; i < d.count; i++) {
                    const row = document.createElement('div');
                    row.className = 'achievement-row';

                    const isUnlocked = unlocked[d.id] && unlocked[d.id].includes(i);
                    if (isUnlocked) {
                        const loreText = (window.LORE_BY_DIFFICULTY && window.LORE_BY_DIFFICULTY[d.id] && window.LORE_BY_DIFFICULTY[d.id][i])
                            ? window.LORE_BY_DIFFICULTY[d.id][i].text
                            : "🔒";
                        row.innerHTML = `
                            <div class="achievement-title-bar">
                                <span style="color:#00ff88;">✓ BÍ MẬT PHẦN ${i + 1} (Đã Giải Mã)</span>
                            </div>
                            <div class="achievement-desc" style="color: #eee;">${loreText}</div>
                        `;
                        row.style.borderColor = 'rgba(0, 255, 136, 0.2)';
                        row.style.background = 'rgba(0, 255, 136, 0.03)';
                    } else {
                        row.innerHTML = `
                            <div class="achievement-title-bar">
                                <span style="color:#888;">🔒 BÍ MẬT PHẦN ${i + 1} (Bị Khóa)</span>
                            </div>
                            <div class="achievement-req" style="color: #ff9900;">⚠️ Yêu cầu: Chọn chế độ <b>${d.label.toUpperCase()}</b>, nhặt ít nhất ${i + 1} Hộp Thông Tin và hoàn thành nhiệm vụ tương ứng để giải mã!</div>
                        `;
                    }
                    achievementsList.appendChild(row);
                }
            });
        };
    }
    if (btnCloseAchievements && achievementsModal) {
        btnCloseAchievements.onclick = () => achievementsModal.classList.add('hidden');
    }

    // --- XỬ LÝ DISCORD ---
    const btnDiscord = document.getElementById('btn-join-discord');
    if (btnDiscord) {
        btnDiscord.onclick = () => {
            // Cố gắng mở trực tiếp qua Chrome nếu là Android để tránh News Plus của Oppo
            const discordUrl = 'https://discord.gg/your-invite-code';
            window.open(discordUrl, '_blank');

            const docElm = document.documentElement;
            if (docElm.requestFullscreen) docElm.requestFullscreen().catch(e => { });
        };
    }

    const jZone = document.getElementById('joystick-zone');
    const jKnob = document.getElementById('joystick-knob');
    const aimZone = document.getElementById('touch-aim-zone');

    // Joystick (Di chuyển)
    if (jZone) {
        jZone.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joyActive = true;
            joyCenter = { x: touch.clientX, y: touch.clientY };

            const base = document.getElementById('joystick-base');
            if (base) {
                base.style.left = (joyCenter.x - 55) + 'px';
                base.style.top = (joyCenter.y - 55) + 'px';
                base.style.opacity = 1;
            }
            jKnob.style.opacity = 1;
            updateJoystick(touch);
        }, { passive: false });

        jZone.addEventListener('touchmove', e => {
            e.preventDefault();
            if (!joyActive) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                updateJoystick(e.changedTouches[i]);
            }
        }, { passive: false });

        jZone.addEventListener('touchend', e => {
            e.preventDefault();
            joyActive = false;

            const base = document.getElementById('joystick-base');
            if (base) base.style.opacity = 0;
            jKnob.style.opacity = 0;

            STATE.keys['KeyW'] = false; STATE.keys['KeyS'] = false;
            STATE.keys['KeyA'] = false; STATE.keys['KeyD'] = false;

            // [FIX] Bỏ reset ShiftLeft ở đây để giữ trạng thái CHẠY khi bỏ tay ra (Sticky Sprint)
        }, { passive: false });

        function updateJoystick(touch) {
            let dx = touch.clientX - joyCenter.x;
            let dy = touch.clientY - joyCenter.y;
            const maxDist = 45;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
            jKnob.style.left = (joyCenter.x - 20 + dx) + 'px';
            jKnob.style.top = (joyCenter.y - 20 + dy) + 'px';

            STATE.keys['KeyW'] = dy < -20;
            STATE.keys['KeyS'] = dy > 20;
            STATE.keys['KeyA'] = dx < -20;
            STATE.keys['KeyD'] = dx > 20;
        }
    }

    // Touch Aim (Xoay Camera)
    if (aimZone) {
        aimZone.addEventListener('touchstart', e => {
            e.preventDefault();
            if (aimTouchId !== null) return;
            const t = e.changedTouches[0];
            aimTouchId = t.identifier;
            lastAimPos = { x: t.clientX, y: t.clientY };
        }, { passive: false });

        aimZone.addEventListener('touchmove', e => {
            if (STATE.player && STATE.player.standUpTimer > 0) return;
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === aimTouchId) {
                    const dx = t.clientX - lastAimPos.x;
                    const dy = t.clientY - lastAimPos.y;

                    lastAimPos.x = t.clientX;
                    lastAimPos.y = t.clientY;

                    const cdx = Math.max(-150, Math.min(150, dx));
                    const cdy = Math.max(-150, Math.min(150, dy));
                    STATE.camera.rot.y += cdx * 0.005 * (window.aimSensitivity || 1.0);
                    STATE.camera.rot.x -= cdy * 0.005 * (window.aimSensitivity || 1.0);
                    STATE.camera.rot.x = Math.max(-1.5, Math.min(1.5, STATE.camera.rot.x));
                    STATE.camera.rot.y = ((STATE.camera.rot.y + Math.PI) % (Math.PI * 2) + (Math.PI * 2)) % (Math.PI * 2) - Math.PI;
                }
            }
        }, { passive: false });

        aimZone.addEventListener('touchend', e => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === aimTouchId) aimTouchId = null;
            }
        }, { passive: false });
    }

    // Các Nút Hành động
    window.isEditingHUD = false;
    const btnShoot = document.getElementById('btn-shoot');
    let shootTouchId = null;
    let lastShootPos = { x: 0, y: 0 };

    if (btnShoot) {
        const onShootStart = e => {
            if (window.isEditingHUD || (STATE.player && STATE.player.standUpTimer > 0)) return;
            if (e.type === 'touchstart') e.preventDefault();
            STATE.mouse.down = true;
            btnShoot.classList.add('pressed');
            const t = e.changedTouches ? e.changedTouches[0] : e;
            shootTouchId = e.changedTouches ? t.identifier : 'mouse';
            lastShootPos = { x: t.clientX, y: t.clientY };
        };
        btnShoot.addEventListener('touchstart', onShootStart);
        btnShoot.addEventListener('mousedown', onShootStart);

        const onShootMove = e => {
            if (window.isEditingHUD || (!shootTouchId) || (STATE.player && STATE.player.standUpTimer > 0)) return;
            if (shootTouchId === 'mouse') return;
            const touches = e.changedTouches ? e.changedTouches : [e];
            for (let i = 0; i < touches.length; i++) {
                const t = touches[i];
                const id = e.changedTouches ? t.identifier : 'mouse';
                if (id === shootTouchId) {
                    const dx = t.clientX - lastShootPos.x;
                    const dy = t.clientY - lastShootPos.y;
                    lastShootPos.x = t.clientX;
                    lastShootPos.y = t.clientY;

                    // Deadzone: Ignore finger wobbles less than 3px to avoid camera jump when clicking
                    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

                    const cdx = Math.max(-100, Math.min(100, dx));
                    const cdy = Math.max(-100, Math.min(100, dy));
                    // Reduced aim sensitivity on shoot drag to 0.001 to prevent screen from snapping/flying upwards
                    STATE.camera.rot.y += cdx * 0.001 * (window.aimSensitivity || 1.0);
                    STATE.camera.rot.x -= cdy * 0.001 * (window.aimSensitivity || 1.0);
                    STATE.camera.rot.x = Math.max(-1.5, Math.min(1.5, STATE.camera.rot.x));
                }
            }
        };
        window.addEventListener('touchmove', onShootMove, { passive: false });
        window.addEventListener('mousemove', onShootMove);

        const onShootEnd = e => {
            const id = e.changedTouches ? e.changedTouches[0].identifier : 'mouse';
            if (id === shootTouchId) {
                shootTouchId = null;
                STATE.mouse.down = false;
                btnShoot.classList.remove('pressed');
            }
        };
        window.addEventListener('touchend', onShootEnd);
        window.addEventListener('mouseup', onShootEnd);
    }

    const btnAim = document.getElementById('btn-aim');
    if (btnAim) {
        const onAim = e => { if (window.isEditingHUD || (STATE.player && STATE.player.standUpTimer > 0)) return; e.preventDefault(); STATE.isAiming = !STATE.isAiming; if (STATE.isAiming) btnAim.classList.add('pressed'); else btnAim.classList.remove('pressed'); };
        btnAim.addEventListener('touchstart', onAim);
        btnAim.addEventListener('mousedown', onAim);
    }

    const btnUlti = document.getElementById('btn-ulti');
    if (btnUlti) {
        const onUlti = e => { if (window.isEditingHUD || (STATE.player && STATE.player.standUpTimer > 0)) return; e.preventDefault(); activateUltimate(); };
        btnUlti.addEventListener('touchstart', onUlti);
        btnUlti.addEventListener('mousedown', onUlti);
    }

    const btnInteract = document.getElementById('btn-interact');
    if (btnInteract) {
        const onInteract = e => { if (window.isEditingHUD || (STATE.player && STATE.player.standUpTimer > 0)) return; e.preventDefault(); STATE.keys['KeyE'] = true; setTimeout(() => { STATE.keys['KeyE'] = false; }, 200); };
        btnInteract.addEventListener('touchstart', onInteract);
        btnInteract.addEventListener('mousedown', onInteract);
    }

    // Bấm thẳng vào dòng chữ thông báo nhặt hộp trên màn hình cũng nhặt được
    const interMsg = document.getElementById('interaction-msg');
    if (interMsg) {
        const onInteractMsg = e => { if (STATE.player && STATE.player.standUpTimer > 0) return; e.preventDefault(); STATE.keys['KeyE'] = true; setTimeout(() => { STATE.keys['KeyE'] = false; }, 200); };
        interMsg.addEventListener('touchstart', onInteractMsg);
        interMsg.addEventListener('mousedown', onInteractMsg);
    }

    const btnSprint = document.getElementById('btn-sprint');
    if (btnSprint) {
        const onSprint = e => { if (window.isEditingHUD || (STATE.player && STATE.player.standUpTimer > 0)) return; e.preventDefault(); STATE.keys['ShiftLeft'] = !STATE.keys['ShiftLeft']; if (STATE.keys['ShiftLeft']) btnSprint.classList.add('pressed'); else btnSprint.classList.remove('pressed'); };
        btnSprint.addEventListener('touchstart', onSprint);
        btnSprint.addEventListener('mousedown', onSprint);
    }

    const btnReload = document.getElementById('btn-reload');
    if (btnReload) {
        const onReloadStart = e => { if (window.isEditingHUD || (STATE.player && STATE.player.standUpTimer > 0)) return; e.preventDefault(); STATE.keys['KeyR'] = true; btnReload.classList.add('pressed'); };
        const onReloadEnd = e => { if (window.isEditingHUD) return; e.preventDefault(); STATE.keys['KeyR'] = false; btnReload.classList.remove('pressed'); };
        btnReload.addEventListener('touchstart', onReloadStart);
        btnReload.addEventListener('mousedown', onReloadStart);
        btnReload.addEventListener('touchend', onReloadEnd);
        btnReload.addEventListener('mouseup', onReloadEnd);
    }

    const btnJump = document.getElementById('btn-jump');
    if (btnJump) {
        const onJumpStart = e => { if (window.isEditingHUD || (STATE.player && STATE.player.standUpTimer > 0)) return; e.preventDefault(); STATE.keys['Space'] = true; };
        const onJumpEnd = e => { if (window.isEditingHUD) return; e.preventDefault(); STATE.keys['Space'] = false; };
        btnJump.addEventListener('touchstart', onJumpStart);
        btnJump.addEventListener('mousedown', onJumpStart);
        btnJump.addEventListener('touchend', onJumpEnd);
        btnJump.addEventListener('mouseup', onJumpEnd);
    }

    const wBtns = document.querySelectorAll('.weapon-btn');
    wBtns.forEach(btn => {
        const onWeaponSelect = e => {
            if (STATE.player && STATE.player.standUpTimer > 0) return;
            e.preventDefault();
            if (STATE.hasRedKey) return; // Khóa đổi súng trên mobile
            const idx = parseInt(btn.getAttribute('data-idx'));
            STATE.player.weaponIdx = idx;
            wBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        btn.addEventListener('touchstart', onWeaponSelect);
        btn.addEventListener('mousedown', onWeaponSelect);
    });
});

// ============================================================
// PHASE 2 — ATMOSPHERIC PARTICLES & AMBIENT LIGHTING
// ============================================================

STATE.ambientTimer = 0;
STATE.flickerTime = 0;
STATE.flickerVal = 0;
STATE.heartbeatTimer = 0;

// Spawn floating dust/smoke particles around player
function spawnAmbientParticles(dt) {
    if (STATE.screen !== 'game' || !STATE.player.pos) return;
    STATE.ambientTimer += dt;

    // Adaptive rate: reduce on mobile or when FPS is low
    const rate = isMobile ? 0.25 : 0.06;
    if (STATE.ambientTimer < rate) return;
    STATE.ambientTimer = 0;

    // Limit total particles to avoid lag
    if (STATE.particles.length > 700) return;

    const p = STATE.player.pos;
    const count = isMobile ? 1 : (STATE.boss && STATE.boss.active ? 3 : 2);

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 25;
        const ox = Math.cos(angle) * radius;
        const oz = Math.sin(angle) * radius;
        const wx = p.x + ox;
        const wz = p.z + oz;
        const wy = getHeight(wx, wz) + Math.random() * 4;

        // Choose particle type based on context
        let col, life, velY, ptype;
        if (STATE.boss && STATE.boss.active) {
            // Boss active: red/dark smoke drifting
            col = [0.18 + Math.random() * 0.1, 0.0, 0.04];
            life = 3.5 + Math.random() * 2.5;
            velY = 0.5 + Math.random() * 0.8;
            ptype = 'smoke';
        } else {
            // Normal: grey/blue dust motes
            const t = Math.random();
            col = t < 0.5
                ? [0.22, 0.22, 0.28]                        // Blue-grey dust
                : [0.12 + Math.random() * 0.08, 0.06, 0.14]; // Purple mist
            life = 4.0 + Math.random() * 3.0;
            velY = 0.3 + Math.random() * 0.5;
            ptype = 'smoke';
        }

        STATE.particles.push({
            pos: V3.create(wx, wy, wz),
            vel: V3.create(
                (Math.random() - 0.5) * 0.6,
                velY,
                (Math.random() - 0.5) * 0.6
            ),
            life,
            color: col,
            type: ptype
        });
    }

    // Barrel smoke trails when hp < 5
    STATE.barrels.forEach(b => {
        if (b.hp < 5 && b.hp > 0 && Math.random() < 0.3) {
            STATE.particles.push({
                pos: V3.create(b.pos.x + (Math.random() - 0.5) * 0.5, b.pos.y + 1.6, b.pos.z + (Math.random() - 0.5) * 0.5),
                vel: V3.create((Math.random() - 0.5) * 0.4, 1.5 + Math.random(), (Math.random() - 0.5) * 0.4),
                life: 2.0 + Math.random() * 1.5,
                color: [0.25, 0.18, 0.05],
                type: 'smoke'
            });
            if (Math.random() < 0.5) {
                STATE.particles.push({
                    pos: V3.create(b.pos.x + (Math.random() - 0.5) * 0.3, b.pos.y + 1.7, b.pos.z + (Math.random() - 0.5) * 0.3),
                    vel: V3.create((Math.random() - 0.5) * 1.0, 2.0 + Math.random() * 1.5, (Math.random() - 0.5) * 1.0),
                    life: 0.6 + Math.random() * 0.4,
                    color: [1.0, 0.4 + Math.random() * 0.3, 0.0],
                    type: 'fire'
                });
            }
        }
    });
}

// Update flicker lighting — dynamic point light pulse
function updateFlickerLights(dt) {
    STATE.flickerTime += dt;
    if (STATE.boss && STATE.boss.active) {
        // Boss active: fast red pulse
        const f = 0.6 + Math.sin(STATE.flickerTime * 8.0) * 0.3 + Math.sin(STATE.flickerTime * 13.0) * 0.1;
        STATE.flickerVal = f;
        // Also update the point light to flicker around player for creepy atmosphere
        const pl = STATE.player.pos;
        if (locs.pointLightPos && locs.pointLightColor) {
            // Already set in draw() but we boost it during boss phase
        }
    } else {
        // Normal: slow cold blue-purple ambient pulse
        STATE.flickerVal = 0.5 + Math.sin(STATE.flickerTime * 1.5) * 0.4;
    }
}

// ============================================================
// PHASE 6 — PROXIMITY GLOW FOR LOOT (integrated into draw)
// ============================================================

function getLootProximityGlow(loot, playerPos) {
    const dist = V3.dist(playerPos, loot.pos);
    if (dist < 3.0) return 3.5;     // Very close: strong glow
    if (dist < 6.0) return 1.5;     // Medium: moderate glow
    return 0.0;                      // Far: no extra glow
}

// Show pickup hint when very close to loot
function updateLootProximityHints() {
    if (!STATE.player || !STATE.player.pos) return;
    const p = STATE.player.pos;
    let nearest = null, nearDist = 99999;
    STATE.loot.forEach(l => {
        const d = V3.dist(p, l.pos);
        if (d < 3.0 && d < nearDist) { nearDist = d; nearest = l; }
    });
    const pMsg = document.getElementById('pickup-msg');
    if (nearest && pMsg && !pMsg.classList.contains('show')) {
        const names = ['📦 NHẶT ĐẠN', '❤️ NHẶT MÁU', '🛡️ NHẶT GIÁP', '⚡ NHẶT BUFF'];
        const colors = ['#ffcc00', '#ff3366', '#00d4ff', '#bf00ff'];
        pMsg.innerText = names[nearest.type] || '📦 NHẶT';
        pMsg.style.color = colors[nearest.type] || '#00ffaa';
        pMsg.style.borderColor = colors[nearest.type] || '#00ffaa';
        pMsg.style.boxShadow = `0 0 20px ${colors[nearest.type] || '#00ffaa'}55`;
    }
}

// ============================================================
// PHASE 9 — AUDIO ATMOSPHERE (Heartbeat + distance effects)
// ============================================================

let _heartbeatActive = false;
let _heartbeatNodes = [];

function updateAmbientAudio(dt) {
    if (!AudioCtx || STATE.screen !== 'game') return;
    if (AudioCtx.state === 'suspended') AudioCtx.resume();

    const p = STATE.player;
    const hpRatio = p.hp / p.maxHp;

    // Heartbeat sound when HP < 25%
    STATE.heartbeatTimer -= dt;
    if (hpRatio < 0.25 && STATE.heartbeatTimer <= 0) {
        const interval = 0.4 + hpRatio * 1.2; // Faster when lower HP
        STATE.heartbeatTimer = interval;
        playHeartbeat();

        // CSS pulsing class on health bar
        const hfill = document.getElementById('health-fill');
        if (hfill) {
            hfill.classList.add('hp-critical-pulse');
            setTimeout(() => hfill.classList.remove('hp-critical-pulse'), 300);
        }
        // HP bar container critical class
        const hpContainer = document.getElementById('health-bar-container');
        if (hpContainer) hpContainer.classList.add('hp-critical');
    } else if (hpRatio >= 0.25) {
        const hpContainer = document.getElementById('health-bar-container');
        if (hpContainer) hpContainer.classList.remove('hp-critical');
    }
}

function playHeartbeat() {
    if (!AudioCtx) return;
    if (AudioCtx.state === 'suspended') AudioCtx.resume();
    const now = AudioCtx.currentTime;

    // Low thud — heartbeat pattern: thud, thud (double beat)
    const playThud = (startTime) => {
        const osc = AudioCtx.createOscillator();
        const gain = AudioCtx.createGain();
        const filter = AudioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 180;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, startTime);
        osc.frequency.exponentialRampToValueAtTime(28, startTime + 0.12);
        gain.gain.setValueAtTime(0.0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
        osc.connect(filter); filter.connect(gain); gain.connect(AudioCtx.destination);
        osc.start(startTime); osc.stop(startTime + 0.18);
    };
    playThud(now);
    playThud(now + 0.18); // Double beat
}

// ============================================================
// PHASE 10 — PERFORMANCE: ADAPTIVE QUALITY
// ============================================================

STATE.fpsHistory = [];
STATE.qualityReduced = false;
STATE._lastFpsCheck = 0;
STATE._frameCount = 0;

function updateAdaptiveQuality(dt) {
    STATE._frameCount++;
    STATE._lastFpsCheck += dt;
    if (STATE._lastFpsCheck < 2.0) return; // Check every 2 seconds

    const fps = STATE._frameCount / STATE._lastFpsCheck;
    STATE._frameCount = 0;
    STATE._lastFpsCheck = 0;

    STATE.fpsHistory.push(fps);
    if (STATE.fpsHistory.length > 5) STATE.fpsHistory.shift();

    const avgFps = STATE.fpsHistory.reduce((a, b) => a + b, 0) / STATE.fpsHistory.length;

    if (avgFps < 35 && !STATE.qualityReduced) {
        // [PHASE 10] Giảm chất lượng: deactivate 500 particle cũ nhất (pool-safe)
        STATE.qualityReduced = true;
        let deactivated = 0;
        for (let i = 0; i < STATE.particles.length && deactivated < 500; i++) {
            if (STATE.particles[i].active) {
                STATE.particles[i].active = false;
                deactivated++;
            }
        }
        console.log(`[AdaptiveQuality] FPS ${avgFps.toFixed(1)} — reducing quality (deactivated ${deactivated} particles)`);
    } else if (avgFps > 52 && STATE.qualityReduced) {
        STATE.qualityReduced = false;
        console.log(`[AdaptiveQuality] FPS ${avgFps.toFixed(1)} — restoring full quality`);
    }
}

// ============================================================
// PATCH: integrate new systems into update() and draw()
// ============================================================

// Override update to also call new ambient systems
const _origUpdate = update;
window.update = function (dt) {
    _origUpdate(dt);
    if (STATE.screen === 'game' && !STATE.hitPause) {
        spawnAmbientParticles(dt);
        updateFlickerLights(dt);
        updateAmbientAudio(dt);
        updateAdaptiveQuality(dt);
        updateLootProximityHints();
    }
};
// Re-point loop to patched update
// [PHASE 10] Batch HUD: đếm frame để chỉ cập nhật DOM mỗi 3 frame (~20ms)
let _hudFrameCounter = 0;

const _origLoop = window.loop;
window.loop = function (now) {
    if (!STATE.lastTime) STATE.lastTime = now;
    const dt = Math.min((now - STATE.lastTime) / 1000, 0.1);
    STATE.lastTime = now;
    window.update(dt);
    draw();
    _hudFrameCounter++;
    if (_hudFrameCounter >= 3) {
        updateHUD();
        _hudFrameCounter = 0;
    }
    requestAnimationFrame(window.loop);
};

// ============================================================
// PATCH: draw() — disable loot proximity glow and preserve original draw
// ============================================================
const _origDraw = draw;
window.draw = function () {
    _origDraw();
};

