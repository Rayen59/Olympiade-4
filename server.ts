import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PROBLEMS } from './data/problemsData.js';
import { COURSES_DATA } from './data/coursesData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'mk_store.json');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });

interface ServerStore {
  users: any[];
  problems: any[];
  submissions: any[];
  courses: any[];
  forumTopics: any[];
  olympiads: any[];
  olympiadSubmissions: any[];
  videos: any[];
}

const DEFAULT_ADMIN = {
  id: 'usr-admin-1',
  username: 'Admin MK',
  email: 'admin12@gmail.com',
  password: 'admin12',
  role: 'admin',
  points: 0,
  solvedProblems: [],
  solvedCount: 0,
  banned: false,
  banUntil: null,
  banReason: null,
  createdAt: new Date().toISOString(),
  avatarColor: '#0056b3',
  bio: 'Administrateur officiel de la plateforme MK Olympiades.'
};

const DEFAULT_OLYMPIAD = {
  id: 'oly-1',
  title: 'Olympiade Mathématique MK - Session Officielle',
  description:
    'Épreuve générale d’olympiades de haut niveau. Durée officielle : 4 heures (240 minutes). 4 problèmes notés sur 7 points chacun.',
  durationHours: 4,
  durationMinutes: 0,
  totalDurationMinutes: 240,
  problemCount: 4,
  pointsPerProblem: 7,
  totalPoints: 28,
  goldCutoff: 24,
  silverCutoff: 18,
  bronzeCutoff: 12,
  honorableMentionCutoff: 7,
  pdfUrl: '/assets/olympiade_mk_sujet_officiel.pdf',
  pdfTitle: 'Sujet_Officiel_Olympiade_MK.pdf',
  status: 'active',
  resultsPublished: false,
  createdAt: new Date().toISOString()
};

function createInitialState(): ServerStore {
  return {
    users: [{ ...DEFAULT_ADMIN, createdAt: new Date().toISOString() }],
    problems: INITIAL_PROBLEMS,
    submissions: [],
    courses: COURSES_DATA,
    forumTopics: [],
    olympiads: [{ ...DEFAULT_OLYMPIAD, createdAt: new Date().toISOString() }],
    olympiadSubmissions: [],
    videos: []
  };
}

function loadInitialState(): ServerStore {
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as Partial<ServerStore>;
      const base = createInitialState();
      const users = Array.isArray(parsed.users) ? parsed.users : base.users;
      if (!users.some((u) => u.email?.toLowerCase() === DEFAULT_ADMIN.email)) {
        users.unshift({ ...DEFAULT_ADMIN });
      }
      return {
        users,
        problems: Array.isArray(parsed.problems) && parsed.problems.length > 0 ? parsed.problems : INITIAL_PROBLEMS,
        submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
        courses: COURSES_DATA,
        forumTopics: Array.isArray(parsed.forumTopics) ? parsed.forumTopics : [],
        olympiads: Array.isArray(parsed.olympiads) && parsed.olympiads.length > 0 ? parsed.olympiads : base.olympiads,
        olympiadSubmissions: Array.isArray(parsed.olympiadSubmissions) ? parsed.olympiadSubmissions : [],
        videos: Array.isArray(parsed.videos) ? parsed.videos : []
      };
    } catch (err) {
      console.warn('Could not parse mk_store.json, initializing fresh store:', err);
    }
  }
  const initial = createInitialState();
  fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  return initial;
}

let state: ServerStore = loadInitialState();
let stateVersion = 1;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const sseClients = new Set<Response>();
const videoMetaMap = new Map<string, { filePath: string; mimeType: string }>();

// Restore video metadata map if video files exist on disk
for (const v of state.videos) {
  if (v?.id) {
    const candidate = path.join(VIDEOS_DIR, `${v.id}.bin`);
    if (fs.existsSync(candidate)) {
      videoMetaMap.set(v.id, { filePath: candidate, mimeType: v.mimeType || 'video/mp4' });
    }
  }
}

function scheduleDiskSave() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.promises.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf-8').catch((e) => {
      console.error('Disk save failed:', e);
    });
  }, 100);
}

function broadcastSync() {
  stateVersion += 1;
  scheduleDiskSave();
  const payload = JSON.stringify({ type: 'sync', version: stateVersion, data: state });
  const frame = `data: ${payload}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(frame);
    } catch {
      sseClients.delete(res);
    }
  }
}

function isAdminActor(actorId?: string): boolean {
  if (!actorId) return false;
  const u = state.users.find((usr) => usr.id === actorId);
  return u?.role === 'admin';
}

function computeMedal(total: number, oly: any): string {
  if (total >= oly.goldCutoff) return "🥇 Médaille d'Or";
  if (total >= oly.silverCutoff) return "🥈 Médaille d'Argent";
  if (total >= oly.bronzeCutoff) return "🥉 Médaille de Bronze";
  if (total >= (oly.honorableMentionCutoff || oly.pointsPerProblem)) return '🎖️ Mention Honorable';
  return 'Certificat de Participation';
}

function applyAction(op: string, payload: any, actorId?: string): { ok: boolean; error?: string; result?: any } {
  switch (op) {
    case 'BOOTSTRAP_MERGE': {
      // Seed forumTopics if server has none yet and client brought defaults
      if (Array.isArray(payload?.forumTopics) && state.forumTopics.length === 0 && payload.forumTopics.length > 0) {
        state.forumTopics = payload.forumTopics;
        broadcastSync();
      }
      return { ok: true };
    }

    case 'REGISTER_USER': {
      const newUser = payload?.user;
      if (!newUser?.email || !newUser?.username) return { ok: false, error: 'Données invalides.' };
      const emailLower = newUser.email.trim().toLowerCase();
      if (state.users.some((u) => u.email.toLowerCase() === emailLower)) {
        return { ok: false, error: 'Cette adresse e-mail est déjà utilisée.' };
      }
      state.users.push(newUser);
      broadcastSync();
      return { ok: true, result: newUser };
    }

    case 'DELETE_ACCOUNT': {
      const targetId = payload?.userId;
      const idx = state.users.findIndex((u) => u.id === targetId);
      if (idx === -1) return { ok: false, error: 'Compte introuvable.' };
      if (state.users[idx].email?.toLowerCase() === 'admin12@gmail.com') {
        return { ok: false, error: 'Compte administrateur protégé.' };
      }
      if (actorId !== targetId && !isAdminActor(actorId)) {
        return { ok: false, error: 'Non autorisé.' };
      }
      state.users.splice(idx, 1);
      state.submissions = state.submissions.filter((s) => s.userId !== targetId);
      state.olympiadSubmissions = state.olympiadSubmissions.filter((s) => s.userId !== targetId);
      broadcastSync();
      return { ok: true };
    }

    case 'CREATE_PROBLEM': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const problem = payload?.problem;
      if (!problem?.id) return { ok: false, error: 'Problème invalide.' };
      if (!state.problems.some((p) => p.id === problem.id)) {
        state.problems.unshift(problem);
        broadcastSync();
      }
      return { ok: true, result: problem };
    }

    case 'UPDATE_PROBLEM': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const problem = payload?.problem;
      const idx = state.problems.findIndex((p) => p.id === problem?.id);
      if (idx === -1) return { ok: false, error: 'Problème introuvable.' };
      state.problems[idx] = problem;
      state.submissions = state.submissions.map((s) =>
        s.problemId === problem.id
          ? { ...s, problemTitle: problem.title, category: problem.theme, points: problem.points }
          : s
      );
      broadcastSync();
      return { ok: true, result: problem };
    }

    case 'DELETE_PROBLEM': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const id = payload?.id;
      state.problems = state.problems.filter((p) => p.id !== id);
      broadcastSync();
      return { ok: true };
    }

    case 'SUBMIT_PROBLEM': {
      const sub = payload?.submission;
      if (!sub?.id || !sub?.problemId || !sub?.userId) return { ok: false, error: 'Soumission invalide.' };
      const existingIdx = state.submissions.findIndex(
        (s) => s.problemId === sub.problemId && s.userId === sub.userId
      );
      if (existingIdx !== -1) {
        const existing = state.submissions[existingIdx];
        if (existing.status === 'approved' || existing.status === 'pending') {
          return { ok: false, error: 'Soumission verrouillée.' };
        }
        state.submissions[existingIdx] = sub;
      } else {
        state.submissions.unshift(sub);
      }
      broadcastSync();
      return { ok: true, result: sub };
    }

    case 'REVIEW_SUBMISSION': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const { subId, status, reason, reviewImages, reviewedAt } = payload || {};
      const idx = state.submissions.findIndex((s) => s.id === subId);
      if (idx === -1) return { ok: false, error: 'Soumission introuvable.' };
      const prevSub = state.submissions[idx];
      const prevStatus = prevSub.status;

      state.submissions[idx] = {
        ...prevSub,
        status,
        reviewReason: reason,
        reviewImages: reviewImages !== undefined ? reviewImages : prevSub.reviewImages,
        reviewedAt: reviewedAt || new Date().toISOString()
      };

      const authorIdx = state.users.findIndex((u) => u.id === prevSub.userId);
      if (authorIdx !== -1) {
        const author = { ...state.users[authorIdx] };
        const solved = Array.isArray(author.solvedProblems) ? [...author.solvedProblems] : [];
        if (status === 'approved' && prevStatus !== 'approved') {
          author.points = (author.points || 0) + prevSub.points;
          if (!solved.includes(prevSub.problemId)) solved.push(prevSub.problemId);
        } else if (status === 'rejected' && prevStatus === 'approved') {
          author.points = Math.max(0, (author.points || 0) - prevSub.points);
          const filtered = solved.filter((pid: string) => pid !== prevSub.problemId);
          solved.length = 0;
          solved.push(...filtered);
        }
        author.solvedProblems = solved;
        author.solvedCount = solved.length;
        state.users[authorIdx] = author;
      }

      broadcastSync();
      return { ok: true };
    }

    case 'DELETE_SUBMISSION': {
      const { subId } = payload || {};
      const idx = state.submissions.findIndex((s) => s.id === subId);
      if (idx === -1) return { ok: false, error: 'Soumission introuvable.' };
      const sub = state.submissions[idx];
      if (sub.userId !== actorId && !isAdminActor(actorId)) return { ok: false, error: 'Non autorisé.' };
      if (sub.status === 'approved') {
        const authorIdx = state.users.findIndex((u) => u.id === sub.userId);
        if (authorIdx !== -1) {
          const author = { ...state.users[authorIdx] };
          author.points = Math.max(0, (author.points || 0) - sub.points);
          author.solvedProblems = (author.solvedProblems || []).filter((id: string) => id !== sub.problemId);
          author.solvedCount = author.solvedProblems.length;
          state.users[authorIdx] = author;
        }
      }
      state.submissions.splice(idx, 1);
      broadcastSync();
      return { ok: true };
    }

    case 'CREATE_OLYMPIAD': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const oly = payload?.olympiad;
      if (!oly?.id) return { ok: false, error: 'Olympiade invalide.' };
      state.olympiads.unshift(oly);
      broadcastSync();
      return { ok: true, result: oly };
    }

    case 'UPDATE_OLYMPIAD': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const oly = payload?.olympiad;
      const idx = state.olympiads.findIndex((o) => o.id === oly?.id);
      if (idx === -1) return { ok: false, error: 'Olympiade introuvable.' };
      state.olympiads[idx] = oly;
      broadcastSync();
      return { ok: true, result: oly };
    }

    case 'UPDATE_CUTOFFS': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const { olyId, cutoffs } = payload || {};
      const idx = state.olympiads.findIndex((o) => o.id === olyId);
      if (idx === -1) return { ok: false, error: 'Olympiade introuvable.' };
      const oly = {
        ...state.olympiads[idx],
        goldCutoff: cutoffs.gold,
        silverCutoff: cutoffs.silver,
        bronzeCutoff: cutoffs.bronze,
        honorableMentionCutoff: cutoffs.mention
      };
      state.olympiads[idx] = oly;
      state.olympiadSubmissions = state.olympiadSubmissions.map((s) =>
        s.olympiadId === olyId && s.status === 'graded'
          ? { ...s, medal: computeMedal(s.overallScore, oly) }
          : s
      );
      broadcastSync();
      return { ok: true };
    }

    case 'TOGGLE_RESULTS': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const { olyId, published } = payload || {};
      const idx = state.olympiads.findIndex((o) => o.id === olyId);
      if (idx === -1) return { ok: false, error: 'Olympiade introuvable.' };
      state.olympiads[idx] = { ...state.olympiads[idx], resultsPublished: Boolean(published) };
      broadcastSync();
      return { ok: true };
    }

    case 'SUBMIT_OLYMPIAD': {
      const sub = payload?.submission;
      if (!sub?.id || !sub?.olympiadId || !sub?.userId) return { ok: false, error: 'Copie invalide.' };
      const idx = state.olympiadSubmissions.findIndex(
        (s) => s.olympiadId === sub.olympiadId && s.userId === sub.userId
      );
      if (idx !== -1) {
        if (state.olympiadSubmissions[idx].status === 'graded') {
          return { ok: false, error: 'Copie déjà notée.' };
        }
        state.olympiadSubmissions[idx] = sub;
      } else {
        state.olympiadSubmissions.unshift(sub);
      }
      broadcastSync();
      return { ok: true, result: sub };
    }

    case 'GRADE_OLYMPIAD': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const { olyId, subId, problemScores, overallScore, medal, feedback, gradedAt } = payload || {};
      const oly = state.olympiads.find((o) => o.id === olyId);
      if (!oly) return { ok: false, error: 'Olympiade introuvable.' };
      if (oly.resultsPublished) return { ok: false, error: 'Résultats déjà publiés.' };

      const idx = state.olympiadSubmissions.findIndex((s) => s.id === subId && s.olympiadId === olyId);
      if (idx === -1) return { ok: false, error: 'Copie introuvable.' };

      const prevSub = state.olympiadSubmissions[idx];
      const prevScore = prevSub.status === 'graded' ? (prevSub.overallScore || 0) : 0;
      const delta = overallScore - prevScore;

      state.olympiadSubmissions[idx] = {
        ...prevSub,
        problemScores,
        overallScore,
        medal,
        feedback,
        status: 'graded',
        gradedAt: gradedAt || new Date().toISOString()
      };

      const candIdx = state.users.findIndex((u) => u.id === prevSub.userId);
      if (candIdx !== -1) {
        const cand = { ...state.users[candIdx] };
        cand.points = Math.max(0, (cand.points || 0) + delta);
        state.users[candIdx] = cand;
      }

      broadcastSync();
      return { ok: true };
    }

    case 'BAN_USER': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      const { userId, banned, banUntil, banReason } = payload || {};
      const idx = state.users.findIndex((u) => u.id === userId);
      if (idx === -1) return { ok: false, error: 'Utilisateur introuvable.' };
      state.users[idx] = { ...state.users[idx], banned, banUntil, banReason };
      broadcastSync();
      return { ok: true };
    }

    case 'CREATE_TOPIC': {
      const topic = payload?.topic;
      if (!topic?.id) return { ok: false, error: 'Sujet invalide.' };
      if (!state.forumTopics.some((t) => t.id === topic.id)) {
        state.forumTopics.unshift(topic);
        broadcastSync();
      }
      return { ok: true };
    }

    case 'REPLY_TOPIC': {
      const { topicId, reply } = payload || {};
      const idx = state.forumTopics.findIndex((t) => t.id === topicId);
      if (idx === -1) return { ok: false, error: 'Sujet introuvable.' };
      const topic = state.forumTopics[idx];
      const replies = Array.isArray(topic.replies) ? [...topic.replies] : [];
      if (!replies.some((r: any) => r.id === reply.id)) {
        replies.push(reply);
      }
      state.forumTopics[idx] = { ...topic, replies };
      broadcastSync();
      return { ok: true };
    }

    case 'DELETE_TOPIC': {
      const { topicId } = payload || {};
      const topic = state.forumTopics.find((t) => t.id === topicId);
      if (!topic) return { ok: false, error: 'Sujet introuvable.' };
      if (!isAdminActor(actorId) && topic.authorId !== actorId) return { ok: false, error: 'Non autorisé.' };
      state.forumTopics = state.forumTopics.filter((t) => t.id !== topicId);
      broadcastSync();
      return { ok: true };
    }

    case 'DELETE_REPLY': {
      const { topicId, replyId } = payload || {};
      const idx = state.forumTopics.findIndex((t) => t.id === topicId);
      if (idx === -1) return { ok: false, error: 'Sujet introuvable.' };
      const topic = state.forumTopics[idx];
      const reply = (topic.replies || []).find((r: any) => r.id === replyId);
      if (!reply) return { ok: false, error: 'Réponse introuvable.' };
      if (!isAdminActor(actorId) && reply.authorId !== actorId) return { ok: false, error: 'Non autorisé.' };
      state.forumTopics[idx] = {
        ...topic,
        replies: (topic.replies || []).filter((r: any) => r.id !== replyId)
      };
      broadcastSync();
      return { ok: true };
    }

    case 'CREATE_VIDEO': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Seul l’administrateur peut publier des vidéos.' };
      const video = payload?.video;
      if (!video?.id) return { ok: false, error: 'Vidéo invalide.' };
      if (!state.videos.some((v) => v.id === video.id)) {
        state.videos.unshift(video);
        broadcastSync();
      }
      return { ok: true, result: video };
    }

    case 'UPDATE_VIDEO': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Seul l’administrateur peut modifier les vidéos.' };
      const video = payload?.video;
      const idx = state.videos.findIndex((v) => v.id === video?.id);
      if (idx === -1) return { ok: false, error: 'Vidéo introuvable.' };
      state.videos[idx] = video;
      broadcastSync();
      return { ok: true, result: video };
    }

    case 'DELETE_VIDEO': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Seul l’administrateur peut supprimer des vidéos.' };
      const id = payload?.id;
      state.videos = state.videos.filter((v) => v.id !== id);
      const binPath = path.join(VIDEOS_DIR, `${id}.bin`);
      if (fs.existsSync(binPath)) {
        fs.promises.unlink(binPath).catch(() => {});
      }
      videoMetaMap.delete(id);
      broadcastSync();
      return { ok: true };
    }

    case 'RESET_ALL': {
      if (!isAdminActor(actorId)) return { ok: false, error: 'Accès administrateur requis.' };
      state = createInitialState();
      if (Array.isArray(payload?.forumTopics)) {
        state.forumTopics = payload.forumTopics;
      }
      videoMetaMap.clear();
      fs.promises
        .readdir(VIDEOS_DIR)
        .then((files) => Promise.all(files.map((f) => fs.promises.unlink(path.join(VIDEOS_DIR, f)))))
        .catch(() => {});
      broadcastSync();
      return { ok: true };
    }

    default:
      return { ok: false, error: `Action inconnue: ${op}` };
  }
}

async function startServer() {
  const app = express();

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, version: stateVersion });
  });

  // Binary video upload endpoint (supports large phone gallery videos up to 250MB)
  app.post(
    '/api/videos/:id/upload',
    express.raw({ type: '*/*', limit: '250mb' }),
    async (req: Request, res: Response) => {
      try {
        const videoId = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!videoId) return res.status(400).json({ error: 'ID vidéo invalide.' });
        const buf = req.body as Buffer;
        if (!Buffer.isBuffer(buf) || buf.length === 0) {
          return res.status(400).json({ error: 'Fichier vidéo vide.' });
        }
        const mimeType = String(req.headers['content-type'] || 'video/mp4');
        const binPath = path.join(VIDEOS_DIR, `${videoId}.bin`);
        await fs.promises.writeFile(binPath, buf);
        videoMetaMap.set(videoId, { filePath: binPath, mimeType });

        // Update matching video entry if already created
        const idx = state.videos.findIndex((v) => v.id === videoId);
        if (idx !== -1) {
          state.videos[idx] = {
            ...state.videos[idx],
            videoUrl: `/api/videos/${videoId}?v=${Date.now()}`,
            mimeType
          };
          broadcastSync();
        }
        res.json({ ok: true, videoUrl: `/api/videos/${videoId}?v=${Date.now()}` });
      } catch (err) {
        console.error('Video upload error:', err);
        res.status(500).json({ error: 'Échec du téléversement vidéo.' });
      }
    }
  );

  // HTTP Range video streaming for smooth playback on PC and Android
  app.get('/api/videos/:id', async (req: Request, res: Response) => {
    const videoId = String(req.params.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const meta = videoMetaMap.get(videoId);
    const filePath = meta?.filePath || path.join(VIDEOS_DIR, `${videoId}.bin`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }
    try {
      const stat = await fs.promises.stat(filePath);
      const fileSize = stat.size;
      const mimeType = meta?.mimeType || 'video/mp4';
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (isNaN(start) || start >= fileSize) {
          return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes'
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch {
      res.status(500).end();
    }
  });

  app.use(express.json({ limit: '50mb' }));

  app.get('/api/state', (_req: Request, res: Response) => {
    res.json({ version: stateVersion, data: state });
  });

  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'sync', version: stateVersion, data: state })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  app.post('/api/sync', (req: Request, res: Response) => {
    const { op, payload, actorId } = req.body || {};
    if (!op) return res.status(400).json({ ok: false, error: 'Missing op' });
    const outcome = applyAction(op, payload, actorId);
    if (!outcome.ok) {
      return res.status(400).json(outcome);
    }
    res.json({ ok: true, version: stateVersion, result: outcome.result });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MK Olympiades server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
