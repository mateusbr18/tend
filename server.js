const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'ferramenta1.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hashPwd(p) { return crypto.createHash('sha256').update(p).digest('hex'); }

// ── Schema ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company_id INTEGER NOT NULL REFERENCES companies(id)
  );
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id)
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','leader','head','company')),
    team_id INTEGER REFERENCES teams(id),
    department_id INTEGER REFERENCES departments(id),
    company_id INTEGER REFERENCES companies(id)
  );
  CREATE TABLE IF NOT EXISTS cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    label TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS valores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position INTEGER NOT NULL,
    name_en TEXT NOT NULL,
    question_en TEXT NOT NULL,
    msg_gap_en TEXT NOT NULL,
    grow_action_en TEXT NOT NULL,
    grow_tool_en TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    cycle_id INTEGER NOT NULL REFERENCES cycles(id),
    valor_id INTEGER NOT NULL REFERENCES valores(id),
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    answered_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, cycle_id, valor_id)
  );
`);

// ── Seed ───────────────────────────────────────
const cnt = db.prepare('SELECT COUNT(*) as c FROM valores').get();
if (cnt.c === 0) {
  const seedTx = db.transaction(() => {
    // Valores
    const iv = db.prepare('INSERT INTO valores (position,name_en,question_en,msg_gap_en,grow_action_en,grow_tool_en) VALUES (?,?,?,?,?,?)');
    const V = [
      [1,'Wellbeing','In the last two weeks, I ended my workday with energy left for my life.','Your energy is being consumed faster than it\'s replenished. Something in the pace or workload needs to change.','Redesign rituals, workload, cadence','Tool: team rituals redesign'],
      [2,'Authenticity','In the last two weeks, I said what I really thought without fear.','Something in the environment is making you self-censor. Psychological safety is low.','Create safe space for dissent','Practice: structured dissent rounds'],
      [3,'Service','In the last two weeks, I could see how my work made a difference for someone.','You\'re delivering, but can\'t see for whom. The connection between task and impact is gone.','Impact map — connect each task to the person it helps','Tool: impact map'],
      [4,'Fair Reward','I feel that what I earn is fair for what I deliver.','The math doesn\'t add up. What you deliver and what you receive are misaligned.','Alignment conversation on compensation and recognition','Structured compensation conversation'],
      [5,'Autonomy','In the last two weeks, I chose how to do my work.','Someone is making too many decisions for you. You execute, but you don\'t choose.','Delegation matrix — redefine autonomy levels','Tool: delegation matrix (7 levels)'],
      [6,'Belonging','In the last two weeks, someone on my team truly supported me.','You\'re on the team, but you don\'t feel the team is with you.','Genuine connection rituals (not forced happy hours)','Practice: belonging rituals'],
      [7,'Growth','In the last two weeks, I learned something that matters to me.','You\'re repeating what you already know. Learning has stopped.','Capability matrix — map what you want to learn','Tool: capability matrix'],
      [8,'Achievement','In the last two weeks, I delivered something I\'m proud of.','You\'re delivering, but nothing you\'re proud of. The bar is low or the work doesn\'t challenge you.','Redefine what "delivery" means for this person','Conversation: what would make you proud?'],
      [9,'Meaningful Work','In the last two weeks, I felt my work was worth it — not just because I\'m paid for it.','The "why" is gone. You do it because you have to, not because it matters.','Purpose alignment — why does this matter?','Practice: purpose alignment'],
      [10,'Craft','In the last two weeks, I had time to do my work well — not just fast.','You\'re doing it fast, but not the way you\'d like. Something is blocking your standard.','Autonomy + protected time to do it right','Practice: protected time (deep work)'],
    ];
    for (const v of V) iv.run(...v);

    // Company
    db.prepare('INSERT INTO companies (id,name) VALUES (1,?)').run('Shapeless');

    // Departments
    const idept = db.prepare('INSERT INTO departments (id,name,company_id) VALUES (?,?,?)');
    idept.run(1,'Product & Technology',1);
    idept.run(2,'People & Culture',1);
    idept.run(3,'Commercial',1);
    idept.run(4,'Operations',1);

    // Teams
    const iteam = db.prepare('INSERT INTO teams (id,name,department_id) VALUES (?,?,?)');
    // Product & Technology
    iteam.run(1,'Platform',1);
    iteam.run(2,'Design',1);
    iteam.run(3,'Data',1);
    // People & Culture
    iteam.run(4,'Talent Acquisition',2);
    iteam.run(5,'Learning & Development',2);
    // Commercial
    iteam.run(6,'Sales',3);
    iteam.run(7,'Marketing',3);
    // Operations
    iteam.run(8,'Finance',4);
    iteam.run(9,'Customer Success',4);

    // Users — password 1234 for all
    const pw = hashPwd('1234');
    const iu = db.prepare('INSERT INTO users (name,username,password_hash,role,team_id,department_id,company_id) VALUES (?,?,?,?,?,?,?)');

    // ── Company owner
    iu.run('Pedro Almeida','pedro',pw,'company',null,null,1);

    // ── Department heads
    iu.run('Renata Souza','renata',pw,'head',null,1,null);
    iu.run('Marcelo Dias','marcelo',pw,'head',null,2,null);
    iu.run('Juliana Costa','juliana',pw,'head',null,3,null);
    iu.run('Roberto Ferreira','roberto',pw,'head',null,4,null);

    // ── Team leaders
    iu.run('Lucas Pereira','lucas',pw,'leader',1,null,null);      // Platform
    iu.run('Isabela Martins','isabela',pw,'leader',2,null,null);   // Design
    iu.run('Felipe Rocha','felipe',pw,'leader',3,null,null);       // Data
    iu.run('Patricia Lima','patricia',pw,'leader',4,null,null);    // Talent Acquisition
    iu.run('Daniel Oliveira','daniel',pw,'leader',5,null,null);    // L&D
    iu.run('Amanda Ribeiro','amanda',pw,'leader',6,null,null);     // Sales
    iu.run('Gustavo Nunes','gustavo',pw,'leader',7,null,null);     // Marketing
    iu.run('Carolina Santos','carolina',pw,'leader',8,null,null);  // Finance
    iu.run('Rodrigo Alves','rodrigo',pw,'leader',9,null,null);     // Customer Success

    // ── Members
    // Platform (team 1) — 4 devs
    iu.run('Thiago Mendes','thiago',pw,'member',1,null,null);
    iu.run('Larissa Cunha','larissa',pw,'member',1,null,null);
    iu.run('Bruno Teixeira','bruno',pw,'member',1,null,null);
    iu.run('Camila Barros','camila',pw,'member',1,null,null);
    // Design (team 2)
    iu.run('Marina Duarte','marina',pw,'member',2,null,null);
    iu.run('André Vieira','andre',pw,'member',2,null,null);
    iu.run('Sofia Cardoso','sofia',pw,'member',2,null,null);
    // Data (team 3)
    iu.run('Gabriel Moreira','gabriel',pw,'member',3,null,null);
    iu.run('Natalia Freitas','natalia',pw,'member',3,null,null);
    iu.run('Leonardo Campos','leonardo',pw,'member',3,null,null);
    // Talent Acquisition (team 4)
    iu.run('Aline Correia','aline',pw,'member',4,null,null);
    iu.run('Marcos Pinto','marcos',pw,'member',4,null,null);
    iu.run('Leticia Azevedo','leticia',pw,'member',4,null,null);
    // L&D (team 5)
    iu.run('Julia Ramos','julia',pw,'member',5,null,null);
    iu.run('Henrique Gomes','henrique',pw,'member',5,null,null);
    iu.run('Tatiana Lopes','tatiana',pw,'member',5,null,null);
    // Sales (team 6)
    iu.run('Ricardo Nascimento','ricardo',pw,'member',6,null,null);
    iu.run('Fernanda Barbosa','fernanda',pw,'member',6,null,null);
    iu.run('Diego Monteiro','diego',pw,'member',6,null,null);
    iu.run('Bianca Araujo','bianca',pw,'member',6,null,null);
    // Marketing (team 7)
    iu.run('Eduardo Silva','eduardo',pw,'member',7,null,null);
    iu.run('Vanessa Farias','vanessa',pw,'member',7,null,null);
    iu.run('Rafael Castro','rafael',pw,'member',7,null,null);
    // Finance (team 8)
    iu.run('Paulo Rezende','paulo',pw,'member',8,null,null);
    iu.run('Cristina Machado','cristina',pw,'member',8,null,null);
    iu.run('Alexandre Borges','alexandre',pw,'member',8,null,null);
    // Customer Success (team 9)
    iu.run('Daniela Fonseca','daniela',pw,'member',9,null,null);
    iu.run('Matheus Carvalho','matheus',pw,'member',9,null,null);
    iu.run('Priscila Torres','priscila',pw,'member',9,null,null);
    iu.run('Victor Moura','victor',pw,'member',9,null,null);

    // ── Cycles — 6 months of data
    const ic = db.prepare('INSERT INTO cycles (company_id,label,starts_at,ends_at,is_active) VALUES (?,?,?,?,?)');
    ic.run(1,'May 2026','2026-05-01','2026-05-31',0);
    ic.run(1,'June 2026','2026-06-01','2026-06-30',0);
    ic.run(1,'July 2026','2026-07-01','2026-07-31',0);
    ic.run(1,'August 2026','2026-08-01','2026-08-31',0);
    ic.run(1,'September 2026','2026-09-01','2026-09-30',0);
    ic.run(1,'October 2026','2026-10-01','2026-10-31',1);

    // ── Response data — each team has a story ──
    // Values order: 1=Wellbeing 2=Authenticity 3=Service 4=FairReward 5=Autonomy
    //               6=Belonging 7=Growth 8=Achievement 9=MeaningfulWork 10=Craft

    // Team profiles: [W, Au, Se, FR, Aut, Bel, Gr, Ach, MW, Cr] base scores per cycle
    // Each array = 6 cycles × 10 values
    const teamProfiles = {
      // Platform (team 1): sprint pressure — starts good, craft+autonomy+wellbeing erode
      1: [
        [4,4,4,3,4,4,4,4,4,5], // May — healthy
        [4,4,3,3,4,4,4,4,4,4], // Jun — slight dip
        [3,3,3,3,3,4,3,4,3,3], // Jul — pressure builds
        [2,3,3,3,2,3,2,3,3,2], // Aug — crunch
        [2,2,3,3,2,3,2,4,2,2], // Sep — burnout signal
        [3,3,3,3,3,3,3,3,3,3], // Oct — recovery starts
      ],
      // Design (team 2): high craft, high authenticity, low belonging (isolated)
      2: [
        [4,5,3,3,5,2,4,4,4,5],
        [4,5,3,3,5,2,4,4,5,5],
        [3,5,3,3,5,2,5,4,4,5],
        [3,5,3,3,5,2,5,3,4,5],
        [4,5,3,4,5,3,5,4,5,5],
        [4,5,4,4,5,3,4,4,5,5],
      ],
      // Data (team 3): balanced and healthy — the reference team
      3: [
        [4,4,4,4,4,4,4,4,4,4],
        [4,4,4,4,4,4,4,4,4,4],
        [4,4,4,4,4,5,4,4,4,4],
        [4,4,4,4,5,5,4,4,5,4],
        [4,5,4,4,5,5,4,4,5,5],
        [5,5,4,4,5,5,5,4,5,5],
      ],
      // Talent Acquisition (team 4): high service+belonging, low fair reward
      4: [
        [3,4,5,2,3,5,3,3,4,3],
        [3,4,5,2,3,5,3,3,4,3],
        [3,4,5,2,3,5,3,3,4,3],
        [3,3,5,2,3,5,3,3,4,3],
        [2,3,5,1,3,5,3,3,4,3],
        [2,3,5,2,3,4,3,3,4,3],
      ],
      // L&D (team 5): high growth+meaning, low achievement (hard to measure)
      5: [
        [4,4,4,3,4,4,5,2,5,4],
        [4,4,4,3,4,4,5,2,5,4],
        [4,4,5,3,4,4,5,3,5,4],
        [4,5,5,3,4,4,5,3,5,4],
        [4,5,5,3,4,5,5,3,5,4],
        [4,5,5,4,4,5,5,3,5,4],
      ],
      // Sales (team 6): high achievement, low wellbeing+meaningful work — hustle culture
      6: [
        [3,3,3,4,3,3,3,5,2,3],
        [3,2,3,4,3,3,2,5,2,3],
        [2,2,3,4,2,3,2,5,2,2],
        [2,2,2,3,2,2,2,5,1,2],
        [2,1,2,3,2,2,2,5,1,2],
        [1,1,2,3,1,2,2,5,1,1],
      ],
      // Marketing (team 7): starts with low autonomy, steadily improves (restructuring)
      7: [
        [3,3,3,3,1,3,3,3,3,3],
        [3,3,3,3,2,3,3,3,3,3],
        [3,4,3,3,3,3,4,3,3,4],
        [4,4,4,3,4,4,4,4,4,4],
        [4,4,4,4,4,4,4,4,4,4],
        [4,5,4,4,5,4,5,4,5,5],
      ],
      // Finance (team 8): stable, methodical, high craft, low growth
      8: [
        [4,3,3,4,3,3,2,4,3,5],
        [4,3,3,4,3,3,2,4,3,5],
        [4,3,3,4,3,4,2,4,3,5],
        [4,3,3,4,3,4,2,4,3,5],
        [4,3,3,4,3,4,2,4,3,5],
        [4,3,3,4,3,4,2,4,3,5],
      ],
      // Customer Success (team 9): high service+belonging, autonomy low, wellbeing declining
      9: [
        [4,3,5,3,2,5,3,3,4,3],
        [3,3,5,3,2,5,3,3,4,3],
        [3,3,5,3,2,5,3,3,4,3],
        [3,3,5,3,2,5,3,3,3,3],
        [2,3,5,3,2,4,3,3,3,3],
        [2,2,5,3,2,4,3,3,3,2],
      ],
    };

    // Map team_id → list of user IDs (members + leader)
    const teamUsers = {};
    const allUsers = db.prepare('SELECT id, team_id FROM users WHERE team_id IS NOT NULL').all();
    for (const u of allUsers) {
      if (!teamUsers[u.team_id]) teamUsers[u.team_id] = [];
      teamUsers[u.team_id].push(u.id);
    }

    // Insert responses with per-person variation (±1, clamped 1-5)
    const ir = db.prepare('INSERT INTO responses (user_id,cycle_id,valor_id,score,answered_at) VALUES (?,?,?,?,?)');
    // Simple seeded variation per person
    const variation = [0, 1, -1, 0, 1, -1, 0, 0, 1, -1, 0, 1, -1, 0, 0];
    let vi = 0;

    for (const [teamId, profiles] of Object.entries(teamProfiles)) {
      const users = teamUsers[parseInt(teamId)] || [];
      for (let cycleIdx = 0; cycleIdx < 6; cycleIdx++) {
        const cycleId = cycleIdx + 1; // cycles 1-6
        const baseScores = profiles[cycleIdx];
        const cycleMonth = ['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10'][cycleIdx];
        for (const userId of users) {
          for (let valIdx = 0; valIdx < 10; valIdx++) {
            const base = baseScores[valIdx];
            const v = variation[(vi++) % variation.length];
            const score = Math.max(1, Math.min(5, base + v));
            const day = String(5 + (userId % 20)).padStart(2,'0');
            ir.run(userId, cycleId, valIdx + 1, score, `${cycleMonth}-${day}T10:00:00`);
          }
        }
      }
    }
  });
  seedTx();
  console.log('Database seeded. Default password for all users: 1234');
}

// ── Helpers ────────────────────────────────────
function getCompanyIdForUser(user) {
  if (user.company_id) return user.company_id;
  if (user.department_id) {
    const d = db.prepare('SELECT company_id FROM departments WHERE id=?').get(user.department_id);
    return d ? d.company_id : null;
  }
  if (user.team_id) {
    const r = db.prepare('SELECT d.company_id FROM teams t JOIN departments d ON d.id=t.department_id WHERE t.id=?').get(user.team_id);
    return r ? r.company_id : null;
  }
  return null;
}

function getDeptIdForUser(user) {
  if (user.department_id) return user.department_id;
  if (user.team_id) {
    const t = db.prepare('SELECT department_id FROM teams WHERE id=?').get(user.team_id);
    return t ? t.department_id : null;
  }
  return null;
}

// ── API ────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Auth
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const u = db.prepare(`
    SELECT u.id, u.name, u.username, u.role, u.team_id, u.department_id, u.company_id,
           t.name as team_name, t.department_id as team_dept_id,
           COALESCE(d.name, d2.name) as department_name,
           COALESCE(d.company_id, d2.company_id, u.company_id) as resolved_company_id,
           c.name as company_name
    FROM users u
    LEFT JOIN teams t ON t.id = u.team_id
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN departments d2 ON d2.id = t.department_id
    LEFT JOIN companies c ON c.id = COALESCE(d.company_id, d2.company_id, u.company_id)
    WHERE u.username = ? AND u.password_hash = ?
  `).get(username.toLowerCase().trim(), hashPwd(password));
  if (!u) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({
    id: u.id, name: u.name, username: u.username, role: u.role,
    team_id: u.team_id, team_name: u.team_name,
    department_id: u.department_id || u.team_dept_id,
    department_name: u.department_name,
    company_id: u.resolved_company_id,
    company_name: u.company_name
  });
});

app.post('/api/register', (req, res) => {
  const { name, username, password, role, team_id, department_id, company_id } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Name, username and password required' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  try {
    const r = db.prepare('INSERT INTO users (name,username,password_hash,role,team_id,department_id,company_id) VALUES (?,?,?,?,?,?,?)')
      .run(name.trim(), username.toLowerCase().trim(), hashPwd(password), role||'member', team_id||null, department_id||null, company_id||null);
    res.json({ id: r.lastInsertRowid, name: name.trim(), username: username.toLowerCase().trim(), role: role||'member', team_id, department_id, company_id });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    res.status(400).json({ error: e.message });
  }
});

// Data
app.get('/api/valores', (_, res) => res.json(db.prepare('SELECT * FROM valores ORDER BY position').all()));

app.get('/api/companies/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id);
  res.json(c || null);
});

app.get('/api/companies/:id/departments', (req, res) => {
  res.json(db.prepare('SELECT * FROM departments WHERE company_id=? ORDER BY name').all(req.params.id));
});

app.get('/api/departments/:id/teams', (req, res) => {
  res.json(db.prepare('SELECT * FROM teams WHERE department_id=? ORDER BY name').all(req.params.id));
});

app.get('/api/teams/:id/users', (req, res) => {
  res.json(db.prepare('SELECT id,name,username,role,team_id FROM users WHERE team_id=? ORDER BY role DESC,name').all(req.params.id));
});

// Active cycle (company-wide)
app.get('/api/cycles/active/:companyId', (req, res) => {
  const r = db.prepare('SELECT * FROM cycles WHERE company_id=? AND is_active=1 ORDER BY starts_at DESC LIMIT 1').get(req.params.companyId);
  res.json(r || null);
});

// Pulse
app.post('/api/pulse', (req, res) => {
  const { user_id, cycle_id, answers } = req.body;
  const up = db.prepare(`INSERT INTO responses (user_id,cycle_id,valor_id,score) VALUES (?,?,?,?)
    ON CONFLICT(user_id,cycle_id,valor_id) DO UPDATE SET score=excluded.score, answered_at=datetime('now')`);
  db.transaction(() => { for (const a of answers) up.run(user_id, cycle_id, a.valor_id, a.score); })();
  res.json({ ok: true });
});

app.get('/api/pulse/status/:userId/:cycleId', (req, res) => {
  const r = db.prepare('SELECT COUNT(*) as total FROM responses WHERE user_id=? AND cycle_id=?').get(req.params.userId, req.params.cycleId);
  res.json({ answered: r.total === 10, count: r.total });
});

// Radar (individual)
app.get('/api/radar/:userId/:cycleId', (req, res) => {
  res.json(db.prepare(`
    SELECT v.id as valor_id, v.position, v.name_en, v.question_en, v.msg_gap_en, v.grow_action_en, v.grow_tool_en, r.score
    FROM valores v LEFT JOIN responses r ON r.valor_id=v.id AND r.user_id=? AND r.cycle_id=?
    ORDER BY v.position
  `).all(req.params.userId, req.params.cycleId));
});

// ── TEAM-LEVEL (leader) ───────────────────────
app.get('/api/heatmap/team/:teamId/:cycleId', (req, res) => {
  const members = db.prepare("SELECT id,name FROM users WHERE team_id=? AND role='member' ORDER BY name").all(req.params.teamId);
  const valores = db.prepare('SELECT * FROM valores ORDER BY position').all();
  const responses = db.prepare(`
    SELECT r.user_id, r.valor_id, r.score FROM responses r
    WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id=? AND role='member')
  `).all(req.params.cycleId, req.params.teamId);

  const grid = valores.map(v => {
    const row = { valor: v.name_en, valor_id: v.id, scores: {} };
    for (const m of members) {
      const f = responses.find(r => r.user_id === m.id && r.valor_id === v.id);
      row.scores[String(m.id)] = f ? f.score : null;
    }
    const filled = Object.values(row.scores).filter(s => s !== null);
    row.avg = filled.length ? filled.reduce((a,b)=>a+b,0)/filled.length : null;
    return row;
  });
  const gaps = grid.filter(r => r.avg !== null && r.avg <= 2.5).map(r => r.valor);
  res.json({ columns: members.map(m => ({ id: m.id, name: m.name.split(' ')[0] })), grid, gaps });
});

app.get('/api/grow/team/:teamId/:cycleId', (req, res) => {
  res.json(db.prepare(`
    SELECT v.name_en, v.msg_gap_en, v.grow_action_en, v.grow_tool_en, AVG(r.score) as avg_score
    FROM responses r JOIN valores v ON v.id=r.valor_id
    WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id=?)
    GROUP BY v.id ORDER BY avg_score ASC
  `).all(req.params.cycleId, req.params.teamId));
});

app.get('/api/trend/team/:teamId', (req, res) => {
  // Find company for this team
  const t = db.prepare('SELECT d.company_id FROM teams t JOIN departments d ON d.id=t.department_id WHERE t.id=?').get(req.params.teamId);
  if (!t) return res.json({ hasTrend: false });
  const cycles = db.prepare('SELECT id,label FROM cycles WHERE company_id=? ORDER BY starts_at DESC LIMIT 2').all(t.company_id);
  if (cycles.length < 2) return res.json({ hasTrend: false });
  function avg(cid) {
    return db.prepare(`SELECT v.position, v.name_en, AVG(r.score) as avg_score
      FROM responses r JOIN valores v ON v.id=r.valor_id
      WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id=?)
      GROUP BY v.position ORDER BY v.position`).all(cid, req.params.teamId);
  }
  const cur = avg(cycles[0].id), prev = avg(cycles[1].id);
  const trend = cur.map(c => {
    const p = prev.find(x => x.position === c.position);
    const diff = p ? c.avg_score - p.avg_score : 0;
    return { valor: c.name_en, current: Math.round(c.avg_score*10)/10, previous: p ? Math.round(p.avg_score*10)/10 : null, direction: diff > 0.3 ? 'up' : diff < -0.3 ? 'down' : 'flat' };
  });
  res.json({ hasTrend: true, currentCycle: cycles[0].label, previousCycle: cycles[1].label, trend });
});

// ── TREND TIMELINE (multi-cycle, all levels) ──
app.get('/api/trend-timeline/team/:teamId', (req, res) => {
  const t = db.prepare('SELECT d.company_id FROM teams t JOIN departments d ON d.id=t.department_id WHERE t.id=?').get(req.params.teamId);
  if (!t) return res.json({ cycles: [], series: [] });
  const cycles = db.prepare('SELECT id,label FROM cycles WHERE company_id=? ORDER BY starts_at ASC').all(t.company_id);
  const valores = db.prepare('SELECT id,position,name_en FROM valores ORDER BY position').all();
  const series = valores.map(v => {
    const points = cycles.map(c => {
      const r = db.prepare('SELECT AVG(r.score) as avg FROM responses r WHERE r.cycle_id=? AND r.valor_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id=?)').get(c.id, v.id, req.params.teamId);
      return r && r.avg ? Math.round(r.avg * 10) / 10 : null;
    });
    return { name: v.name_en, data: points };
  });
  // Also overall average per cycle
  const overall = cycles.map(c => {
    const r = db.prepare('SELECT AVG(r.score) as avg FROM responses r WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id=?)').get(c.id, req.params.teamId);
    return r && r.avg ? Math.round(r.avg * 10) / 10 : null;
  });
  series.unshift({ name: 'Overall', data: overall, overall: true });
  res.json({ cycles: cycles.map(c => c.label), series });
});

app.get('/api/trend-timeline/department/:deptId', (req, res) => {
  const d = db.prepare('SELECT company_id FROM departments WHERE id=?').get(req.params.deptId);
  if (!d) return res.json({ cycles: [], series: [] });
  const cycles = db.prepare('SELECT id,label FROM cycles WHERE company_id=? ORDER BY starts_at ASC').all(d.company_id);
  const teams = db.prepare('SELECT id,name FROM teams WHERE department_id=? ORDER BY name').all(req.params.deptId);
  const series = teams.map(t => {
    const points = cycles.map(c => {
      const r = db.prepare('SELECT AVG(r.score) as avg FROM responses r WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id=?)').get(c.id, t.id);
      return r && r.avg ? Math.round(r.avg * 10) / 10 : null;
    });
    return { name: t.name, data: points };
  });
  // Overall department avg
  const overall = cycles.map(c => {
    const r = db.prepare('SELECT AVG(r.score) as avg FROM responses r WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE department_id=?))').get(c.id, req.params.deptId);
    return r && r.avg ? Math.round(r.avg * 10) / 10 : null;
  });
  series.unshift({ name: 'Department Avg', data: overall, overall: true });
  res.json({ cycles: cycles.map(c => c.label), series });
});

app.get('/api/trend-timeline/company/:companyId', (req, res) => {
  const cycles = db.prepare('SELECT id,label FROM cycles WHERE company_id=? ORDER BY starts_at ASC').all(req.params.companyId);
  const depts = db.prepare('SELECT id,name FROM departments WHERE company_id=? ORDER BY name').all(req.params.companyId);
  const series = depts.map(d => {
    const points = cycles.map(c => {
      const r = db.prepare('SELECT AVG(r.score) as avg FROM responses r WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE department_id=?))').get(c.id, d.id);
      return r && r.avg ? Math.round(r.avg * 10) / 10 : null;
    });
    return { name: d.name, data: points };
  });
  // Overall company avg
  const overall = cycles.map(c => {
    const r = db.prepare('SELECT AVG(r.score) as avg FROM responses r WHERE r.cycle_id=? AND r.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT t.id FROM teams t JOIN departments d ON d.id=t.department_id WHERE d.company_id=?))').get(c.id, req.params.companyId);
    return r && r.avg ? Math.round(r.avg * 10) / 10 : null;
  });
  series.unshift({ name: 'Company Avg', data: overall, overall: true });
  res.json({ cycles: cycles.map(c => c.label), series });
});

// ── DEPARTMENT-LEVEL (head) ───────────────────
app.get('/api/heatmap/department/:deptId/:cycleId', (req, res) => {
  const teams = db.prepare('SELECT id,name FROM teams WHERE department_id=? ORDER BY name').all(req.params.deptId);
  const valores = db.prepare('SELECT * FROM valores ORDER BY position').all();

  const grid = valores.map(v => {
    const row = { valor: v.name_en, scores: {} };
    let allScores = [];
    for (const t of teams) {
      const r = db.prepare(`SELECT AVG(r.score) as avg FROM responses r JOIN users u ON u.id=r.user_id
        WHERE r.cycle_id=? AND r.valor_id=? AND u.team_id=? AND u.role='member'`).get(req.params.cycleId, v.id, t.id);
      const val = r && r.avg ? Math.round(r.avg * 10) / 10 : null;
      row.scores[String(t.id)] = val;
      if (val !== null) allScores.push(val);
    }
    row.avg = allScores.length ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length*10)/10 : null;
    return row;
  });
  const gaps = grid.filter(r => r.avg !== null && r.avg <= 2.5).map(r => r.valor);
  res.json({ columns: teams.map(t => ({ id: t.id, name: t.name })), grid, gaps });
});

app.get('/api/grow/department/:deptId/:cycleId', (req, res) => {
  res.json(db.prepare(`
    SELECT v.name_en, v.msg_gap_en, v.grow_action_en, v.grow_tool_en, AVG(r.score) as avg_score
    FROM responses r JOIN valores v ON v.id=r.valor_id JOIN users u ON u.id=r.user_id JOIN teams t ON t.id=u.team_id
    WHERE r.cycle_id=? AND t.department_id=?
    GROUP BY v.id ORDER BY avg_score ASC
  `).all(req.params.cycleId, req.params.deptId));
});

app.get('/api/overview/department/:deptId/:cycleId', (req, res) => {
  const teams = db.prepare('SELECT id,name FROM teams WHERE department_id=? ORDER BY name').all(req.params.deptId);
  const result = teams.map(t => {
    const members = db.prepare("SELECT COUNT(*) as c FROM users WHERE team_id=? AND role='member'").get(t.id);
    const answered = db.prepare(`SELECT COUNT(DISTINCT r.user_id) as c FROM responses r JOIN users u ON u.id=r.user_id
      WHERE r.cycle_id=? AND u.team_id=? AND u.role='member'`).get(req.params.cycleId, t.id);
    const avg = db.prepare(`SELECT AVG(r.score) as avg FROM responses r JOIN users u ON u.id=r.user_id
      WHERE r.cycle_id=? AND u.team_id=?`).get(req.params.cycleId, t.id);
    const leader = db.prepare("SELECT name FROM users WHERE team_id=? AND role='leader' LIMIT 1").get(t.id);
    return { id: t.id, name: t.name, leader: leader ? leader.name : null, members: members.c, answered: answered.c, avg: avg.avg ? Math.round(avg.avg*10)/10 : null };
  });
  res.json(result);
});

// ── COMPANY-LEVEL ─────────────────────────────
app.get('/api/heatmap/company/:companyId/:cycleId', (req, res) => {
  const depts = db.prepare('SELECT id,name FROM departments WHERE company_id=? ORDER BY name').all(req.params.companyId);
  const valores = db.prepare('SELECT * FROM valores ORDER BY position').all();

  const grid = valores.map(v => {
    const row = { valor: v.name_en, scores: {} };
    let allScores = [];
    for (const d of depts) {
      const r = db.prepare(`SELECT AVG(r.score) as avg FROM responses r JOIN users u ON u.id=r.user_id
        JOIN teams t ON t.id=u.team_id WHERE r.cycle_id=? AND r.valor_id=? AND t.department_id=?`).get(req.params.cycleId, v.id, d.id);
      const val = r && r.avg ? Math.round(r.avg*10)/10 : null;
      row.scores[String(d.id)] = val;
      if (val !== null) allScores.push(val);
    }
    row.avg = allScores.length ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length*10)/10 : null;
    return row;
  });
  const gaps = grid.filter(r => r.avg !== null && r.avg <= 2.5).map(r => r.valor);
  res.json({ columns: depts.map(d => ({ id: d.id, name: d.name })), grid, gaps });
});

app.get('/api/grow/company/:companyId/:cycleId', (req, res) => {
  res.json(db.prepare(`
    SELECT v.name_en, v.msg_gap_en, v.grow_action_en, v.grow_tool_en, AVG(r.score) as avg_score
    FROM responses r JOIN valores v ON v.id=r.valor_id JOIN users u ON u.id=r.user_id
    JOIN teams t ON t.id=u.team_id JOIN departments d ON d.id=t.department_id
    WHERE r.cycle_id=? AND d.company_id=?
    GROUP BY v.id ORDER BY avg_score ASC
  `).all(req.params.cycleId, req.params.companyId));
});

app.get('/api/overview/company/:companyId/:cycleId', (req, res) => {
  const depts = db.prepare('SELECT id,name FROM departments WHERE company_id=? ORDER BY name').all(req.params.companyId);
  const result = depts.map(d => {
    const teams = db.prepare('SELECT COUNT(*) as c FROM teams WHERE department_id=?').get(d.id);
    const members = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role='member' AND team_id IN (SELECT id FROM teams WHERE department_id=?)`).get(d.id);
    const answered = db.prepare(`SELECT COUNT(DISTINCT r.user_id) as c FROM responses r JOIN users u ON u.id=r.user_id
      JOIN teams t ON t.id=u.team_id WHERE r.cycle_id=? AND t.department_id=?`).get(req.params.cycleId, d.id);
    const avg = db.prepare(`SELECT AVG(r.score) as avg FROM responses r JOIN users u ON u.id=r.user_id
      JOIN teams t ON t.id=u.team_id WHERE r.cycle_id=? AND t.department_id=?`).get(req.params.cycleId, d.id);
    const head = db.prepare("SELECT name FROM users WHERE department_id=? AND role='head' LIMIT 1").get(d.id);
    return { id: d.id, name: d.name, head: head ? head.name : null, teams: teams.c, members: members.c, answered: answered.c, avg: avg.avg ? Math.round(avg.avg*10)/10 : null };
  });
  res.json(result);
});

// User profile
app.get('/api/users/:id', (req, res) => {
  const u = db.prepare(`SELECT u.id, u.name, u.username, u.role, u.team_id, u.department_id, u.company_id,
    t.name as team_name, COALESCE(d.name, d2.name) as department_name, c.name as company_name
    FROM users u LEFT JOIN teams t ON t.id=u.team_id LEFT JOIN departments d ON d.id=u.department_id
    LEFT JOIN departments d2 ON d2.id=t.department_id
    LEFT JOIN companies c ON c.id=COALESCE(d.company_id, d2.company_id, u.company_id)
    WHERE u.id=?`).get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json(u);
});

app.get('/api/users/:id/history', (req, res) => {
  const u = db.prepare('SELECT team_id, department_id, company_id FROM users WHERE id=?').get(req.params.id);
  if (!u || !u.team_id) return res.json([]);
  const companyId = getCompanyIdForUser(u);
  if (!companyId) return res.json([]);
  const history = db.prepare(`
    SELECT c.id as cycle_id, c.label, COUNT(r.id) as answers_count,
           ROUND(AVG(r.score),1) as avg_score, MIN(r.score) as min_score
    FROM cycles c LEFT JOIN responses r ON r.cycle_id=c.id AND r.user_id=?
    WHERE c.company_id=? GROUP BY c.id ORDER BY c.starts_at DESC
  `).all(req.params.id, companyId);
  res.json(history);
});

// ── CRUD: MANAGE USERS ───────────────────────

// Update user (self-edit or managed by higher role)
app.put('/api/users/:id', (req, res) => {
  const { name, username, password, role, team_id, department_id, company_id } = req.body;
  const existing = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  try {
    const sets = [];
    const vals = [];
    if (name) { sets.push('name=?'); vals.push(name.trim()); }
    if (username) { sets.push('username=?'); vals.push(username.toLowerCase().trim()); }
    if (password && password.length >= 4) { sets.push('password_hash=?'); vals.push(hashPwd(password)); }
    if (role) { sets.push('role=?'); vals.push(role); }
    if (role === 'member' && team_id !== undefined) { sets.push('team_id=?'); vals.push(team_id); sets.push('department_id=?'); vals.push(null); sets.push('company_id=?'); vals.push(null); }
    if (role === 'leader' && team_id !== undefined) { sets.push('team_id=?'); vals.push(team_id); sets.push('department_id=?'); vals.push(null); sets.push('company_id=?'); vals.push(null); }
    if (role === 'head' && department_id !== undefined) { sets.push('team_id=?'); vals.push(null); sets.push('department_id=?'); vals.push(department_id); sets.push('company_id=?'); vals.push(null); }
    if (role === 'company' && company_id !== undefined) { sets.push('team_id=?'); vals.push(null); sets.push('department_id=?'); vals.push(null); sets.push('company_id=?'); vals.push(company_id); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    db.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...vals);
    const updated = db.prepare('SELECT id,name,username,role,team_id,department_id,company_id FROM users WHERE id=?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    res.status(400).json({ error: e.message });
  }
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM responses WHERE user_id=?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// List users by team (for leader)
app.get('/api/manage/team/:teamId', (req, res) => {
  res.json(db.prepare('SELECT id,name,username,role,team_id FROM users WHERE team_id=? ORDER BY role DESC, name').all(req.params.teamId));
});

// List users by department (for head) — grouped by team
app.get('/api/manage/department/:deptId', (req, res) => {
  const teams = db.prepare('SELECT id,name FROM teams WHERE department_id=? ORDER BY name').all(req.params.deptId);
  const result = teams.map(t => {
    const members = db.prepare('SELECT id,name,username,role,team_id FROM users WHERE team_id=? ORDER BY role DESC, name').all(t.id);
    return { team: t, members };
  });
  res.json(result);
});

// List all departments + teams + users (for company admin)
app.get('/api/manage/company/:companyId', (req, res) => {
  const depts = db.prepare('SELECT id,name FROM departments WHERE company_id=? ORDER BY name').all(req.params.companyId);
  const result = depts.map(d => {
    const head = db.prepare("SELECT id,name,username FROM users WHERE department_id=? AND role='head'").get(d.id);
    const teams = db.prepare('SELECT id,name FROM teams WHERE department_id=? ORDER BY name').all(d.id);
    const teamsData = teams.map(t => {
      const members = db.prepare('SELECT id,name,username,role,team_id FROM users WHERE team_id=? ORDER BY role DESC, name').all(t.id);
      return { team: t, members };
    });
    return { department: d, head, teams: teamsData };
  });
  res.json(result);
});

// Create team (for head)
app.post('/api/teams', (req, res) => {
  const { name, department_id } = req.body;
  if (!name || !department_id) return res.status(400).json({ error: 'Name and department_id required' });
  const r = db.prepare('INSERT INTO teams (name, department_id) VALUES (?,?)').run(name.trim(), department_id);
  res.json({ id: r.lastInsertRowid, name: name.trim(), department_id });
});

// Delete team (for head)
app.delete('/api/teams/:id', (req, res) => {
  const members = db.prepare('SELECT COUNT(*) as c FROM users WHERE team_id=?').get(req.params.id);
  if (members.c > 0) return res.status(400).json({ error: 'Cannot delete team with members. Remove members first.' });
  db.prepare('DELETE FROM teams WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Create department (for company admin)
app.post('/api/departments', (req, res) => {
  const { name, company_id } = req.body;
  if (!name || !company_id) return res.status(400).json({ error: 'Name and company_id required' });
  const r = db.prepare('INSERT INTO departments (name, company_id) VALUES (?,?)').run(name.trim(), company_id);
  res.json({ id: r.lastInsertRowid, name: name.trim(), company_id });
});

// SPA fallback
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n  Tend — The Shapeless Team\n  http://localhost:${PORT}\n`));
