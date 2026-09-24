/* Dados e regras do BattleHub.
   Tudo fica salvo no navegador (localStorage). Em produção, troque as funções
   de BH.act por chamadas à sua API: as telas não precisam mudar. */
window.BH = window.BH || {};
(function () {
  const KEY = 'battlehub-demo';
  const VERSION = 3;
  const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  let seq = 0;
  const newId = (p) => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

  /* ---------- tabelas fixas ---------- */
  const TIERS = [
    { id: 'bronze', name: 'Bronze', min: 0, color: '#d08a5b' },
    { id: 'prata', name: 'Prata', min: 1000, color: '#c3cad6' },
    { id: 'ouro', name: 'Ouro', min: 1300, color: '#f6b83c' },
    { id: 'platina', name: 'Platina', min: 1600, color: '#5eead4' },
    { id: 'diamante', name: 'Diamante', min: 1900, color: '#7dd3fc' },
    { id: 'elite', name: 'Elite', min: 2200, color: '#b69cff' },
    { id: 'coroa', name: 'Coroa', min: 2500, color: '#fbbf24' }
  ];
  function tierOf(elo) {
    let i = 0;
    for (let k = 0; k < TIERS.length; k++) if (elo >= TIERS[k].min) i = k;
    const tier = TIERS[i], next = TIERS[i + 1] || null;
    const progress = next ? (elo - tier.min) / (next.min - tier.min) : 1;
    return { tier, next, progress: Math.max(0, Math.min(1, progress)) };
  }

  const AVATARS = [
    { id: 'iniciante', name: 'Iniciante', icon: 'smile', req: 'Padrão', grad: ['#6d28d9', '#a78bfa'], ok: () => true },
    { id: 'atirador', name: 'Atirador', icon: 'crosshair', req: '10 kills totais', grad: ['#b91c1c', '#fb923c'], ok: (u) => u.stats.kills >= 10 },
    { id: 'exterminador', name: 'Exterminador', icon: 'skull', req: '50 kills totais', grad: ['#374151', '#9ca3af'], ok: (u) => u.stats.kills >= 50 },
    { id: 'assassino', name: 'Assassino', icon: 'swords', req: '100 kills totais', grad: ['#7f1d1d', '#ef4444'], ok: (u) => u.stats.kills >= 100 },
    { id: 'vencedor', name: 'Vencedor', icon: 'trophy', req: '5 vitórias', grad: ['#92400e', '#fbbf24'], ok: (u) => u.stats.wins >= 5 },
    { id: 'campeao', name: 'Campeão', icon: 'crown', req: '10 vitórias', grad: ['#a16207', '#fde047'], ok: (u) => u.stats.wins >= 10 },
    { id: 'lenda', name: 'Lenda', icon: 'star', req: '25 vitórias', grad: ['#c2410c', '#fcd34d'], ok: (u) => u.stats.wins >= 25 },
    { id: 'respeitado', name: 'Respeitado', icon: 'flame', req: '80 de reputação', grad: ['#9a3412', '#f97316'], ok: (u) => u.reputation >= 80 },
    { id: 'elite', name: 'Elite', icon: 'gem', req: '95 de reputação', grad: ['#0e7490', '#67e8f9'], ok: (u) => u.reputation >= 95 }
  ];
  const BANNERS = [
    { id: 'padrao', name: 'Padrão', req: 'Padrão', bg: 'linear-gradient(135deg,#1c1b2e,#2d2b45 55%,#15141f)', ok: () => true },
    { id: 'roxo', name: 'Roxo Competitivo', req: '5 vitórias', bg: 'linear-gradient(120deg,#3b0f7a,#7c3aed 50%,#c084fc)', ok: (u) => u.stats.wins >= 5 },
    { id: 'ouro', name: 'Ouro Real', req: '15 vitórias', bg: 'linear-gradient(120deg,#6b3a0a,#d97706 48%,#fde68a)', ok: (u) => u.stats.wins >= 15 },
    { id: 'coroa', name: 'Coroa Suprema', req: '25 vitórias', bg: 'linear-gradient(120deg,#5b3308,#b7791f 45%,#f6c453 70%,#8a5a12)', ok: (u) => u.stats.wins >= 25 },
    { id: 'inferno', name: 'Chamas do Inferno', req: '50 kills totais', bg: 'linear-gradient(120deg,#5c0d12,#dc2626 50%,#fb923c)', ok: (u) => u.stats.kills >= 50 },
    { id: 'gelo', name: 'Gelo Mortal', req: '100 kills totais', bg: 'linear-gradient(120deg,#0b3954,#0891b2 50%,#a5f3fc)', ok: (u) => u.stats.kills >= 100 },
    { id: 'diamante', name: 'Elite Diamante', req: '95 de reputação', bg: 'linear-gradient(120deg,#172554,#3b82f6 45%,#2dd4bf)', ok: (u) => u.reputation >= 95 }
  ];
  const TYPES = {
    campeonato: { name: 'Campeonato', icon: 'trophy', tone: 'violet' },
    rapido: { name: 'Rápido', icon: 'zap', tone: 'green' },
    diario: { name: 'Diário', icon: 'calendar', tone: 'cyan' },
    apostas: { name: 'X1 apostado', icon: 'swords', tone: 'gold' }
  };
  const SPLITS = { '1': [100], '3': [60, 30, 10], '5': [45, 25, 15, 10, 5] };
  const MAPS = ['Bermuda', 'Purgatório', 'Kalahari', 'Alpine', 'Nova Terra'];
  const MODES = ['Solo', 'Duo', 'Squad', 'X1'];
  const FF_RANKS = ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Mestre', 'Grão-Mestre'];
  const ROLE_LEVEL = { jogador: 0, moderador: 1, admin: 2, owner: 3 };
  const ROLE_NAME = { jogador: 'Jogador', moderador: 'Moderador', admin: 'Admin', owner: 'Dono' };
  const PERMS = {
    access: 1, users: 1, ban: 1, verify: 1, reports: 1, tournaments: 1, guilds: 1,
    broadcast: 2, finance: 2, balance: 2, roles: 2, settings: 2, logs: 2, remove: 2
  };
  const POINTS = [300, 200, 120, 80, 50];
  const ELO_GAIN = [35, 22, 14, 8, 5];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- dados de exemplo ---------- */
  function seed() {
    const now = Date.now();
    const rand = rng(20260924);
    let n = 0;
    const U = (id, nick, o) => Object.assign({
      id, nick, code: 'BH-' + String(10231 + (n++) * 137).padStart(5, '0'),
      email: nick.toLowerCase().replace(/[^a-z0-9]/g, '') + '@battlehub.gg',
      role: 'jogador', verified: false, banned: false, banReason: '',
      balance: 0, elo: 1000, bio: '', region: 'Brasil',
      ff: { id: '', nick: '', level: '', rank: '' },
      stats: { wins: 0, kills: 0, matches: 0, points: 0, top3: 0 },
      weekly: 0, monthly: 0, reputation: 50,
      followersBase: 0, followers: [], following: [],
      avatar: 'iniciante', banner: 'padrao', guildId: null,
      createdAt: now - Math.round(20 + rand() * 200) * DAY
    }, o);

    const users = [
      U('u1', 'SHADOW lock', { role: 'owner', email: 'shadowlock@battlehub.gg', balance: 47.4, elo: 1500, bio: 'Jogador de Free Fire. Rush na Bermuda.', stats: { wins: 3, kills: 128, matches: 41, points: 2350, top3: 9 }, weekly: 420, monthly: 1650, reputation: 50, followersBase: 12, following: ['u2', 'u7'], avatar: 'assassino', createdAt: now - 40 * DAY }),
      U('u2', 'ShadowKiller', { verified: true, elo: 2620, balance: 312.5, bio: 'Líder dos Dragões de Fogo. Treino todo dia 20h.', stats: { wins: 87, kills: 1432, matches: 410, points: 15200, top3: 140 }, weekly: 2400, monthly: 8900, reputation: 97, followersBase: 1840, avatar: 'elite', banner: 'coroa', guildId: 'g1', ff: { id: '5123344871', nick: 'SK•Killer', level: '78', rank: 'Grão-Mestre' } }),
      U('u3', 'VenomX', { verified: true, elo: 2310, balance: 188, stats: { wins: 64, kills: 1105, matches: 350, points: 12800, top3: 101 }, weekly: 1900, monthly: 7200, reputation: 91, followersBase: 960, avatar: 'lenda', banner: 'inferno', guildId: 'g2', ff: { id: '4409187723', nick: 'VenomX', level: '71', rank: 'Mestre' } }),
      U('u4', 'ThunderGod', { verified: true, elo: 2240, balance: 96.2, stats: { wins: 55, kills: 920, matches: 300, points: 11000, top3: 88 }, weekly: 1700, monthly: 6500, reputation: 86, followersBase: 720, avatar: 'campeao', banner: 'ouro', guildId: 'g1' }),
      U('u5', 'PhoenixRise', { verified: true, elo: 2050, balance: 54, stats: { wins: 42, kills: 780, matches: 260, points: 9400, top3: 70 }, weekly: 1500, monthly: 5800, reputation: 84, followersBase: 540, avatar: 'respeitado', banner: 'inferno', guildId: 'g1' }),
      U('u6', 'NightWolf', { verified: true, elo: 1960, balance: 23.7, stats: { wins: 35, kills: 620, matches: 240, points: 8200, top3: 61 }, weekly: 1200, monthly: 4600, reputation: 80, followersBase: 410, avatar: 'campeao', banner: 'gelo', guildId: 'g3' }),
      U('u7', 'IceQueen', { role: 'moderador', verified: true, elo: 1720, balance: 65, bio: 'Moderação BattleHub. Chamou, eu respondo.', stats: { wins: 30, kills: 540, matches: 220, points: 6900, top3: 52 }, weekly: 1100, monthly: 3900, reputation: 95, followersBase: 880, avatar: 'elite', banner: 'gelo' }),
      U('u8', 'StormBlade', { verified: true, elo: 1390, balance: 12, stats: { wins: 28, kills: 490, matches: 230, points: 5600, top3: 40 }, weekly: 700, monthly: 3100, reputation: 72, followersBase: 190, avatar: 'lenda', banner: 'roxo', guildId: 'g4' }),
      U('u9', 'FireDemon', { elo: 1450, balance: 8.5, stats: { wins: 22, kills: 380, matches: 180, points: 5100, top3: 33 }, weekly: 800, monthly: 2900, reputation: 66, followersBase: 150, avatar: 'vencedor', banner: 'inferno', guildId: 'g4' }),
      U('u10', 'CrazyFF', { elo: 1150, balance: 4, stats: { wins: 8, kills: 150, matches: 90, points: 2100, top3: 14 }, weekly: 350, monthly: 1200, reputation: 58, followersBase: 64, avatar: 'assassino', guildId: 'g2' }),
      U('u11', 'KIRITO', { verified: true, elo: 1540, balance: 140, stats: { wins: 19, kills: 350, matches: 160, points: 4700, top3: 30 }, weekly: 600, monthly: 2500, reputation: 88, followersBase: 2300, avatar: 'campeao', banner: 'roxo' }),
      U('u12', 'ProGamer_FF', { verified: true, elo: 1810, balance: 220, stats: { wins: 26, kills: 470, matches: 200, points: 5900, top3: 44 }, weekly: 900, monthly: 3300, reputation: 90, followersBase: 3100, avatar: 'lenda', banner: 'diamante' }),
      U('u13', 'AlphaSquad', { verified: true, elo: 2010, balance: 400, stats: { wins: 38, kills: 700, matches: 250, points: 8600, top3: 63 }, weekly: 1300, monthly: 5100, reputation: 93, followersBase: 1500, avatar: 'campeao', banner: 'ouro', guildId: 'g2' }),
      U('u14', 'Luna.ff', { elo: 940, balance: 0, stats: { wins: 1, kills: 22, matches: 14, points: 380, top3: 2 }, weekly: 120, monthly: 380, reputation: 50, followersBase: 8, createdAt: now - 2 * DAY }),
      U('u15', 'ZeroRecoil', { banned: true, banReason: 'Aimbot confirmado em 3 partidas', elo: 1880, balance: 0, stats: { wins: 31, kills: 910, matches: 120, points: 0, top3: 20 }, reputation: 12, followersBase: 40 })
    ];

    const T = (id, o) => Object.assign({
      id, name: '', type: 'rapido', mode: 'Solo', map: 'Bermuda', entry: 0, bonus: 0, max: 12,
      participants: [], extra: 0, startsAt: now, status: 'aberto', organizer: 'u13',
      split: '3', fee: 10, featured: false, room: null, chat: [], results: [],
      rules: 'Proibido emulador. Proibido teaming. Print do resultado obrigatório no chat do torneio.',
      createdAt: now - 3 * DAY
    }, o);

    const tournaments = [
      T('t1', { name: 'Copa dos Crias #12', type: 'rapido', mode: 'Solo', map: 'Bermuda', entry: 5, max: 12, participants: ['u3', 'u6', 'u9', 'u10', 'u12'], extra: 7, startsAt: now - 18 * MIN, status: 'ao_vivo', organizer: 'u12', room: { id: '8841207', pass: 'crias12' },
        chat: [{ u: 'u12', text: 'Sala criada. ID e senha liberados para os inscritos.', at: now - 20 * MIN }, { u: 'u9', text: 'Entrei, bora!', at: now - 19 * MIN }, { u: 'u3', text: 'Boa sorte a todos', at: now - 17 * MIN }] }),
      T('t2', { name: 'Campeonato Semanal BH', type: 'campeonato', mode: 'Squad', map: 'Purgatório', entry: 10, max: 48, bonus: 100, participants: ['u2', 'u4', 'u5', 'u11'], extra: 22, startsAt: now + DAY + 3 * HOUR, organizer: 'u13', featured: true, split: '3',
        chat: [{ u: 'u13', text: 'Check-in abre 30 minutos antes. Squad incompleto não entra.', at: now - 5 * HOUR }] }),
      T('t3', { name: 'Arena dos Loucos', type: 'rapido', mode: 'Duo', map: 'Kalahari', entry: 2, max: 16, participants: ['u10', 'u14'], extra: 7, startsAt: now + 2 * HOUR + 10 * MIN, organizer: 'u10' }),
      T('t4', { name: 'Torneio Relâmpago Noturno', type: 'rapido', mode: 'Solo', map: 'Bermuda', entry: 3, max: 24, participants: ['u6', 'u8', 'u9'], extra: 17, startsAt: now + 38 * MIN, organizer: 'u7' }),
      T('t5', { name: 'Royal Battle: Edição Suprema', type: 'campeonato', mode: 'Squad', map: 'Alpine', entry: 15, max: 48, participants: ['u2', 'u3', 'u4', 'u5', 'u6'], extra: 32, startsAt: now + 5 * HOUR, organizer: 'u2', featured: true, split: '5' }),
      T('t6', { name: 'Copa criazz', type: 'campeonato', mode: 'Squad', map: 'Nova Terra', entry: 10, max: 48, participants: ['u11'], extra: 13, startsAt: now + 3 * DAY + 4 * HOUR, organizer: 'u11' }),
      T('t7', { name: 'Diário da Madrugada', type: 'diario', mode: 'Solo', map: 'Purgatório', entry: 0, bonus: 30, max: 50, participants: ['u14', 'u10'], extra: 29, startsAt: now + 9 * HOUR, organizer: 'u13' }),
      T('t8', { name: 'X1 dos Brabos', type: 'apostas', mode: 'X1', map: 'Bermuda', entry: 20, max: 2, participants: ['u3'], extra: 0, startsAt: now + HOUR + 20 * MIN, organizer: 'u3', split: '1', rules: 'Melhor de 3 rodadas. Só pistola e 12. Sem gelo.' }),
      T('t9', { name: 'Liga BH: Rodada 3', type: 'campeonato', mode: 'Squad', map: 'Bermuda', entry: 10, max: 32, participants: ['u1', 'u2', 'u3', 'u4', 'u5'], extra: 27, startsAt: now - 2 * DAY, status: 'finalizado', organizer: 'u13', finishedAt: now - 2 * DAY + 2 * HOUR }),
      T('t10', { name: 'Copa Relâmpago #11', type: 'rapido', mode: 'Solo', map: 'Kalahari', entry: 3, max: 12, participants: ['u1', 'u8', 'u9', 'u10'], extra: 8, startsAt: now - 5 * DAY, status: 'finalizado', organizer: 'u12', finishedAt: now - 5 * DAY + HOUR }),
      T('t11', { name: 'Treino Aberto #7', type: 'diario', mode: 'Duo', map: 'Alpine', entry: 0, max: 24, participants: ['u14'], extra: 3, startsAt: now - DAY, status: 'cancelado', organizer: 'u7', cancelReason: 'Poucos inscritos' })
    ];
    const place = (t, ids) => {
      const p = prizeTable(t, false);
      t.results = ids.map((u, i) => ({ u, place: i + 1, prize: p.prizes[i] || 0 }));
      return p;
    };

    const tx = [];
    const T_ = (o) => tx.push(Object.assign({ id: newId('x'), method: 'Pix', status: 'confirmado' }, o));

    const p9 = place(tournaments[8], ['u2', 'u3', 'u1']);
    const p10 = place(tournaments[9], ['u1', 'u8', 'u9']);
    T_({ userId: 'platform', type: 'taxa', amount: p9.fee, at: now - 2 * DAY + 2 * HOUR, note: 'Liga BH: Rodada 3', tournamentId: 't9' });
    T_({ userId: 'platform', type: 'taxa', amount: p10.fee, at: now - 5 * DAY + HOUR, note: 'Copa Relâmpago #11', tournamentId: 't10' });

    // histórico do jogador logado
    T_({ userId: 'u1', type: 'deposito', amount: 50, at: now - 6 * DAY, note: 'Depósito via Pix' });
    T_({ userId: 'u1', type: 'inscricao', amount: 3, at: now - 5 * DAY - 2 * HOUR, note: 'Copa Relâmpago #11', tournamentId: 't10' });
    T_({ userId: 'u1', type: 'premio', amount: p10.prizes[0], at: now - 5 * DAY + HOUR, note: '1º lugar: Copa Relâmpago #11', tournamentId: 't10' });
    T_({ userId: 'u1', type: 'inscricao', amount: 10, at: now - 3 * DAY, note: 'Liga BH: Rodada 3', tournamentId: 't9' });
    T_({ userId: 'u1', type: 'premio', amount: p9.prizes[2], at: now - 2 * DAY + 2 * HOUR, note: '3º lugar: Liga BH: Rodada 3', tournamentId: 't9' });
    T_({ userId: 'u1', type: 'saque', amount: 30, at: now - DAY - 3 * HOUR, note: 'Saque via Pix', pixKey: 'shadowlock@battlehub.gg' });

    // movimento dos últimos 14 dias (para os gráficos do admin)
    const others = ['u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u13'];
    for (let d = 13; d >= 0; d--) {
      const base = now - d * DAY;
      const deps = 2 + Math.floor(rand() * 4) + (d < 5 ? 1 : 0);
      for (let k = 0; k < deps; k++) {
        const amt = [10, 20, 20, 30, 50, 50, 100, 15][Math.floor(rand() * 8)];
        T_({ userId: others[Math.floor(rand() * others.length)], type: 'deposito', amount: amt, at: base - Math.floor(rand() * 20) * HOUR, note: 'Depósito via Pix' });
      }
      const outs = Math.floor(rand() * 3);
      for (let k = 0; k < outs; k++) {
        const amt = [25, 40, 60, 80, 120][Math.floor(rand() * 5)];
        T_({ userId: others[Math.floor(rand() * others.length)], type: 'saque', amount: amt, at: base - Math.floor(rand() * 20) * HOUR, note: 'Saque via Pix', pixKey: 'chave cadastrada' });
      }
    }
    // pendências para o admin resolver
    T_({ userId: 'u10', type: 'deposito', amount: 20, status: 'pendente', at: now - 35 * MIN, note: 'Depósito via Pix', pixCode: pixCode(20) });
    T_({ userId: 'u14', type: 'deposito', amount: 10, status: 'pendente', at: now - 12 * MIN, note: 'Depósito via Pix', pixCode: pixCode(10) });
    T_({ userId: 'u2', type: 'saque', amount: 150, status: 'pendente', at: now - 2 * HOUR, note: 'Saque via Pix', pixKey: 'CPF ***.482.117-**' });
    T_({ userId: 'u3', type: 'saque', amount: 80, status: 'pendente', at: now - 50 * MIN, note: 'Saque via Pix', pixKey: 'venomx@email.com' });
    T_({ userId: 'u11', type: 'saque', amount: 60, status: 'pendente', at: now - 5 * HOUR, note: 'Saque via Pix', pixKey: '(31) 9****-2210' });
    T_({ userId: 'u9', type: 'deposito', amount: 15, status: 'recusado', at: now - 3 * DAY, note: 'Depósito via Pix', reason: 'Comprovante não encontrado' });

    const guilds = [
      { id: 'g1', name: 'Dragões de Fogo', tag: 'DRG', leader: 'u2', members: ['u2', 'u4', 'u5'], memberCount: 19, max: 30, wins: 45, points: 28000, recruiting: true, minElo: 1800, desc: 'Squad competitivo de BH. Treinos às 20h, campeonatos todo fim de semana.', color: ['#b91c1c', '#f97316'], createdAt: now - 120 * DAY },
      { id: 'g2', name: 'Esquadrão Alpha', tag: 'ALF', leader: 'u3', members: ['u3', 'u10', 'u13'], memberCount: 12, max: 30, wins: 32, points: 19500, recruiting: true, minElo: 1200, desc: 'Aceitamos quem joga em equipe e tem call.', color: ['#6d28d9', '#a78bfa'], createdAt: now - 90 * DAY },
      { id: 'g3', name: 'Sombras da Noite', tag: 'SDN', leader: 'u6', members: ['u6'], memberCount: 8, max: 30, wins: 18, points: 12000, recruiting: true, minElo: 0, desc: 'Guilda da madrugada. Jogamos das 23h às 3h.', color: ['#1e1b4b', '#6366f1'], createdAt: now - 60 * DAY },
      { id: 'g4', name: 'Lobos do Norte', tag: 'LDN', leader: 'u8', members: ['u8', 'u9'], memberCount: 30, max: 30, wins: 25, points: 15400, recruiting: false, minElo: 1300, desc: 'Guilda cheia. Abrimos vagas no início de cada temporada.', color: ['#0f766e', '#5eead4'], createdAt: now - 150 * DAY }
    ];

    const conversations = [
      { id: 'c1', members: ['u1', 'u7'], unread: { u1: 0 }, messages: [
        { from: 'u7', text: 'Oi! Vi que você entrou na Liga BH. Boa sorte na rodada.', at: now - DAY - 2 * HOUR },
        { from: 'u1', text: 'Valeu! Fiquei em 3º, bora subir na próxima.', at: now - DAY - HOUR },
        { from: 'u7', text: 'Manda o print do seu perfil do Free Fire na verificação pra liberar o saque.', at: now - 3 * HOUR }
      ] },
      { id: 'c2', members: ['u1', 'u2'], unread: { u1: 1 }, messages: [
        { from: 'u2', text: 'Bora um X1 hoje à noite? Valendo R$ 20.', at: now - 40 * MIN }
      ] }
    ];

    const notifications = [
      { id: newId('n'), userId: 'u1', title: 'Nova mensagem', body: 'ShadowKiller: Bora um X1 hoje à noite?', icon: 'message', at: now - 40 * MIN, read: false },
      { id: newId('n'), userId: 'u1', title: 'IceQueen começou a te seguir', body: 'Veja o perfil e siga de volta.', icon: 'userPlus', at: now - 3 * HOUR, read: false },
      { id: newId('n'), userId: 'u1', title: 'Saque confirmado', body: 'R$ 30,00 enviados para sua chave Pix.', icon: 'checkCircle', at: now - DAY - 2 * HOUR, read: true },
      { id: newId('n'), userId: 'u1', title: 'Prêmio creditado', body: '3º lugar na Liga BH: Rodada 3.', icon: 'trophy', at: now - 2 * DAY + 2 * HOUR, read: true }
    ];

    const verifications = [
      { id: 'v1', userId: 'u14', image: null, ff: { id: '5238814470', nick: 'Luna•FF', level: '58', rank: 'Diamante' }, at: now - 25 * MIN, status: 'pendente' },
      { id: 'v2', userId: 'u10', image: null, ff: { id: '3317702951', nick: 'CrazyFF', level: '44', rank: 'Ouro' }, at: now - 4 * HOUR, status: 'pendente' },
      { id: 'v3', userId: 'u2', image: null, ff: { id: '5123344871', nick: 'SK•Killer', level: '78', rank: 'Grão-Mestre' }, at: now - 80 * DAY, status: 'aprovada', reviewedBy: 'u1' }
    ];

    const reports = [
      { id: 'r1', reporter: 'u6', target: 'u10', reason: 'Ofensa no chat', detail: 'Xingou todo mundo no chat da Arena dos Loucos depois de cair.', at: now - 3 * HOUR, status: 'aberta' },
      { id: 'r2', reporter: 'u3', target: 'u8', reason: 'Suspeita de hack', detail: 'Mira grudando em quem estava atrás da parede na Liga BH.', at: now - 9 * HOUR, status: 'aberta' },
      { id: 'r3', reporter: 'u14', target: 'u9', reason: 'Cobrança por fora', detail: 'Pediu Pix por fora para garantir vaga no squad.', at: now - DAY, status: 'aberta' },
      { id: 'r4', reporter: 'u5', target: 'u15', reason: 'Suspeita de hack', detail: 'Aimbot evidente, gravei a tela.', at: now - 6 * DAY, status: 'resolvida', resolution: 'Conta banida' }
    ];

    const announcements = [
      { id: 'a1', title: 'Temporada 3 começou', body: 'O ranking semanal zera toda segunda às 00h. Premiação extra para o top 3 da temporada.', target: 'todos', at: now - 2 * DAY, by: 'u1', pinned: true }
    ];

    const matches = [
      { userId: 'u1', name: 'Liga BH: Rodada 3', mode: 'Squad', map: 'Bermuda', place: 3, kills: 9, prize: p9.prizes[2], at: now - 2 * DAY },
      { userId: 'u1', name: 'Copa Relâmpago #11', mode: 'Solo', map: 'Kalahari', place: 1, kills: 12, prize: p10.prizes[0], at: now - 5 * DAY },
      { userId: 'u1', name: 'Treino Squad #4', mode: 'Squad', map: 'Purgatório', place: 6, kills: 4, prize: 0, at: now - 8 * DAY },
      { userId: 'u1', name: 'Diário da Madrugada', mode: 'Solo', map: 'Bermuda', place: 11, kills: 2, prize: 0, at: now - 10 * DAY },
      { userId: 'u1', name: 'Copa dos Crias #10', mode: 'Solo', map: 'Kalahari', place: 2, kills: 8, prize: 14.4, at: now - 14 * DAY }
    ];

    const logs = [
      { id: newId('l'), by: 'u1', action: 'Baniu conta', target: 'ZeroRecoil', detail: 'Aimbot confirmado em 3 partidas', at: now - 6 * DAY },
      { id: newId('l'), by: 'u1', action: 'Finalizou torneio', target: 'Copa Relâmpago #11', detail: 'Prêmios distribuídos', at: now - 5 * DAY + HOUR },
      { id: newId('l'), by: 'u7', action: 'Cancelou torneio', target: 'Treino Aberto #7', detail: 'Poucos inscritos', at: now - DAY },
      { id: newId('l'), by: 'u1', action: 'Finalizou torneio', target: 'Liga BH: Rodada 3', detail: 'Prêmios distribuídos', at: now - 2 * DAY + 2 * HOUR },
      { id: newId('l'), by: 'u1', action: 'Publicou aviso', target: 'Temporada 3 começou', detail: 'Para todos, fixado no início', at: now - 2 * DAY },
      { id: newId('l'), by: 'u1', action: 'Aprovou saque', target: 'SHADOW lock', detail: 'R$ 30,00', at: now - DAY - 2 * HOUR }
    ];

    return {
      version: VERSION,
      session: { userId: 'u1' },
      settings: { fee: 10, minDeposit: 5, minWithdraw: 10, maxWithdraw: 2000, pixKey: 'pix@battlehub.gg', maintenance: false, allowCreate: true },
      users, tournaments, tx, guilds, conversations, notifications, verifications, reports, announcements, matches, logs
    };
  }

  function pixCode(amount) {
    const v = r2(amount).toFixed(2);
    return '00020126580014BR.GOV.BCB.PIX0136battlehub-demo-' + Math.random().toString(36).slice(2, 10) + '5204000053039865406' + v + '5802BR5909BATTLEHUB6014BELO HORIZONTE62070503***6304' + Math.random().toString(16).slice(2, 6).toUpperCase();
  }

  /* ---------- persistência ---------- */
  let db;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === VERSION) return parsed;
      }
    } catch (e) { /* armazenamento indisponível: segue em memória */ }
    return seed();
  }
  function save(topic) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sem espaço ou bloqueado */ }
    emit(topic || 'all');
  }
  const subs = new Set();
  function emit(topic) { subs.forEach((fn) => { try { fn(topic); } catch (e) { console.error(e); } }); }

  /* ---------- leitura ---------- */
  const user = (id) => db.users.find((u) => u.id === id) || null;
  const me = () => (db.session && db.session.userId ? user(db.session.userId) : null);
  const tournament = (id) => db.tournaments.find((t) => t.id === id) || null;
  const guild = (id) => db.guilds.find((g) => g.id === id) || null;
  const count = (t) => t.participants.length + (t.extra || 0);
  const level = (u) => ROLE_LEVEL[(u && u.role) || 'jogador'] || 0;
  const can = (perm, u) => { u = u || me(); return !!u && level(u) >= (PERMS[perm] || 9); };
  const isStaff = (u) => level(u || me()) >= 1;
  const followers = (u) => (u.followersBase || 0) + (u.followers || []).length;

  function prizeTable(t, full) {
    const players = full ? t.max : count(t);
    const entryPool = r2(t.entry * players);
    const feePct = t.fee == null ? db.settings.fee : t.fee;
    const fee = r2(entryPool * feePct / 100);
    const total = r2(entryPool - fee + (t.bonus || 0));
    const split = SPLITS[t.split] || SPLITS['3'];
    return { players, entryPool, fee, feePct, total, split, prizes: split.map((p) => r2(total * p / 100)) };
  }

  function verificationOf(uid) {
    const list = db.verifications.filter((v) => v.userId === uid).sort((a, b) => b.at - a.at);
    return list[0] || null;
  }
  function unlocked(kind, id, u) {
    const list = kind === 'avatar' ? AVATARS : BANNERS;
    const item = list.find((x) => x.id === id);
    return !!item && item.ok(u);
  }
  function rankingList(kind) {
    const key = { elo: (u) => u.elo, global: (u) => u.stats.points, semanal: (u) => u.weekly, mensal: (u) => u.monthly }[kind] || ((u) => u.elo);
    return db.users.filter((u) => !u.banned).map((u) => ({ u, value: key(u) })).sort((a, b) => b.value - a.value);
  }
  function conversationsOf(uid) {
    return db.conversations.filter((c) => c.members.includes(uid))
      .sort((a, b) => lastAt(b) - lastAt(a));
  }
  const lastAt = (c) => (c.messages.length ? c.messages[c.messages.length - 1].at : 0);

  function financeTotals() {
    let entrou = 0, saiu = 0, receita = 0, pendDep = 0, pendSaq = 0;
    db.tx.forEach((x) => {
      if (x.type === 'deposito' && x.status === 'confirmado') entrou += x.amount;
      if (x.type === 'saque' && x.status === 'confirmado') saiu += x.amount;
      if (x.type === 'taxa') receita += x.amount;
      if (x.status === 'pendente' && x.type === 'deposito') pendDep++;
      if (x.status === 'pendente' && x.type === 'saque') pendSaq++;
    });
    return { entrou: r2(entrou), saiu: r2(saiu), liquido: r2(entrou - saiu), receita: r2(receita), pendDep, pendSaq };
  }
  function financeSeries(days) {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let d = days - 1; d >= 0; d--) {
      const start = today.getTime() - d * DAY, end = start + DAY;
      let entrou = 0, saiu = 0;
      db.tx.forEach((x) => {
        if (x.at < start || x.at >= end || x.status !== 'confirmado') return;
        if (x.type === 'deposito') entrou += x.amount;
        if (x.type === 'saque') saiu += x.amount;
      });
      out.push({ start, entrou: r2(entrou), saiu: r2(saiu) });
    }
    return out;
  }
  function pendingCounts() {
    const f = financeTotals();
    return {
      depositos: f.pendDep, saques: f.pendSaq,
      verificacoes: db.verifications.filter((v) => v.status === 'pendente').length,
      denuncias: db.reports.filter((r) => r.status === 'aberta').length,
      aoVivo: db.tournaments.filter((t) => t.status === 'ao_vivo').length
    };
  }

  /* ---------- helpers de escrita ---------- */
  function notify(userId, n) {
    db.notifications.unshift(Object.assign({ id: newId('n'), userId, at: Date.now(), read: false, icon: 'bell' }, n));
    if (db.notifications.length > 300) db.notifications.length = 300;
  }
  function log(action, target, detail) {
    const m = me();
    db.logs.unshift({ id: newId('l'), by: m ? m.id : 'sistema', action, target: target || '', detail: detail || '', at: Date.now() });
    if (db.logs.length > 400) db.logs.length = 400;
  }
  function addTx(o) {
    const t = Object.assign({ id: newId('x'), method: 'Pix', status: 'confirmado', at: Date.now() }, o);
    t.amount = r2(t.amount);
    db.tx.unshift(t);
    return t;
  }
  const fail = (error, code) => ({ ok: false, error, code });
  const okr = (o) => Object.assign({ ok: true }, o || {});
  function guard(perm) {
    const m = me();
    if (!m) return fail('Entre na sua conta.');
    if (perm && !can(perm, m)) return fail('Sua conta não tem permissão para isso.');
    return null;
  }
  const money = (n) => 'R$ ' + r2(n).toFixed(2).replace('.', ',');

  /* ---------- ações do jogador ---------- */
  const act = {};

  act.login = function (login) {
    const q = String(login || '').trim().toLowerCase();
    if (!q) return fail('Digite seu e-mail ou nickname.');
    const u = db.users.find((x) => x.email.toLowerCase() === q || x.nick.toLowerCase() === q);
    if (!u) return fail('Nenhuma conta com esse e-mail ou nickname. Crie uma conta nova.');
    if (u.banned) return fail('Conta banida: ' + (u.banReason || 'violação das regras') + '.');
    db.session = { userId: u.id };
    save();
    return okr({ user: u });
  };
  act.register = function (nick, email) {
    nick = String(nick || '').trim(); email = String(email || '').trim().toLowerCase();
    if (nick.length < 3 || nick.length > 20) return fail('O nickname precisa ter de 3 a 20 caracteres.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Digite um e-mail válido.');
    if (db.users.some((u) => u.nick.toLowerCase() === nick.toLowerCase())) return fail('Esse nickname já está em uso.');
    if (db.users.some((u) => u.email.toLowerCase() === email)) return fail('Já existe uma conta com esse e-mail. Use Entrar.');
    const u = {
      id: newId('u'), nick, email, code: 'BH-' + String(20000 + db.users.length * 71).padStart(5, '0'),
      role: 'jogador', verified: false, banned: false, banReason: '', balance: 0, elo: 1000, bio: '', region: 'Brasil',
      ff: { id: '', nick: '', level: '', rank: '' }, stats: { wins: 0, kills: 0, matches: 0, points: 0, top3: 0 },
      weekly: 0, monthly: 0, reputation: 50, followersBase: 0, followers: [], following: [],
      avatar: 'iniciante', banner: 'padrao', guildId: null, createdAt: Date.now()
    };
    db.users.push(u);
    db.session = { userId: u.id };
    notify(u.id, { title: 'Bem-vindo ao BattleHub', body: 'Complete seu perfil e envie a verificação do Free Fire para liberar saques.', icon: 'sparkles' });
    save();
    return okr({ user: u });
  };
  act.logout = function () { db.session = null; save(); return okr(); };

  act.join = function (tid) {
    const g = guard(); if (g) return g;
    const m = me(), t = tournament(tid);
    if (!t) return fail('Torneio não encontrado.');
    if (m.banned) return fail('Conta banida não pode se inscrever.');
    if (t.status !== 'aberto') return fail('As inscrições desse torneio estão fechadas.');
    if (t.participants.includes(m.id)) return fail('Você já está inscrito.');
    if (count(t) >= t.max) return fail('A sala está cheia.');
    if (t.type === 'apostas' && !m.verified) return fail('X1 apostado exige conta verificada. Envie a verificação do Free Fire no seu perfil.', 'verify');
    if (m.balance < t.entry) return fail('Saldo insuficiente. Faltam ' + money(t.entry - m.balance) + '.', 'saldo');
    m.balance = r2(m.balance - t.entry);
    t.participants.push(m.id);
    if (t.entry > 0) addTx({ userId: m.id, type: 'inscricao', amount: t.entry, note: t.name, tournamentId: t.id });
    notify(m.id, { title: 'Inscrição confirmada', body: t.name + '. O ID e a senha da sala aparecem aqui quando o torneio começar.', icon: 'checkCircle' });
    save();
    return okr();
  };
  act.leave = function (tid) {
    const g = guard(); if (g) return g;
    const m = me(), t = tournament(tid);
    if (!t || !t.participants.includes(m.id)) return fail('Você não está inscrito nesse torneio.');
    if (t.status !== 'aberto') return fail('O torneio já começou.');
    if (t.startsAt - Date.now() < 10 * MIN) return fail('Não dá para sair faltando menos de 10 minutos.');
    t.participants = t.participants.filter((x) => x !== m.id);
    if (t.entry > 0) {
      m.balance = r2(m.balance + t.entry);
      addTx({ userId: m.id, type: 'reembolso', amount: t.entry, note: 'Saída: ' + t.name, tournamentId: t.id });
    }
    save();
    return okr();
  };
  act.createTournament = function (d) {
    const g = guard(); if (g) return g;
    const m = me();
    if (!db.settings.allowCreate && !isStaff(m)) return fail('A criação de torneios está pausada pela administração.');
    if (!m.verified && !isStaff(m)) return fail('Verifique sua conta para criar torneios.', 'verify');
    const name = String(d.name || '').trim();
    if (name.length < 4 || name.length > 40) return fail('O nome precisa ter de 4 a 40 caracteres.');
    const entry = r2(d.entry), max = Math.round(Number(d.max)), bonus = r2(d.bonus || 0);
    if (!(entry >= 0 && entry <= 500)) return fail('A inscrição vai de R$ 0 a R$ 500.');
    if (!(max >= 2 && max <= 100)) return fail('A sala aceita de 2 a 100 jogadores.');
    if (bonus && !can('finance', m)) return fail('Só admins podem garantir prêmio extra.');
    const startsAt = Number(d.startsAt);
    if (!startsAt || startsAt < Date.now() + 10 * MIN) return fail('Marque o início para daqui a pelo menos 10 minutos.');
    const t = {
      id: newId('t'), name, type: TYPES[d.type] ? d.type : 'rapido', mode: MODES.includes(d.mode) ? d.mode : 'Solo',
      map: MAPS.includes(d.map) ? d.map : 'Bermuda', entry, bonus, max, participants: [], extra: 0, startsAt,
      status: 'aberto', organizer: m.id, split: SPLITS[d.split] ? d.split : '3', fee: db.settings.fee,
      featured: false, room: null, chat: [], results: [], rules: String(d.rules || '').trim().slice(0, 600) || 'Proibido emulador. Proibido teaming.', createdAt: Date.now()
    };
    if (t.type === 'apostas') { t.split = '1'; }
    db.tournaments.unshift(t);
    log('Criou torneio', t.name, money(entry) + ' · ' + max + ' vagas');
    save();
    return okr({ tournament: t });
  };
  act.updateTournament = function (tid, d) {
    const g = guard('tournaments'); if (g) return g;
    const t = tournament(tid);
    if (!t) return fail('Torneio não encontrado.');
    if (t.status === 'finalizado' || t.status === 'cancelado') return fail('Torneio encerrado não pode ser editado.');
    const name = String(d.name || '').trim();
    if (name.length < 4 || name.length > 40) return fail('O nome precisa ter de 4 a 40 caracteres.');
    const max = Math.round(Number(d.max));
    if (!(max >= count(t) && max <= 100)) return fail('As vagas precisam ser pelo menos ' + count(t) + ' (inscritos atuais) e no máximo 100.');
    const entry = r2(d.entry);
    if (entry !== t.entry && count(t) > 0) return fail('Não dá para mudar a inscrição com jogadores já inscritos.');
    Object.assign(t, {
      name, max, entry, bonus: r2(d.bonus || 0),
      type: TYPES[d.type] ? d.type : t.type, mode: MODES.includes(d.mode) ? d.mode : t.mode,
      map: MAPS.includes(d.map) ? d.map : t.map, split: SPLITS[d.split] ? d.split : t.split,
      startsAt: Number(d.startsAt) || t.startsAt, rules: String(d.rules || '').trim().slice(0, 600) || t.rules
    });
    log('Editou torneio', t.name);
    save();
    return okr();
  };
  act.tournamentChat = function (tid, text) {
    const g = guard(); if (g) return g;
    const m = me(), t = tournament(tid);
    text = String(text || '').trim();
    if (!t || !text) return fail('Escreva uma mensagem.');
    if (!t.participants.includes(m.id) && t.organizer !== m.id && !isStaff(m)) return fail('Só inscritos podem falar no chat do torneio.');
    t.chat.push({ u: m.id, text: text.slice(0, 300), at: Date.now() });
    save('chat');
    return okr();
  };

  act.requestDeposit = function (amount) {
    const g = guard(); if (g) return g;
    amount = r2(amount);
    if (!(amount >= db.settings.minDeposit)) return fail('O depósito mínimo é ' + money(db.settings.minDeposit) + '.');
    if (amount > 5000) return fail('O depósito máximo é R$ 5.000,00.');
    const t = addTx({ userId: me().id, type: 'deposito', amount, status: 'pendente', note: 'Depósito via Pix', pixCode: pixCode(amount) });
    save();
    return okr({ tx: t });
  };
  act.confirmDepositSent = function (txId) {
    const t = db.tx.find((x) => x.id === txId);
    if (!t) return fail('Depósito não encontrado.');
    t.paidAt = Date.now();
    notify(t.userId, { title: 'Depósito em análise', body: money(t.amount) + '. Assim que o Pix cair, o saldo entra na sua carteira.', icon: 'clock' });
    save();
    return okr();
  };
  act.requestWithdraw = function (amount, keyType, key) {
    const g = guard(); if (g) return g;
    const m = me();
    amount = r2(amount); key = String(key || '').trim();
    if (!m.verified) return fail('Saque exige conta verificada. Envie a verificação do Free Fire.', 'verify');
    if (!(amount >= db.settings.minWithdraw)) return fail('O saque mínimo é ' + money(db.settings.minWithdraw) + '.');
    if (amount > db.settings.maxWithdraw) return fail('O saque máximo por pedido é ' + money(db.settings.maxWithdraw) + '.');
    if (amount > m.balance) return fail('Você tem ' + money(m.balance) + ' disponível.');
    if (key.length < 5) return fail('Digite sua chave Pix.');
    m.balance = r2(m.balance - amount);
    addTx({ userId: m.id, type: 'saque', amount, status: 'pendente', note: 'Saque via Pix', pixKey: keyType + ': ' + key });
    notify(m.id, { title: 'Saque solicitado', body: money(amount) + ' em análise. Prazo de até 24 horas.', icon: 'clock' });
    save();
    return okr();
  };
  act.submitVerification = function (image, ff) {
    const g = guard(); if (g) return g;
    const m = me();
    const cur = verificationOf(m.id);
    if (m.verified) return fail('Sua conta já está verificada.');
    if (cur && cur.status === 'pendente') return fail('Sua verificação já está em análise.');
    if (!image) return fail('Escolha o print do seu perfil do Free Fire.');
    if (!/^\d{8,12}$/.test(String(ff.id || ''))) return fail('O ID do Free Fire tem de 8 a 12 números.');
    if (!String(ff.nick || '').trim()) return fail('Digite seu nick no jogo.');
    const lv = Number(ff.level);
    if (!(lv >= 1 && lv <= 100)) return fail('O level vai de 1 a 100.');
    if (!FF_RANKS.includes(ff.rank)) return fail('Selecione seu rank atual.');
    db.verifications.unshift({ id: newId('v'), userId: m.id, image, ff: { id: String(ff.id), nick: String(ff.nick).trim(), level: String(lv), rank: ff.rank }, at: Date.now(), status: 'pendente' });
    save();
    return okr();
  };
  act.updateProfile = function (d) {
    const g = guard(); if (g) return g;
    const m = me();
    const nick = String(d.nick || '').trim();
    if (nick.length < 3 || nick.length > 20) return fail('O nickname precisa ter de 3 a 20 caracteres.');
    if (db.users.some((u) => u.id !== m.id && u.nick.toLowerCase() === nick.toLowerCase())) return fail('Esse nickname já está em uso.');
    if (d.ffId && !/^\d{8,12}$/.test(String(d.ffId))) return fail('O ID do Free Fire tem de 8 a 12 números.');
    if (d.ffLevel && !(Number(d.ffLevel) >= 1 && Number(d.ffLevel) <= 100)) return fail('O level vai de 1 a 100.');
    m.nick = nick;
    m.bio = String(d.bio || '').trim().slice(0, 140);
    m.region = String(d.region || '').trim().slice(0, 30) || 'Brasil';
    if (!m.verified) m.ff = { id: String(d.ffId || ''), nick: String(d.ffNick || '').trim(), level: String(d.ffLevel || ''), rank: FF_RANKS.includes(d.ffRank) ? d.ffRank : '' };
    save();
    return okr();
  };
  act.setLook = function (kind, id) {
    const g = guard(); if (g) return g;
    const m = me();
    if (!unlocked(kind, id, m)) return fail('Esse item ainda está bloqueado.');
    m[kind] = id;
    save();
    return okr();
  };
  act.follow = function (uid) {
    const g = guard(); if (g) return g;
    const m = me(), u = user(uid);
    if (!u || u.id === m.id) return fail('Jogador não encontrado.');
    const i = m.following.indexOf(uid);
    if (i >= 0) { m.following.splice(i, 1); u.followers = (u.followers || []).filter((x) => x !== m.id); }
    else { m.following.push(uid); u.followers = (u.followers || []).concat(m.id); notify(u.id, { title: m.nick + ' começou a te seguir', body: 'Veja o perfil e siga de volta.', icon: 'userPlus' }); }
    save();
    return okr({ following: i < 0 });
  };
  act.report = function (uid, reason, detail) {
    const g = guard(); if (g) return g;
    if (!reason) return fail('Escolha o motivo da denúncia.');
    db.reports.unshift({ id: newId('r'), reporter: me().id, target: uid, reason, detail: String(detail || '').trim().slice(0, 300), at: Date.now(), status: 'aberta' });
    save();
    return okr();
  };

  act.createGuild = function (d) {
    const g = guard(); if (g) return g;
    const m = me();
    if (m.guildId) return fail('Saia da sua guilda atual antes de criar outra.');
    const name = String(d.name || '').trim(), tag = String(d.tag || '').trim().toUpperCase();
    if (name.length < 3 || name.length > 24) return fail('O nome precisa ter de 3 a 24 caracteres.');
    if (!/^[A-Z0-9]{2,4}$/.test(tag)) return fail('A tag tem de 2 a 4 letras ou números.');
    if (db.guilds.some((x) => x.tag === tag)) return fail('Essa tag já existe.');
    const palettes = [['#6d28d9', '#a78bfa'], ['#b91c1c', '#f97316'], ['#0f766e', '#5eead4'], ['#a16207', '#fde047'], ['#1d4ed8', '#7dd3fc']];
    const gd = { id: newId('g'), name, tag, leader: m.id, members: [m.id], memberCount: 1, max: 30, wins: 0, points: 0, recruiting: true, minElo: Math.max(0, Math.round(Number(d.minElo) || 0)), desc: String(d.desc || '').trim().slice(0, 200), color: palettes[db.guilds.length % palettes.length], createdAt: Date.now() };
    db.guilds.unshift(gd);
    m.guildId = gd.id;
    save();
    return okr({ guild: gd });
  };
  act.joinGuild = function (gid) {
    const g = guard(); if (g) return g;
    const m = me(), gd = guild(gid);
    if (!gd) return fail('Guilda não encontrada.');
    if (m.guildId) return fail('Você já está em uma guilda.');
    if (!gd.recruiting) return fail('Essa guilda não está recrutando.');
    if (gd.memberCount >= gd.max) return fail('A guilda está cheia.');
    if (m.elo < gd.minElo) return fail('Essa guilda pede ELO mínimo de ' + gd.minElo + '.');
    gd.members.push(m.id); gd.memberCount++; m.guildId = gd.id;
    notify(gd.leader, { title: 'Novo membro na ' + gd.name, body: m.nick + ' entrou na guilda.', icon: 'users' });
    save();
    return okr();
  };
  act.leaveGuild = function () {
    const g = guard(); if (g) return g;
    const m = me(), gd = guild(m.guildId);
    if (!gd) { m.guildId = null; save(); return okr(); }
    if (gd.leader === m.id && gd.memberCount > 1) return fail('Você é o líder. Passe a liderança antes de sair.');
    gd.members = gd.members.filter((x) => x !== m.id); gd.memberCount = Math.max(0, gd.memberCount - 1); m.guildId = null;
    if (gd.memberCount === 0) db.guilds = db.guilds.filter((x) => x.id !== gd.id);
    save();
    return okr();
  };

  const REPLIES = ['Fechou! Que horas?', 'Tô dentro, manda o ID da sala.', 'Hoje não dá, amanhã?', 'Kkkk bora', 'Joga muito, mano', 'Vou chamar o squad', 'Beleza, te espero no lobby', 'Top! GG'];
  act.openConversation = function (uid) {
    const g = guard(); if (g) return g;
    const m = me();
    if (uid === m.id) return fail('Escolha outro jogador.');
    let c = db.conversations.find((x) => x.members.includes(m.id) && x.members.includes(uid));
    if (!c) { c = { id: newId('c'), members: [m.id, uid], unread: {}, messages: [] }; db.conversations.unshift(c); save(); }
    return okr({ conversation: c });
  };
  act.sendMessage = function (cid, text) {
    const g = guard(); if (g) return g;
    const m = me(), c = db.conversations.find((x) => x.id === cid);
    text = String(text || '').trim();
    if (!c || !text) return fail('Escreva uma mensagem.');
    c.messages.push({ from: m.id, text: text.slice(0, 500), at: Date.now() });
    save('chat');
    const other = c.members.find((x) => x !== m.id);
    if (other && user(other) && !user(other).banned) {
      c.typing = other;
      setTimeout(() => emit('chat'), 500);
      setTimeout(() => {
        c.typing = null;
        c.messages.push({ from: other, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], at: Date.now() });
        c.unread = c.unread || {};
        c.unread[m.id] = (c.unread[m.id] || 0) + 1;
        save('chat');
      }, 1600 + Math.random() * 1400);
    }
    return okr();
  };
  act.readConversation = function (cid) {
    const m = me(), c = db.conversations.find((x) => x.id === cid);
    if (!m || !c) return;
    c.unread = c.unread || {};
    if (c.unread[m.id]) { c.unread[m.id] = 0; save('notif'); }
  };
  act.readNotifications = function () {
    const m = me(); if (!m) return;
    db.notifications.forEach((n) => { if (n.userId === m.id) n.read = true; });
    save('notif');
  };

  /* ---------- ações do admin ---------- */
  act.approveDeposit = function (txId) {
    const g = guard('finance'); if (g) return g;
    const t = db.tx.find((x) => x.id === txId && x.type === 'deposito' && x.status === 'pendente');
    if (!t) return fail('Depósito já foi resolvido.');
    const u = user(t.userId);
    t.status = 'confirmado'; t.reviewedBy = me().id; t.reviewedAt = Date.now();
    if (u) { u.balance = r2(u.balance + t.amount); notify(u.id, { title: 'Depósito confirmado', body: money(t.amount) + ' adicionados à sua carteira.', icon: 'checkCircle', tone: 'good' }); }
    log('Aprovou depósito', u ? u.nick : '?', money(t.amount));
    save();
    return okr({ user: u });
  };
  act.rejectDeposit = function (txId, reason) {
    const g = guard('finance'); if (g) return g;
    const t = db.tx.find((x) => x.id === txId && x.type === 'deposito' && x.status === 'pendente');
    if (!t) return fail('Depósito já foi resolvido.');
    t.status = 'recusado'; t.reason = reason || 'Pagamento não identificado'; t.reviewedBy = me().id; t.reviewedAt = Date.now();
    const u = user(t.userId);
    if (u) notify(u.id, { title: 'Depósito recusado', body: money(t.amount) + ': ' + t.reason + '.', icon: 'alert', tone: 'bad' });
    log('Recusou depósito', u ? u.nick : '?', money(t.amount) + ' · ' + t.reason);
    save();
    return okr();
  };
  act.approveWithdraw = function (txId) {
    const g = guard('finance'); if (g) return g;
    const t = db.tx.find((x) => x.id === txId && x.type === 'saque' && x.status === 'pendente');
    if (!t) return fail('Saque já foi resolvido.');
    t.status = 'confirmado'; t.reviewedBy = me().id; t.reviewedAt = Date.now();
    const u = user(t.userId);
    if (u) notify(u.id, { title: 'Saque confirmado', body: money(t.amount) + ' enviados para sua chave Pix.', icon: 'checkCircle', tone: 'good' });
    log('Aprovou saque', u ? u.nick : '?', money(t.amount));
    save();
    return okr();
  };
  act.rejectWithdraw = function (txId, reason) {
    const g = guard('finance'); if (g) return g;
    const t = db.tx.find((x) => x.id === txId && x.type === 'saque' && x.status === 'pendente');
    if (!t) return fail('Saque já foi resolvido.');
    t.status = 'recusado'; t.reason = reason || 'Chave Pix inválida'; t.reviewedBy = me().id; t.reviewedAt = Date.now();
    const u = user(t.userId);
    if (u) {
      u.balance = r2(u.balance + t.amount);
      notify(u.id, { title: 'Saque recusado', body: money(t.amount) + ' voltaram para sua carteira. Motivo: ' + t.reason + '.', icon: 'alert', tone: 'bad' });
    }
    log('Recusou saque', u ? u.nick : '?', money(t.amount) + ' · ' + t.reason);
    save();
    return okr();
  };
  act.reviewVerification = function (vid, approve, note) {
    const g = guard('verify'); if (g) return g;
    const v = db.verifications.find((x) => x.id === vid);
    if (!v || v.status !== 'pendente') return fail('Verificação já foi analisada.');
    const u = user(v.userId);
    v.status = approve ? 'aprovada' : 'recusada'; v.note = note || ''; v.reviewedBy = me().id; v.reviewedAt = Date.now();
    if (u) {
      if (approve) {
        u.verified = true; u.ff = Object.assign({}, v.ff);
        notify(u.id, { title: 'Conta verificada', body: 'Saques e X1 apostado liberados.', icon: 'badgeCheck', tone: 'good' });
      } else {
        notify(u.id, { title: 'Verificação recusada', body: (note || 'O print não mostra ID, level e rank') + '. Envie outro print.', icon: 'alert', tone: 'bad' });
      }
    }
    log(approve ? 'Aprovou verificação' : 'Recusou verificação', u ? u.nick : '?', note || '');
    save();
    return okr();
  };
  act.setRole = function (uid, role) {
    const g = guard('roles'); if (g) return g;
    const m = me(), u = user(uid);
    if (!u || !ROLE_LEVEL.hasOwnProperty(role) || role === 'owner') return fail('Cargo inválido.');
    if (u.id === m.id) return fail('Você não pode mudar o próprio cargo.');
    if (u.role === 'owner') return fail('O cargo do dono não pode ser alterado.');
    if (role === 'admin' && m.role !== 'owner') return fail('Só o dono pode nomear admins.');
    if (level(u) >= level(m)) return fail('Você não pode alterar alguém do mesmo cargo ou acima.');
    const before = ROLE_NAME[u.role];
    u.role = role;
    notify(u.id, { title: 'Seu cargo mudou', body: 'Agora você é ' + ROLE_NAME[role] + '.', icon: 'shieldCheck' });
    log('Alterou cargo', u.nick, before + ' → ' + ROLE_NAME[role]);
    save();
    return okr();
  };
  act.setVerified = function (uid, value) {
    const g = guard('verify'); if (g) return g;
    const u = user(uid); if (!u) return fail('Conta não encontrada.');
    u.verified = !!value;
    if (value) notify(u.id, { title: 'Conta verificada', body: 'Saques e X1 apostado liberados.', icon: 'badgeCheck', tone: 'good' });
    log(value ? 'Verificou conta' : 'Removeu verificação', u.nick);
    save();
    return okr();
  };
  act.setBan = function (uid, banned, reason) {
    const g = guard('ban'); if (g) return g;
    const m = me(), u = user(uid);
    if (!u) return fail('Conta não encontrada.');
    if (u.id === m.id) return fail('Você não pode banir a própria conta.');
    if (level(u) >= level(m)) return fail('Você não pode banir alguém do mesmo cargo ou acima.');
    if (banned && !String(reason || '').trim()) return fail('Escreva o motivo do banimento.');
    u.banned = !!banned; u.banReason = banned ? String(reason).trim() : '';
    if (banned) {
      db.tournaments.forEach((t) => {
        if (t.status === 'aberto' && t.participants.includes(u.id)) {
          t.participants = t.participants.filter((x) => x !== u.id);
          if (t.entry > 0) { u.balance = r2(u.balance + t.entry); addTx({ userId: u.id, type: 'reembolso', amount: t.entry, note: 'Removido: ' + t.name }); }
        }
      });
    }
    log(banned ? 'Baniu conta' : 'Desbaniu conta', u.nick, reason || '');
    save();
    return okr();
  };
  act.adjustBalance = function (uid, delta, reason) {
    const g = guard('balance'); if (g) return g;
    const u = user(uid); delta = r2(delta);
    if (!u) return fail('Conta não encontrada.');
    if (!delta) return fail('Digite um valor diferente de zero.');
    if (!String(reason || '').trim()) return fail('Escreva o motivo do ajuste.');
    if (u.balance + delta < 0) return fail('O saldo não pode ficar negativo. Saldo atual: ' + money(u.balance) + '.');
    u.balance = r2(u.balance + delta);
    addTx({ userId: u.id, type: 'ajuste', amount: Math.abs(delta), sign: delta > 0 ? 1 : -1, note: String(reason).trim() });
    notify(u.id, { title: delta > 0 ? 'Crédito na carteira' : 'Débito na carteira', body: (delta > 0 ? '+' : '−') + money(Math.abs(delta)) + ': ' + String(reason).trim() + '.', icon: 'wallet' });
    log('Ajustou saldo', u.nick, (delta > 0 ? '+' : '−') + money(Math.abs(delta)) + ' · ' + reason);
    save();
    return okr();
  };
  act.setElo = function (uid, elo) {
    const g = guard('balance'); if (g) return g;
    const u = user(uid); elo = Math.round(Number(elo));
    if (!u) return fail('Conta não encontrada.');
    if (!(elo >= 0 && elo <= 4000)) return fail('O ELO vai de 0 a 4000.');
    const before = u.elo; u.elo = elo;
    log('Ajustou ELO', u.nick, before + ' → ' + elo);
    save();
    return okr();
  };
  act.messageUser = function (uid, title, body) {
    const g = guard('users'); if (g) return g;
    const u = user(uid);
    if (!u) return fail('Conta não encontrada.');
    if (!String(title || '').trim() || !String(body || '').trim()) return fail('Preencha título e mensagem.');
    notify(u.id, { title: String(title).trim(), body: String(body).trim(), icon: 'megaphone' });
    log('Enviou aviso', u.nick, String(title).trim());
    save();
    return okr();
  };
  act.deleteUser = function (uid) {
    const g = guard('remove'); if (g) return g;
    const m = me(), u = user(uid);
    if (!u) return fail('Conta não encontrada.');
    if (u.id === m.id || u.role === 'owner') return fail('Essa conta não pode ser excluída.');
    if (u.balance > 0) return fail('A conta ainda tem ' + money(u.balance) + '. Zere o saldo antes de excluir.');
    db.users = db.users.filter((x) => x.id !== uid);
    db.tournaments.forEach((t) => { t.participants = t.participants.filter((x) => x !== uid); });
    db.guilds.forEach((gd) => { if (gd.members.includes(uid)) { gd.members = gd.members.filter((x) => x !== uid); gd.memberCount = Math.max(0, gd.memberCount - 1); } });
    db.conversations = db.conversations.filter((c) => !c.members.includes(uid));
    log('Excluiu conta', u.nick);
    save();
    return okr();
  };

  act.startTournament = function (tid, roomId, roomPass) {
    const g = guard('tournaments'); if (g) return g;
    const t = tournament(tid);
    if (!t || t.status !== 'aberto') return fail('Só torneios com inscrições abertas podem começar.');
    if (!/^\d{5,12}$/.test(String(roomId || ''))) return fail('O ID da sala tem de 5 a 12 números.');
    if (!String(roomPass || '').trim()) return fail('Digite a senha da sala.');
    if (count(t) < 2) return fail('O torneio precisa de pelo menos 2 inscritos.');
    t.status = 'ao_vivo'; t.room = { id: String(roomId), pass: String(roomPass).trim() }; t.startedAt = Date.now();
    t.participants.forEach((uid) => notify(uid, { title: t.name + ' começou', body: 'Sala ' + t.room.id + ' · senha ' + t.room.pass + '. Entre agora.', icon: 'radio', tone: 'live' }));
    t.chat.push({ u: me().id, text: 'Sala liberada. Boa sorte a todos!', at: Date.now() });
    log('Iniciou torneio', t.name, 'Sala ' + t.room.id);
    save();
    return okr();
  };
  act.finishTournament = function (tid, placements) {
    const g = guard('tournaments'); if (g) return g;
    const t = tournament(tid);
    if (!t || (t.status !== 'ao_vivo' && t.status !== 'aberto')) return fail('Esse torneio já foi encerrado.');
    const p = prizeTable(t, false);
    const ids = (placements || []).filter(Boolean);
    const need = Math.min(p.split.length, t.participants.length);
    if (ids.length < need) return fail('Escolha os ' + need + ' primeiros colocados.');
    if (new Set(ids).size !== ids.length) return fail('Um jogador não pode ocupar duas posições.');
    if (ids.some((x) => !t.participants.includes(x))) return fail('Só inscritos podem ser premiados.');
    // prêmio não distribuído (menos inscritos conhecidos que posições) volta para a plataforma
    let paid = 0;
    t.results = ids.slice(0, p.split.length).map((uid, i) => {
      const prize = p.prizes[i];
      const u = user(uid);
      paid += prize;
      if (u) {
        if (prize > 0) {
          u.balance = r2(u.balance + prize);
          addTx({ userId: uid, type: 'premio', amount: prize, note: (i + 1) + 'º lugar: ' + t.name, tournamentId: t.id });
        }
        u.stats.points += POINTS[i] || 0; u.weekly += POINTS[i] || 0; u.monthly += POINTS[i] || 0;
        u.elo += ELO_GAIN[i] || 0;
        if (i === 0) u.stats.wins++;
        if (i < 3) u.stats.top3++;
        notify(uid, { title: 'Você ficou em ' + (i + 1) + 'º', body: t.name + (prize > 0 ? '. ' + money(prize) + ' creditados na carteira.' : '.'), icon: 'trophy', tone: 'good' });
      }
      return { u: uid, place: i + 1, prize };
    });
    const unpaid = r2(p.prizes.slice(t.results.length).reduce((a, b) => a + b, 0));
    const fee = r2(p.fee + unpaid);
    if (fee > 0) addTx({ userId: 'platform', type: 'taxa', amount: fee, note: t.name, tournamentId: t.id });
    const rand = rng(t.id.length * 7919 + t.participants.length);
    t.participants.forEach((uid, idx) => {
      const u = user(uid); if (!u) return;
      u.stats.matches++;
      const pos = ids.indexOf(uid);
      const placeN = pos >= 0 ? pos + 1 : Math.min(count(t), ids.length + 1 + idx);
      const kills = Math.floor(rand() * 9) + (pos === 0 ? 6 : 1);
      u.stats.kills += kills;
      if (pos < 0) u.elo = Math.max(0, u.elo - 6);
      db.matches.unshift({ userId: uid, name: t.name, mode: t.mode, map: t.map, place: placeN, kills, prize: pos >= 0 ? t.results[pos].prize : 0, at: Date.now() });
    });
    t.status = 'finalizado'; t.finishedAt = Date.now();
    log('Finalizou torneio', t.name, 'Distribuídos ' + money(paid) + ' · taxa ' + money(fee));
    save();
    return okr({ paid: r2(paid), fee });
  };
  act.cancelTournament = function (tid, reason) {
    const g = guard('tournaments'); if (g) return g;
    const t = tournament(tid);
    if (!t || t.status === 'finalizado' || t.status === 'cancelado') return fail('Esse torneio já foi encerrado.');
    if (!String(reason || '').trim()) return fail('Escreva o motivo do cancelamento.');
    let refunded = 0;
    t.participants.forEach((uid) => {
      const u = user(uid); if (!u) return;
      if (t.entry > 0) {
        u.balance = r2(u.balance + t.entry); refunded += t.entry;
        addTx({ userId: uid, type: 'reembolso', amount: t.entry, note: 'Cancelado: ' + t.name, tournamentId: t.id });
      }
      notify(uid, { title: t.name + ' foi cancelado', body: (t.entry > 0 ? money(t.entry) + ' devolvidos. ' : '') + 'Motivo: ' + reason + '.', icon: 'alert', tone: 'bad' });
    });
    t.status = 'cancelado'; t.cancelReason = String(reason).trim();
    log('Cancelou torneio', t.name, reason + (refunded ? ' · reembolso ' + money(refunded) : ''));
    save();
    return okr({ refunded: r2(refunded) });
  };
  act.toggleFeatured = function (tid) {
    const g = guard('tournaments'); if (g) return g;
    const t = tournament(tid); if (!t) return fail('Torneio não encontrado.');
    t.featured = !t.featured;
    log(t.featured ? 'Destacou torneio' : 'Tirou destaque', t.name);
    save();
    return okr({ featured: t.featured });
  };
  act.deleteTournament = function (tid) {
    const g = guard('remove'); if (g) return g;
    const t = tournament(tid); if (!t) return fail('Torneio não encontrado.');
    if (t.status === 'aberto' || t.status === 'ao_vivo') return fail('Cancele o torneio antes de excluir, para devolver as inscrições.');
    db.tournaments = db.tournaments.filter((x) => x.id !== tid);
    log('Excluiu torneio', t.name);
    save();
    return okr();
  };

  act.toggleRecruiting = function (gid) {
    const g = guard('guilds'); if (g) return g;
    const gd = guild(gid); if (!gd) return fail('Guilda não encontrada.');
    gd.recruiting = !gd.recruiting;
    log(gd.recruiting ? 'Abriu recrutamento' : 'Fechou recrutamento', gd.name);
    save();
    return okr();
  };
  act.dissolveGuild = function (gid) {
    const g = guard('guilds'); if (g) return g;
    const gd = guild(gid); if (!gd) return fail('Guilda não encontrada.');
    db.users.forEach((u) => { if (u.guildId === gid) { u.guildId = null; notify(u.id, { title: 'Guilda dissolvida', body: gd.name + ' foi dissolvida pela moderação.', icon: 'alert' }); } });
    db.guilds = db.guilds.filter((x) => x.id !== gid);
    log('Dissolveu guilda', gd.name + ' [' + gd.tag + ']');
    save();
    return okr();
  };
  act.resolveReport = function (rid, resolution) {
    const g = guard('reports'); if (g) return g;
    const r = db.reports.find((x) => x.id === rid);
    if (!r || r.status !== 'aberta') return fail('Denúncia já foi resolvida.');
    r.status = resolution === 'descartada' ? 'descartada' : 'resolvida';
    r.resolution = resolution === 'descartada' ? 'Sem violação' : resolution; r.reviewedBy = me().id; r.reviewedAt = Date.now();
    const t = user(r.target);
    notify(r.reporter, { title: 'Sua denúncia foi analisada', body: (t ? t.nick + ': ' : '') + r.resolution + '. Obrigado por ajudar.', icon: 'shieldCheck' });
    log(r.status === 'resolvida' ? 'Resolveu denúncia' : 'Descartou denúncia', t ? t.nick : '?', r.reason + ' · ' + r.resolution);
    save();
    return okr();
  };
  act.broadcast = function (title, body, target, pinned) {
    const g = guard('broadcast'); if (g) return g;
    title = String(title || '').trim(); body = String(body || '').trim();
    if (title.length < 3) return fail('Escreva um título.');
    if (body.length < 5) return fail('Escreva a mensagem.');
    const who = db.users.filter((u) => !u.banned && (target === 'verificados' ? u.verified : target === 'staff' ? level(u) >= 1 : true));
    who.forEach((u) => notify(u.id, { title, body, icon: 'megaphone' }));
    if (pinned) db.announcements.forEach((a) => { a.pinned = false; });
    db.announcements.unshift({ id: newId('a'), title, body, target: target || 'todos', at: Date.now(), by: me().id, pinned: !!pinned, reach: who.length });
    log('Publicou aviso', title, who.length + ' contas' + (pinned ? ', fixado no início' : ''));
    save();
    return okr({ reach: who.length });
  };
  act.unpinAnnouncement = function (aid) {
    const g = guard('broadcast'); if (g) return g;
    const a = db.announcements.find((x) => x.id === aid); if (!a) return fail('Aviso não encontrado.');
    a.pinned = !a.pinned;
    if (a.pinned) db.announcements.forEach((x) => { if (x !== a) x.pinned = false; });
    save();
    return okr();
  };
  act.updateSettings = function (patch) {
    const g = guard('settings'); if (g) return g;
    const s = db.settings, next = Object.assign({}, s, patch);
    next.fee = Number(next.fee); next.minDeposit = r2(next.minDeposit); next.minWithdraw = r2(next.minWithdraw); next.maxWithdraw = r2(next.maxWithdraw);
    if (!(next.fee >= 0 && next.fee <= 30)) return fail('A taxa vai de 0% a 30%.');
    if (!(next.minDeposit >= 1)) return fail('O depósito mínimo precisa ser de pelo menos R$ 1,00.');
    if (!(next.minWithdraw >= 1)) return fail('O saque mínimo precisa ser de pelo menos R$ 1,00.');
    if (!(next.maxWithdraw >= next.minWithdraw)) return fail('O saque máximo precisa ser maior que o mínimo.');
    if (String(next.pixKey || '').trim().length < 5) return fail('Digite a chave Pix da plataforma.');
    const changed = Object.keys(patch).filter((k) => String(s[k]) !== String(next[k]));
    db.settings = next;
    if (changed.length) log('Alterou configurações', changed.join(', '));
    save();
    return okr();
  };
  act.resetDemo = function () {
    db = seed();
    save();
    return okr();
  };

  db = load();

  BH.store = {
    get db() { return db; },
    MIN, HOUR, DAY, TIERS, AVATARS, BANNERS, TYPES, SPLITS, MAPS, MODES, FF_RANKS, ROLE_NAME, ROLE_LEVEL,
    user, me, tournament, guild, count, can, isStaff, level, followers, prizeTable, tierOf,
    verificationOf, unlocked, rankingList, conversationsOf, lastAt, financeTotals, financeSeries, pendingCounts,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    r2
  };
  BH.act = act;
})();
