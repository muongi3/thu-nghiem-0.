window.GAME_CONFIG = {
    // ==========================================================================================
    // 👤 THÔNG SỐ NGƯỜI CHƠI (PLAYER STATS)
    // ==========================================================================================
    player: {
        maxHp: 1000,                // Máu tối đa
        maxArmor: 1000,             // Giáp tối đa (Tăng lên để giáp quan trọng hơn)
        walkSpeed: 8.5,             // Tốc độ đi bộ (Tăng nhẹ)
        sprintMultiplier: 1.9,      // Hệ số chạy nhanh (Giảm nhẹ để quái có cơ hội đuổi kịp)
        jumpPower: 11,              // Lực nhảy cao
        sniperSpeed: 6.5,           // Tốc độ khi cầm Sniper
        powerupSpeedMultiplier: 1.6 // Hệ số tăng tốc khi ăn bùa
    },

    // ==========================================================================================
    // 🤖 THÔNG SỐ QUÁI VẬT (BOT AI STATS)
    // ==========================================================================================
    bot: {
        hpLv1: 200,          // Máu quái thường
        hpLv2: 420,          // Máu quái hóa đỏ (Để vừa khít một hit chết ở Hard và ít máu ở Extreme)
        hpLv3: 480,          // Máu 3 con cuối (Để nổ thùng ở Hard vẫn còn lại ít máu)

        speedLv1: 5.0,       // Tốc độ quái Lv1 (chậm lại cho người chơi kịp phản xạ)
        speedLv2: 8.0,        // Tốc độ quái Lv2
        speedLv3: 12.0,       // Tốc độ quái Lv3 (nguy hiểm nhưng vẫn trốn được)

        baseDamage: 15,       // Sát thương Lv1
        enragedDamageLv2: 45, // Sát thương Lv2
        enragedDamageLv3: 80, // Sát thương Lv3 (Cực đau)
        detectRadius: 45,     // Tầm nhìn
        attackRange: 2.8,     // Khoảng cách cào
        attackCD: 0.7,        // Hồi chiêu cào
        evolveTime: 1.5       // Thời gian gồng hóa Lv3 (Nhanh hơn)
    },

    // ==========================================================================================
    // 👹 THÔNG SỐ TRÙM CUỐI (KẺ CANH CÁNH CỬA ĐỎ)
    // ==========================================================================================
    boss: {
        hp: 20000,            // Máu của Boss (Tăng lên 12k để trận đấu epic hơn)
        passiveDamage: 150,   // Sát thương áp sát
        skillCD: 4.5,         // Hồi chiêu giữa các đòn (Nhanh hơn chút)
        postSkillRest: 2.5,   // Thời gian nghỉ sau chiêu

        // CHIÊU 1: LƯỚT (DASH)
        skill1: {
            damage: 350,
            prepareTime: 1.5,
            activeTime: 0.7,
            speed: 130,       // Lướt nhanh hơn
            width: 9
        },
        // CHIÊU 2: ĐẠI BÁC (SHOOT)
        skill2: {
            damage: 100,       // Sát thương mỗi viên (Cân bằng lại để không bị sốc chết ngay)
            prepareTime: 1.0,
            shotCount: 20,    // Bắn nhiều đạn hơn (20 viên)
            interval: 0.08,   // Tốc độ xả đạn nhanh hơn
            speed: 120,
        },
        // CHIÊU 3: NHẢY DẬM (JUMP/SLAM)
        skill3: {
            damage: 550,
            prepareTime: 1.8,
            range: 28,
            jumpPower: 48,
            gravity: 55
        },
        // CHIÊU 4: CỘT MÁU (CRIMSON PILLARS)
        skill4: {
            damage: 350,
            prepareTime: 2.2,
            count: 25,        // Nhiều cột hơn
            pillarRange: 10,
            pillarTimer: 1.8
        },
        // CHIÊU 5: DỊCH CHUYỂN (TELEPORT STRIKE)
        skill5: {
            damage: 450,
            prepareTime: 1.8,
            activeTime: 2.5,
            range: 35
        }
    },

    // ==========================================================================================
    // 🔫 THÔNG SỐ VŨ KHÍ (WEAPON STATS)
    // ==========================================================================================
    weapons: {
        pistol: {
            damage: 65,
            rate: 250,
            spread: 0.03,
            range: 60,
            maxAmmo: 15,
            res: 150
        },
        smg: {
            damage: 50,
            rate: 150,
            spread: 0.08,
            range: 45,
            maxAmmo: 40,
            res: 200
        },
        sniper: {
            damage: 200,
            rate: 1200,
            spread: 0.0,
            range: 300,
            maxAmmo: 5,
            res: 20
        }
    },

    // ==========================================================================================
    // 🔥 KỸ NĂNG ĐẶC BIỆT (ULTIMATE SKILL)
    // ==========================================================================================
    ultimate: {
        requiredDamage: 2000,    // Gây 1000 dame để sạc đầy Unti
        chargeTime: 2.0,         // Thời gian gồng (1s)
        invincibleTime: 2.0,     // Bất tử 1s lúc tung chiêu
        damage: 800,             // Sát thương nổ
        explosionRange: 30,      // Tầm nổ
        projectileSpeed: 100
    },

    // ==========================================================================================
    // ⚙️ THÔNG SỐ KHÁC (MISC STATS)
    // ==========================================================================================
    misc: {
        barrelHp: 15,
        barrelExplosionDamage: 400,  // Đủ one-hit Lv2 Hard (HP=336), tăng lên từ 300
        barrelExplosionRange: 15,
        playerProjectileSpeed: 120
    }
};

// --- [QUAN TRỌNG] SAO LƯU THÔNG SỐ GỐC ĐỂ DÙNG TRONG ĐỘ KHÓ ---
// Bác chỉnh gì ở GAME_CONFIG trên kia thì nó sẽ lấy cái đó làm mốc gốc
window.ORIGINAL_CONFIG = JSON.parse(JSON.stringify(window.GAME_CONFIG));

// ==========================================================================================
// 🎮 HỆ THỐNG ĐỘ KHÓ
// ==========================================================================================
window.DIFFICULTY_PRESETS = {
    easy: {
        label: '😊 DỄ', color: '#00e676',
        questCount: 3, // DỄ: Chỉ cần 3 nhiệm vụ là thắng cuộc
        botHpMult: 0.7, botDmgMult: 0.6, botSpeedMult: 0.75,
        enrageLv2Pct: 0.85, lv3Count: 3,
        bossHpMult: 0.6, bossDmgMult: 0.5, bossSkillCdMult: 1.5, bossSpeedMult: 0.7,
        bossSkillPreTimeMult: 1.5, // Boss "rặn" chiêu cực chậm (Chậm)
        bossSkillActiveTimeMult: 1.2, // Hiệu ứng chiêu kéo dài/kết thúc chậm
        bossSkill5Buffer: 1.5,        // Dễ: Dư 1.5s
        playerHpMult: 1.2, playerSpdMult: 1.0,
        weaponDmgMult: 1.0,
        ultiDmgMult: 1.0,
        ultiChargeMult: 0.75,  // Cần 1500 dame — DỄ charge Unti
    },
    normal: {
        label: '⚔️ THƯỜNG', color: '#ffcc00',
        questCount: 5, // THƯỜNG: 5 nhiệm vụ
        botHpMult: 1.0, botDmgMult: 1.0, botSpeedMult: 1.0,
        enrageLv2Pct: 0.85, lv3Count: 5,
        bossHpMult: 1.0, bossDmgMult: 1.0, bossSkillCdMult: 1.0, bossSpeedMult: 1.0,
        bossSkillPreTimeMult: 1.0, // Chuẩn (Standard)
        bossSkillActiveTimeMult: 1.0,
        bossSkill5Buffer: 1.0,        // Thường: Dư 1.0s
        playerHpMult: 1.0, playerSpdMult: 1.0,
        weaponDmgMult: 1.1,
        ultiDmgMult: 1.2,
        ultiChargeMult: 1.0,   // Cần 2000 dame — cơ bản
    },
    hard: {
        label: '🔥 KHÓ', color: '#ff6600',
        questCount: 7, // KHÓ: 7 nhiệm vụ
        botHpMult: 1.4, botDmgMult: 1.5, botSpeedMult: 1.2,
        enrageLv2Pct: 0.85, lv3Count: 7,
        bossHpMult: 1.5, bossDmgMult: 1.1, bossSkillCdMult: 0.75, bossSpeedMult: 1.3,
        bossSkillPreTimeMult: 0.8, // Boss "rặn" chiêu nhanh (Hơi nhanh tý)
        bossSkillActiveTimeMult: 0.85,
        bossSkill5Buffer: 0.5,        // Khó: Dư 0.5s
        playerHpMult: 0.85, playerSpdMult: 0.9,
        weaponDmgMult: 1.2,
        ultiDmgMult: 1.4,
        ultiChargeMult: 1.3,   // Cần 2600 dame — phải đánh thật nhiều
    },
    extreme: {
        label: '💀 CỰC KHÓ', color: '#ff0033',
        questCount: 9, // CỰC KHÓ: 9 nhiệm vụ để mở khóa sự thật tối thượng
        botHpMult: 2.15, botDmgMult: 2.2, botSpeedMult: 1.4,
        enrageLv2Pct: 0.85, lv3Count: 10,
        bossHpMult: 2.2, bossDmgMult: 1.2, bossSkillCdMult: 0.55, bossSpeedMult: 1.6,
        bossSkillPreTimeMult: 0.65, // Boss tung chiêu cực chớp nhoáng (Sít)
        bossSkillActiveTimeMult: 0.7,
        bossSkill5Buffer: 0.2,        // Cực khó: Dư 0.2s (Vừa thoát là đập)
        playerHpMult: 0.7, playerSpdMult: 0.85,
        weaponDmgMult: 1.3,
        ultiDmgMult: 1.6,
        ultiChargeMult: 1.5,  // Cần 3000 dame — cần kỹ năng thực sự
    }
};

window.CURRENT_DIFFICULTY = 'normal';

/**
 * Hàm áp dụng độ khó và tính toán lại các chỉ số game
 * ĐẶC BIỆT: Tính toán thời gian chiêu của Boss dựa trên tốc độ chạy của người chơi.
 */
window.applyDifficulty = function (key) {
    window.CURRENT_DIFFICULTY = key;
    const d = window.DIFFICULTY_PRESETS[key];
    const b = window.GAME_CONFIG;
    const orig = window.ORIGINAL_CONFIG;

    // --- CẬP NHẬT THÔNG SỐ BOT ---
    b.bot.hpLv1 = Math.round(orig.bot.hpLv1 * d.botHpMult);
    b.bot.hpLv2 = Math.round(orig.bot.hpLv2 * d.botHpMult);
    b.bot.hpLv3 = Math.round(orig.bot.hpLv3 * d.botHpMult);
    b.bot.speedLv1 = orig.bot.speedLv1 * d.botSpeedMult;
    b.bot.speedLv2 = orig.bot.speedLv2 * d.botSpeedMult;
    b.bot.speedLv3 = orig.bot.speedLv3 * d.botSpeedMult;
    b.bot.baseDamage = Math.round(orig.bot.baseDamage * d.botDmgMult);
    b.bot.enragedDamageLv2 = Math.round(orig.bot.enragedDamageLv2 * d.botDmgMult);
    b.bot.enragedDamageLv3 = Math.round(orig.bot.enragedDamageLv3 * d.botDmgMult);
    b.bot.enrageLv2Pct = d.enrageLv2Pct;
    b.bot.lv3Count = d.lv3Count;

    // --- CẬP NHẬT THÔNG SỐ THÙNG NỔ ---
    if (key === 'hard') {
        b.misc.barrelExplosionDamage = 600;
    } else if (key === 'extreme') {
        b.misc.barrelExplosionDamage = 800;
    } else {
        b.misc.barrelExplosionDamage = orig.misc.barrelExplosionDamage; // easy / normal = 400
    }

    // --- CẬP NHẬT THÔNG SỐ BOSS ---
    b.boss.hp = Math.round(orig.boss.hp * d.bossHpMult);
    b.boss.passiveDamage = Math.round(orig.boss.passiveDamage * d.bossDmgMult);
    b.boss.skill1.damage = Math.round(orig.boss.skill1.damage * d.bossDmgMult);
    b.boss.skill1.speed = Math.round(orig.boss.skill1.speed * d.bossSpeedMult);
    b.boss.skill2.damage = Math.round(orig.boss.skill2.damage * d.bossDmgMult);
    b.boss.skill2.speed = Math.round(orig.boss.skill2.speed * d.bossSpeedMult);

    // ==========================================================================================
    // ⚡ HỆ THỐNG THỜI GIAN CHIÊU BOSS (DYNAMIC TIMING)
    // Công thức: (Khoảng cách cần né / Tốc độ chạy của người chơi) * Hệ số an toàn * Multiplier độ khó
    // ==========================================================================================
    const sprintSpeed = b.player.walkSpeed * b.player.sprintMultiplier;
    const pm = d.bossSkillPreTimeMult || 1.0;   // Multiplier cho giai đoạn Gồng (Prepare)
    const am = d.bossSkillActiveTimeMult || 1.0; // Multiplier cho giai đoạn Thực thi/Hồi (Active/Recovery)

    // CHIÊU 1 (DASH - Lướt): Né ngang (Width=9). Cần né ít nhất 4.5 units để thoát khỏi đường lướt.
    // Công thức: (4.5 / sprintSpeed) * 2.5 (hệ số an toàn) * pm
    b.boss.skill1.prepareTime = (5 / sprintSpeed) * 2.5 * pm;
    b.boss.skill1.activeTime = 0.7 * am;

    // CHIÊU 2 (SHOOT - Đại bác): Thời gian chuẩn bị trước khi xả đạn
    b.boss.skill2.prepareTime = 1.0 * pm;

    // CHIÊU 3 (JUMP/SLAM - Nhảy dậm): Tầm đánh 28 units. Cần chạy từ tâm ra rìa.
    // DỄ: ~2.5s | THƯỜNG: ~1.9s | CỰC KHÓ: ~1.4s (Vừa khít thời gian chạy nếu phản xạ ngay)
    b.boss.skill3.prepareTime = (28 / sprintSpeed) * 1.1 * pm;

    // CHIÊU 4 (PILLAR - Cột máu): Mỗi cột tầm 10 units.
    b.boss.skill4.prepareTime = 2.2 * pm;
    b.boss.skill4.pillarTimer = (10 / sprintSpeed) * 1.5 * pm; // Thời gian từ lúc hiện vòng đỏ đến lúc nổ

    // CHIÊU 5 (TELEPORT - Trồi lên đập): Tầm đánh 20m (từ tâm).
    // Người chơi chạy từ tâm (0m) ra rìa (20m).
    const r5 = 20;
    b.boss.skill5.range = r5;
    const escapeTime5 = r5 / sprintSpeed;
    const buffer5 = d.bossSkill5Buffer || 1.0;
    // holdTime = (Thgian chạy thoát - 1s gồng ngầm - 0.4s trồi lên) + Buffer
    // Giúp Boss đập ngay sau khi người chơi vừa kịp chạy ra khỏi vòng
    const holdTime = Math.max(0.1, (escapeTime5 - 1.0 - 0.4) + buffer5);
    b.boss.skill5.holdTime = holdTime;
    b.boss.skill5.prepareTime = (r5 / sprintSpeed) * 1.3 * pm;
    b.boss.skill5.activeTime = 0.4 + holdTime + 0.4 + 0.5;

    // --- THÔNG SỐ NGƯỜI CHƠI ---
    b.player.maxHp = Math.round(orig.player.maxHp * d.playerHpMult);
    b.player.maxArmor = Math.round(orig.player.maxArmor * d.playerHpMult);
    b.player.walkSpeed = orig.player.walkSpeed * d.playerSpdMult;
    b.player.sprintMultiplier = orig.player.sprintMultiplier * d.playerSpdMult;

    // --- VŨ KHÍ & KỸ NĂNG ---
    const wm = d.weaponDmgMult || 1.0;
    // Sử dụng giá trị gốc bác đã chỉnh ở đầu file để nhân hệ số
    b.weapons.pistol.damage = Math.round(orig.weapons.pistol.damage * wm);
    b.weapons.smg.damage = Math.round(orig.weapons.smg.damage * wm);
    b.weapons.sniper.damage = Math.round(orig.weapons.sniper.damage * wm);

    const um = d.ultiDmgMult || 1.0;
    const cm = d.ultiChargeMult || 1.0;
    b.ultimate.damage = Math.round(orig.ultimate.damage * um);
    b.ultimate.requiredDamage = Math.round(orig.ultimate.requiredDamage * cm);

    localStorage.setItem('difficulty', key);

    // LOG ĐỂ KIỂM TRA (F12)
    console.log(`%c[ĐỘ KHÓ] Đã chuyển sang: ${key.toUpperCase()}`, "color: #ffcc00; font-weight: bold;");
    console.table({
        "Pistol Damage": b.weapons.pistol.damage,
        "SMG Damage": b.weapons.smg.damage,
        "Sniper Damage": b.weapons.sniper.damage,
        "Bot HP": Math.round(180 * d.botHpMult),
        "Boss HP": b.boss.hp
    });
};

// Load độ khó đã lưu
const _savedDiff = localStorage.getItem('difficulty') || 'normal';
window.applyDifficulty(_savedDiff);
