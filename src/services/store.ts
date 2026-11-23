import {
  User,
  Problem,
  Submission,
  Course,
  ForumTopic,
  ForumReply,
  Olympiad,
  OlympiadSubmission,
  OlympiadTheme,
  VideoItem,
  VideoTheme
} from '../types';
import { INITIAL_PROBLEMS } from '../data/problemsData';
import { COURSES_DATA } from '../data/coursesData';
import { saveVideoBlob, getVideoBlob, deleteVideoBlob, clearAllVideoBlobs } from './videoDb';
import { formatFileSize } from './mediaUtils';

const STORAGE_KEY = 'mk_olympiades_store_v2';
const CURRENT_USER_KEY = 'mk_olympiades_current_user_id';
const EXAM_TIMERS_KEY = 'mk_olympiades_exam_timers';
const CHANNEL_NAME = 'mk_olympiades_sync_channel';

interface StoreData {
  users: User[];
  problems: Problem[];
  submissions: Submission[];
  courses: Course[];
  forumTopics: ForumTopic[];
  olympiads: Olympiad[];
  olympiadSubmissions: OlympiadSubmission[];
  videos: VideoItem[];
}

const DEFAULT_ADMIN: User = {
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

const DEFAULT_OLYMPIAD: Olympiad = {
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

const DEFAULT_FORUM_TOPICS: ForumTopic[] = [
  {
    id: 'topic-welcome',
    title: 'Bienvenue sur le forum d’olympiades & guide d’écriture LaTeX ($...$)',
    category: 'Général',
    authorId: 'usr-admin-1',
    authorName: 'Admin MK',
    content: `Bienvenue à tous les compétiteurs et passionnés de mathématiques ! Ce forum académique est ouvert à tous pour échanger sur les problèmes, soumettre vos conjectures et poser vos questions scientifiques.

Pour insérer des formules mathématiques :
- Formule en ligne : utilisez des dollars simples, par exemple \`$ x^2 + y^2 = z^2 $\` pour afficher $ x^2 + y^2 = z^2 $.
- Formule centrée en bloc : utilisez des doubles dollars, par exemple \`$$ \\sum_{k=1}^n k = \\frac{n(n+1)}{2} $$\`.
- Vous pouvez également joindre des photos de démonstrations manuscrites ou de figures géométriques (PNG, JPEG, capture).

N’hésitez pas à prévisualiser votre LaTeX avant de poster !`,
    views: 84,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    replies: [
      {
        id: 'rep-welcome-1',
        authorId: 'usr-admin-1',
        authorName: 'Admin MK',
        content: `Rappel : tout le monde peut librement consulter les discussions et solutions partagées. Pour poser un nouveau sujet ou répondre, connectez-vous ou créez un compte gratuit en quelques secondes.`,
        createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
      }
    ]
  },
  {
    id: 'topic-nt-1',
    title: 'Équation diophantienne $3^x - 2^y = 1$ dans les entiers naturels',
    category: 'Théorie des Nombres',
    authorId: 'usr-admin-1',
    authorName: 'Admin MK',
    content: `On cherche tous les couples $(x, y) \\in \\mathbb{N}^* \\times \\mathbb{N}^*$ vérifiant :
$$ 3^x - 2^y = 1 $$

Une étude modulo 4 et modulo 8 permet de tester les petites puissances. On remarque facilement les solutions $(1, 1)$ car $3^1 - 2^1 = 1$, et $(2, 3)$ car $3^2 - 2^3 = 9 - 8 = 1$.

Y a-t-il d'autres solutions entières ? Quel argument modulo permet de conclure de manière rigoureuse ?`,
    views: 65,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    replies: [
      {
        id: 'rep-nt-1',
        authorId: 'usr-admin-1',
        authorName: 'Admin MK',
        content: `Pour $y \\ge 3$, on a $2^y \\equiv 0 \\pmod 8$, ce qui implique $3^x \\equiv 1 \\pmod 8$. Or les puissances de 3 modulo 8 alternent : $3^1 \\equiv 3$, $3^2 \\equiv 1$, donc $x$ doit être pair, posons $x = 2k$.
Alors $3^{2k} - 1 = (3^k - 1)(3^k + 1) = 2^y$. Deux puissances de 2 différant de 2 sont obligatoirement 2 et 4, d'où $3^k - 1 = 2$ et $3^k + 1 = 4$, ce qui donne $k = 1$ et donc $(x, y) = (2, 3)$. C'est le cas particulier du théorème de Catalan (Mihăilescu) !`,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ]
  },
  {
    id: 'topic-geo-1',
    title: 'Droite d’Euler et relation vectorielle $OH = 3 OG$',
    category: 'Géométrie',
    authorId: 'usr-admin-1',
    authorName: 'Admin MK',
    content: `Dans un triangle non équilatéral $ABC$, soit $O$ le centre du cercle circonscrit, $G$ le centre de gravité et $H$ l'orthocentre.
Démontrer que ces trois points sont alignés sur la fameuse « Droite d'Euler » et vérifier la relation :
$$ \\vec{OH} = 3 \\vec{OG} $$
Quelles sont vos approches préférées (homothétie de centre $G$ et de rapport $-1/2$, calcul vectoriel ou nombres complexes) ?`,
    views: 48,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    replies: []
  },
  {
    id: 'topic-ineq-1',
    title: 'Inégalité de Cauchy-Schwarz sous forme de Engel (Lemme de Titu)',
    category: 'Inégalités',
    authorId: 'usr-admin-1',
    authorName: 'Admin MK',
    content: `Pour tous réels $a_1, \\dots, a_n \\in \\mathbb{R}$ et tous réels strictement positifs $b_1, \\dots, b_n > 0$, l'inégalité de Cauchy-Schwarz s'écrit sous forme de Titu :
$$ \\sum_{i=1}^n \\frac{a_i^2}{b_i} \\ge \\frac{\\left(\\sum_{i=1}^n a_i\\right)^2}{\\sum_{i=1}^n b_i} $$
Cette forme est redoutable pour démontrer l'inégalité de Nesbitt :
$$ \\frac{a}{b+c} + \\frac{b}{c+a} + \\frac{c}{a+b} \\ge \\frac{3}{2} $$
en posant $a_1 = a$, $b_1 = a(b+c)$, etc.`,
    views: 52,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    replies: []
  }
];

function getVirginStore(): StoreData {
  return {
    users: [{ ...DEFAULT_ADMIN, solvedProblems: [] }],
    problems: [...INITIAL_PROBLEMS],
    submissions: [],
    courses: COURSES_DATA,
    forumTopics: [...DEFAULT_FORUM_TOPICS],
    olympiads: [{ ...DEFAULT_OLYMPIAD }],
    olympiadSubmissions: [],
    videos: []
  };
}

function normalizeStoreData(raw: Partial<StoreData>): StoreData {
  const users = Array.isArray(raw.users) ? [...raw.users] : [{ ...DEFAULT_ADMIN, solvedProblems: [] }];
  if (!users.some((u) => u.email?.toLowerCase() === DEFAULT_ADMIN.email)) {
    users.unshift({ ...DEFAULT_ADMIN, solvedProblems: [] });
  }
  const problems = Array.isArray(raw.problems) && raw.problems.length > 0 ? raw.problems : [...INITIAL_PROBLEMS];
  const olympiads = Array.isArray(raw.olympiads) && raw.olympiads.length > 0 ? raw.olympiads : [{ ...DEFAULT_OLYMPIAD }];
  const forumTopics =
    Array.isArray(raw.forumTopics) && raw.forumTopics.length > 0
      ? raw.forumTopics.map((t) => ({
          ...t,
          replies: Array.isArray(t.replies) ? t.replies : [],
          images: Array.isArray(t.images) ? t.images : t.imageUrl ? [t.imageUrl] : [],
          views: typeof t.views === 'number' ? t.views : 0,
          category: t.category || 'Général',
          createdAt: t.createdAt || new Date().toISOString()
        }))
      : [...DEFAULT_FORUM_TOPICS];

  return {
    users,
    problems,
    submissions: Array.isArray(raw.submissions) ? raw.submissions : [],
    courses: COURSES_DATA,
    forumTopics,
    olympiads,
    olympiadSubmissions: Array.isArray(raw.olympiadSubmissions) ? raw.olympiadSubmissions : [],
    videos: Array.isArray(raw.videos) ? raw.videos : []
  };
}

function cloneUser(u: User): User {
  return {
    ...u,
    solvedProblems: Array.isArray(u.solvedProblems) ? [...u.solvedProblems] : []
  };
}

class StoreService {
  private data: StoreData;
  private listeners: Set<() => void> = new Set();
  private channel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private remoteSyncEnabled = false;
  private lastServerVersion = 0;

  constructor() {
    this.data = this.load();
    this.initCrossTabSync();
    this.initServerRealtimeSync();
  }

  private load(): StoreData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return normalizeStoreData(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load storage, using virgin store:', e);
    }
    const virgin = getVirginStore();
    this.saveDirect(virgin);
    return virgin;
  }

  private saveDirect(data: StoreData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // If localStorage quota is exceeded by large PDFs/images, keep in-memory state active
      // and persist slim copy without heavy base64 payloads so critical metadata stays safe
      console.warn('localStorage quota warning, saving lightweight fallback:', e);
      try {
        const slim: StoreData = {
          ...data,
          olympiads: data.olympiads.map((o) =>
            o.pdfUrl && o.pdfUrl.startsWith('data:') && o.pdfUrl.length > 200_000
              ? { ...o, pdfUrl: '/assets/olympiade_mk_sujet_officiel.pdf' }
              : o
          )
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      } catch {
        // ignore
      }
    }
  }

  private initCrossTabSync() {
    if (typeof window === 'undefined') return;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (ev) => {
          if (ev.data?.type === 'store_updated' && ev.data?.data) {
            this.data = normalizeStoreData(ev.data.data);
            this.saveDirect(this.data);
            this.notify();
          }
        };
      } catch {
        // ignore
      }
    }

    window.addEventListener('storage', (ev) => {
      if (ev.key === STORAGE_KEY && ev.newValue) {
        try {
          this.data = normalizeStoreData(JSON.parse(ev.newValue));
          this.notify();
        } catch {
          // ignore
        }
      }
    });
  }

  private async initServerRealtimeSync() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const json = await res.json();
      if (!json || !json.data) return;

      this.remoteSyncEnabled = true;
      this.lastServerVersion = Number(json.version || 0);

      // Seed default forum topics on server if server has none
      if (!Array.isArray(json.data.forumTopics) || json.data.forumTopics.length === 0) {
        this.pushRemoteAction('BOOTSTRAP_MERGE', { forumTopics: DEFAULT_FORUM_TOPICS });
      }

      this.data = normalizeStoreData(json.data);
      this.saveDirect(this.data);
      this.notify();

      // Open SSE stream for instant 0-refresh cross-device updates (PC <-> Android)
      if (typeof EventSource !== 'undefined') {
        const connectSse = () => {
          if (this.eventSource) {
            this.eventSource.close();
          }
          const es = new EventSource('/api/events');
          this.eventSource = es;
          es.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg?.type === 'sync' && msg.data) {
                const incomingVer = Number(msg.version || 0);
                if (incomingVer >= this.lastServerVersion) {
                  this.lastServerVersion = incomingVer;
                  this.data = normalizeStoreData(msg.data);
                  this.saveDirect(this.data);
                  this.notify();
                }
              }
            } catch {
              // ignore malformed SSE packet
            }
          };
          es.onerror = () => {
            // Reconnect automatically if temporarily disconnected
            es.close();
            setTimeout(() => {
              if (this.remoteSyncEnabled) connectSse();
            }, 2500);
          };
        };
        connectSse();
      }
    } catch {
      // Static deploy (e.g. Vercel static build) without /api backend: run smoothly in local + BroadcastChannel mode
      this.remoteSyncEnabled = false;
    }
  }

  private pushRemoteAction(op: string, payload: unknown, actorId?: string) {
    if (!this.remoteSyncEnabled) return;
    const currentActorId = actorId || localStorage.getItem(CURRENT_USER_KEY) || undefined;
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, payload, actorId: currentActorId })
    }).catch(() => {
      // Ignore network hiccup; local optimistic state already applied
    });
  }

  private save() {
    this.saveDirect(this.data);
    try {
      this.channel?.postMessage({ type: 'store_updated', data: this.data });
    } catch {
      // ignore
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public resetToVirgin() {
    const virgin = getVirginStore();
    this.data = virgin;
    this.save();
    localStorage.removeItem(EXAM_TIMERS_KEY);
    clearAllVideoBlobs().catch(() => {});
    this.pushRemoteAction('RESET_ALL', { forumTopics: DEFAULT_FORUM_TOPICS });
  }

  // ---------------- AUTH ----------------
  public getCurrentUser(): User | null {
    const userId = localStorage.getItem(CURRENT_USER_KEY);
    if (!userId) return null;
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
    this.checkBanStatus(user);
    return cloneUser(user);
  }

  public setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, user.id);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    this.notify();
  }

  public checkBanStatus(user: User): boolean {
    if (!user || !user.banned) return false;
    if (user.banUntil && user.banUntil !== 'permanent') {
      const expiry = new Date(user.banUntil).getTime();
      if (Date.now() >= expiry) {
        const idx = this.data.users.findIndex((u) => u.id === user.id);
        if (idx !== -1) {
          this.data.users[idx] = {
            ...this.data.users[idx],
            banned: false,
            banUntil: null,
            banReason: null
          };
          this.save();
        }
        return false;
      }
    }
    return true;
  }

  public register(username: string, email: string, password: string): { user?: User; error?: string } {
    const trimmedUser = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedUser || !normalizedEmail || !password) {
      return { error: 'Tous les champs sont obligatoires.' };
    }

    const existing = this.data.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return { error: 'Cette adresse e-mail est déjà utilisée par un autre compte.' };
    }

    const isAdmin = normalizedEmail === 'admin12@gmail.com' && password === 'admin12';
    const avatarColors = ['#0056b3', '#0f4c81', '#2563eb', '#0284c7', '#0369a1', '#1d4ed8'];
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const newUser: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: trimmedUser,
      email: normalizedEmail,
      password,
      role: isAdmin ? 'admin' : 'user',
      points: 0,
      solvedProblems: [],
      solvedCount: 0,
      banned: false,
      banUntil: null,
      banReason: null,
      createdAt: new Date().toISOString(),
      avatarColor: randomColor,
      bio: 'Participant aux Olympiades Mathématiques MK.'
    };

    this.data.users = [...this.data.users, newUser];
    localStorage.setItem(CURRENT_USER_KEY, newUser.id);
    this.save();
    this.pushRemoteAction('REGISTER_USER', { user: newUser }, newUser.id);
    return { user: cloneUser(newUser) };
  }

  public login(email: string, password: string): { user?: User; error?: string } {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === 'admin12@gmail.com' && password === 'admin12') {
      let adminIdx = this.data.users.findIndex((u) => u.email.toLowerCase() === 'admin12@gmail.com');
      let admin: User;
      if (adminIdx === -1) {
        admin = { ...DEFAULT_ADMIN, solvedProblems: [] };
        this.data.users = [admin, ...this.data.users];
      } else {
        admin = { ...this.data.users[adminIdx], role: 'admin' };
        this.data.users[adminIdx] = admin;
      }
      localStorage.setItem(CURRENT_USER_KEY, admin.id);
      this.save();
      return { user: cloneUser(admin) };
    }

    const user = this.data.users.find((u) => u.email.toLowerCase() === normalizedEmail && u.password === password);
    if (!user) {
      return { error: 'Identifiants incorrects. Vérifiez votre adresse email et mot de passe.' };
    }

    this.checkBanStatus(user);
    this.setCurrentUser(user);
    return { user: cloneUser(user) };
  }

  public logout() {
    this.setCurrentUser(null);
  }

  public deleteAccount(userId: string): { success?: boolean; error?: string } {
    const idx = this.data.users.findIndex((u) => u.id === userId);
    if (idx === -1) return { error: 'Compte introuvable.' };

    if (this.data.users[idx].email.toLowerCase() === 'admin12@gmail.com') {
      return { error: 'Le compte administrateur principal ne peut pas être supprimé.' };
    }

    this.data.users = this.data.users.filter((u) => u.id !== userId);
    this.data.submissions = this.data.submissions.filter((s) => s.userId !== userId);
    this.data.olympiadSubmissions = this.data.olympiadSubmissions.filter((s) => s.userId !== userId);
    localStorage.removeItem(CURRENT_USER_KEY);
    this.save();
    this.pushRemoteAction('DELETE_ACCOUNT', { userId }, userId);
    return { success: true };
  }

  public getUsers(): User[] {
    return [...this.data.users]
      .map(cloneUser)
      .sort((a, b) => b.points - a.points || b.solvedCount - a.solvedCount || b.createdAt.localeCompare(a.createdAt));
  }

  public getUserById(id: string): User | undefined {
    const u = this.data.users.find((usr) => usr.id === id);
    return u ? cloneUser(u) : undefined;
  }

  // ---------------- PROBLEMS & SUBMISSIONS ----------------
  public getProblems(theme?: string, points?: number | string): Problem[] {
    let list = this.data.problems;
    if (theme && theme !== 'all') {
      list = list.filter((p) => p.theme === theme);
    }
    if (points && points !== 'all') {
      const pts = typeof points === 'string' ? parseInt(points, 10) : points;
      list = list.filter((p) => p.points === pts);
    }
    return list.map((p) => ({ ...p, images: p.images ? [...p.images] : undefined }));
  }

  public getProblemById(id: string): Problem | undefined {
    const p = this.data.problems.find((prob) => prob.id === id);
    return p ? { ...p, images: p.images ? [...p.images] : undefined } : undefined;
  }

  public createProblem(problemData: {
    problemNumber?: string;
    theme: OlympiadTheme;
    points: number;
    title: string;
    statement: string;
    difficulty?: string;
    images?: string[];
  }): Problem {
    const themePrefixMap: Record<OlympiadTheme, string> = {
      'Théorie des Nombres': 'nt',
      Géométrie: 'geo',
      Combinatoire: 'comb',
      Inégalités: 'ineq',
      'Équations Fonctionnelles': 'fe'
    };
    const prefix = themePrefixMap[problemData.theme] || 'prob';
    const numPart = problemData.problemNumber
      ? problemData.problemNumber.replace(/\D/g, '') || `${Date.now()}`
      : `${Date.now()}`;
    const id = `${prefix}-${numPart}-${Math.random().toString(36).substring(2, 6)}`;

    const newProblem: Problem = {
      id,
      problemNumber: problemData.problemNumber?.trim() || undefined,
      theme: problemData.theme,
      points: Number(problemData.points),
      difficulty: problemData.difficulty || `${problemData.points} pts`,
      title: problemData.title.trim(),
      statement: problemData.statement ? problemData.statement.trim() : '',
      images: Array.isArray(problemData.images) ? [...problemData.images] : [],
      createdAt: new Date().toISOString()
    };

    this.data.problems = [newProblem, ...this.data.problems];
    this.save();
    this.pushRemoteAction('CREATE_PROBLEM', { problem: newProblem });
    return { ...newProblem };
  }

  public updateProblem(
    id: string,
    updates: Partial<Omit<Problem, 'id'>> & { problemNumber?: string }
  ): Problem | null {
    const idx = this.data.problems.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const existing = this.data.problems[idx];
    const points = updates.points !== undefined ? Number(updates.points) : existing.points;
    const updated: Problem = {
      ...existing,
      ...updates,
      points,
      difficulty: updates.difficulty || `${points} pts`,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      statement: updates.statement !== undefined ? updates.statement.trim() : existing.statement,
      images: updates.images !== undefined ? [...updates.images] : [...(existing.images || [])],
      problemNumber:
        updates.problemNumber !== undefined ? updates.problemNumber.trim() || undefined : existing.problemNumber,
      updatedAt: new Date().toISOString()
    };

    this.data.problems = this.data.problems.map((p, i) => (i === idx ? updated : p));
    this.data.submissions = this.data.submissions.map((s) =>
      s.problemId === id
        ? {
            ...s,
            problemTitle: updates.title ? updates.title.trim() : s.problemTitle,
            category: updates.theme || s.category,
            points: updates.points !== undefined ? points : s.points
          }
        : s
    );

    this.save();
    this.pushRemoteAction('UPDATE_PROBLEM', { problem: updated });
    return { ...updated };
  }

  public deleteProblem(id: string): boolean {
    const exists = this.data.problems.some((p) => p.id === id);
    if (!exists) return false;
    this.data.problems = this.data.problems.filter((p) => p.id !== id);
    this.save();
    this.pushRemoteAction('DELETE_PROBLEM', { id });
    return true;
  }

  public resetProblemsToInitial(): void {
    this.data.problems = [...INITIAL_PROBLEMS];
    this.save();
  }

  public getMySubmission(problemId: string, userId: string): Submission | null {
    const s = this.data.submissions.find((sub) => sub.problemId === problemId && sub.userId === userId);
    return s ? { ...s, images: [...s.images], reviewImages: s.reviewImages ? [...s.reviewImages] : undefined } : null;
  }

  public getUserSubmissions(userId: string): Submission[] {
    return this.data.submissions
      .filter((s) => s.userId === userId)
      .map((s) => ({ ...s, images: [...s.images], reviewImages: s.reviewImages ? [...s.reviewImages] : undefined }));
  }

  public submitProblemSolution(
    problemId: string,
    user: User,
    data: { images?: string[]; solutionText?: string }
  ): { success?: boolean; submission?: Submission; error?: string } {
    if (this.checkBanStatus(user)) {
      return { error: `Votre compte est suspendu. Motif : ${user.banReason || 'Activité inappropriée'}.` };
    }

    const problem = this.getProblemById(problemId);
    if (!problem) return { error: 'Problème non trouvé.' };

    const images = Array.isArray(data.images) ? data.images.filter((img) => img && img.trim().length > 0) : [];
    const text = (data.solutionText || '').trim();

    if (images.length === 0 && text.length === 0) {
      return { error: 'Veuillez fournir au moins une image/polycopie OU une rédaction LaTeX de votre solution.' };
    }

    const existingIdx = this.data.submissions.findIndex(
      (s) => s.problemId === problem.id && s.userId === user.id
    );
    if (existingIdx !== -1) {
      const existingSub = this.data.submissions[existingIdx];
      if (existingSub.status === 'approved') {
        return {
          error:
            "Votre solution a déjà été acceptée et validée par l'administrateur. Cette soumission est définitivement clôturée et ne peut plus être modifiée."
        };
      }
      if (existingSub.status === 'pending') {
        return {
          error:
            "Votre solution est actuellement en attente de correction par l'administrateur. Vous ne pouvez pas la modifier tant qu'elle n'a pas été évaluée."
        };
      }

      const updatedSub: Submission = {
        ...existingSub,
        images,
        imageUrl: images[0] || '',
        solutionText: text,
        status: 'pending',
        reviewReason: null,
        reviewedAt: null,
        updatedAt: new Date().toISOString()
      };
      this.data.submissions = this.data.submissions.map((s, i) => (i === existingIdx ? updatedSub : s));
      this.save();
      this.pushRemoteAction('SUBMIT_PROBLEM', { submission: updatedSub }, user.id);
      return { success: true, submission: { ...updatedSub } };
    }

    const newSub: Submission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      problemId: problem.id,
      problemTitle: problem.title,
      category: problem.theme,
      points: problem.points,
      userId: user.id,
      username: user.username,
      userEmail: user.email,
      images,
      imageUrl: images[0] || '',
      solutionText: text,
      status: 'pending',
      reviewReason: null,
      submittedAt: new Date().toISOString(),
      reviewedAt: null
    };

    this.data.submissions = [newSub, ...this.data.submissions];
    this.save();
    this.pushRemoteAction('SUBMIT_PROBLEM', { submission: newSub }, user.id);
    return { success: true, submission: { ...newSub } };
  }

  public deleteSubmission(subId: string, currentUserId: string): { success?: boolean; error?: string } {
    const sub = this.data.submissions.find((s) => s.id === subId);
    if (!sub) return { error: 'Soumission introuvable.' };

    const currentUser = this.getUserById(currentUserId);
    const isOwner = sub.userId === currentUserId;
    const isAdmin = currentUser?.role === 'admin';
    if (!isOwner && !isAdmin) return { error: 'Action non autorisée.' };

    if (sub.status === 'approved') {
      this.data.users = this.data.users.map((u) => {
        if (u.id !== sub.userId) return u;
        const solved = u.solvedProblems.filter((id) => id !== sub.problemId);
        return {
          ...u,
          points: Math.max(0, u.points - sub.points),
          solvedProblems: solved,
          solvedCount: solved.length
        };
      });
    }

    this.data.submissions = this.data.submissions.filter((s) => s.id !== subId);
    this.save();
    this.pushRemoteAction('DELETE_SUBMISSION', { subId }, currentUserId);
    return { success: true };
  }

  // ---------------- OLYMPIADS & COUNTDOWN TIMER ----------------
  public getOlympiads(): Olympiad[] {
    return (this.data.olympiads || []).map((o) => ({ ...o }));
  }

  public getOlympiadById(id: string): Olympiad | undefined {
    const o = this.data.olympiads.find((oly) => oly.id === id);
    return o ? { ...o } : undefined;
  }

  public createOlympiad(newOly: Omit<Olympiad, 'id' | 'createdAt'>): Olympiad {
    const oly: Olympiad = {
      ...newOly,
      id: `oly-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    this.data.olympiads = [oly, ...this.data.olympiads];
    this.save();
    this.pushRemoteAction('CREATE_OLYMPIAD', { olympiad: oly });
    return { ...oly };
  }

  public updateOlympiadMedalCutoffs(
    olyId: string,
    cutoffs: { gold: number; silver: number; bronze: number; mention: number }
  ): boolean {
    const idx = this.data.olympiads.findIndex((o) => o.id === olyId);
    if (idx === -1) return false;

    const oly: Olympiad = {
      ...this.data.olympiads[idx],
      goldCutoff: cutoffs.gold,
      silverCutoff: cutoffs.silver,
      bronzeCutoff: cutoffs.bronze,
      honorableMentionCutoff: cutoffs.mention
    };
    this.data.olympiads = this.data.olympiads.map((o, i) => (i === idx ? oly : o));

    this.data.olympiadSubmissions = this.data.olympiadSubmissions.map((sub) => {
      if (sub.olympiadId !== olyId || sub.status !== 'graded') return sub;
      const total = sub.overallScore;
      let medal = 'Certificat de Participation';
      if (total >= oly.goldCutoff) medal = "🥇 Médaille d'Or";
      else if (total >= oly.silverCutoff) medal = "🥈 Médaille d'Argent";
      else if (total >= oly.bronzeCutoff) medal = "🥉 Médaille de Bronze";
      else if (total >= (oly.honorableMentionCutoff || oly.pointsPerProblem)) medal = '🎖️ Mention Honorable';
      return { ...sub, medal };
    });

    this.save();
    this.pushRemoteAction('UPDATE_CUTOFFS', { olyId, cutoffs });
    return true;
  }

  public toggleOlympiadResults(olyId: string, published: boolean): boolean {
    const idx = this.data.olympiads.findIndex((o) => o.id === olyId);
    if (idx === -1) return false;
    this.data.olympiads = this.data.olympiads.map((o, i) =>
      i === idx ? { ...o, resultsPublished: published } : o
    );
    this.save();
    this.pushRemoteAction('TOGGLE_RESULTS', { olyId, published });
    return true;
  }

  public updateOlympiad(olyId: string, updates: Partial<Olympiad>): Olympiad | null {
    const idx = this.data.olympiads.findIndex((o) => o.id === olyId);
    if (idx === -1) return null;

    const prev = this.data.olympiads[idx];
    const oly: Olympiad = { ...prev };

    if (updates.totalDurationMinutes !== undefined) {
      const totalMins = Math.max(1, Number(updates.totalDurationMinutes));
      oly.totalDurationMinutes = totalMins;
      oly.durationHours = Math.floor(totalMins / 60);
      oly.durationMinutes = totalMins % 60;
    } else if (updates.durationHours !== undefined || updates.durationMinutes !== undefined) {
      const h = updates.durationHours !== undefined ? Math.max(0, Number(updates.durationHours)) : oly.durationHours;
      const m =
        updates.durationMinutes !== undefined ? Math.max(0, Number(updates.durationMinutes)) : oly.durationMinutes;
      oly.durationHours = h;
      oly.durationMinutes = m;
      oly.totalDurationMinutes = Math.max(1, h * 60 + m);
    }

    if (updates.title !== undefined) oly.title = updates.title.trim();
    if (updates.description !== undefined) oly.description = updates.description.trim();
    if (updates.pdfUrl !== undefined) oly.pdfUrl = updates.pdfUrl;
    if (updates.pdfTitle !== undefined) oly.pdfTitle = updates.pdfTitle;
    if (updates.pdfFileSize !== undefined) oly.pdfFileSize = updates.pdfFileSize;
    if (updates.pdfUpdatedAt !== undefined) oly.pdfUpdatedAt = updates.pdfUpdatedAt;
    if (updates.problemCount !== undefined) oly.problemCount = Number(updates.problemCount);
    if (updates.pointsPerProblem !== undefined) oly.pointsPerProblem = Number(updates.pointsPerProblem);
    if (updates.totalPoints !== undefined) oly.totalPoints = Number(updates.totalPoints);
    if (updates.goldCutoff !== undefined) oly.goldCutoff = Number(updates.goldCutoff);
    if (updates.silverCutoff !== undefined) oly.silverCutoff = Number(updates.silverCutoff);
    if (updates.bronzeCutoff !== undefined) oly.bronzeCutoff = Number(updates.bronzeCutoff);
    if (updates.honorableMentionCutoff !== undefined)
      oly.honorableMentionCutoff = Number(updates.honorableMentionCutoff);
    if (updates.status !== undefined) oly.status = updates.status;
    if (updates.resultsPublished !== undefined) oly.resultsPublished = updates.resultsPublished;

    this.data.olympiads = this.data.olympiads.map((o, i) => (i === idx ? oly : o));
    this.save();
    this.pushRemoteAction('UPDATE_OLYMPIAD', { olympiad: oly });
    return { ...oly };
  }

  public resetExamTimer(olyId: string, userId?: string) {
    try {
      const stored = localStorage.getItem(EXAM_TIMERS_KEY);
      if (stored) {
        const timers = JSON.parse(stored);
        if (userId) {
          delete timers[`${olyId}_${userId}`];
        } else {
          Object.keys(timers).forEach((k) => {
            if (k.startsWith(`${olyId}_`)) delete timers[k];
          });
        }
        localStorage.setItem(EXAM_TIMERS_KEY, JSON.stringify(timers));
      }
    } catch {
      // ignore
    }
    this.notify();
  }

  public deleteOlympiad(olyId: string) {
    this.data.olympiads = this.data.olympiads.filter((o) => o.id !== olyId);
    this.data.olympiadSubmissions = this.data.olympiadSubmissions.filter((s) => s.olympiadId !== olyId);
    this.save();
  }

  public getExamStartTime(olyId: string, userId: string): number | null {
    try {
      const stored = localStorage.getItem(EXAM_TIMERS_KEY);
      if (stored) {
        const timers = JSON.parse(stored);
        return timers[`${olyId}_${userId}`] || null;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public startExam(olyId: string, userId: string): number {
    let timers: Record<string, number> = {};
    try {
      const stored = localStorage.getItem(EXAM_TIMERS_KEY);
      if (stored) timers = JSON.parse(stored);
    } catch {
      // ignore
    }
    const key = `${olyId}_${userId}`;
    if (!timers[key]) {
      timers[key] = Date.now();
      localStorage.setItem(EXAM_TIMERS_KEY, JSON.stringify(timers));
    }
    this.notify();
    return timers[key];
  }

  public submitOlympiadCopies(
    olyId: string,
    user: User,
    data: { images?: string[]; solutionNotes?: string }
  ): { success?: boolean; submission?: OlympiadSubmission; error?: string } {
    if (this.checkBanStatus(user)) {
      return { error: 'Votre compte est suspendu. Participation refusée.' };
    }

    const oly = this.getOlympiadById(olyId);
    if (!oly) return { error: 'Olympiade non trouvée.' };

    const startTime = this.getExamStartTime(olyId, user.id);
    if (startTime) {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const totalAllowedSeconds = oly.totalDurationMinutes * 60;
      if (elapsedSeconds >= totalAllowedSeconds) {
        return {
          error: "Temps officiel écoulé ! Le chronomètre est arrivé à terme. Aucune soumission ne peut plus être acceptée."
        };
      }
    }

    const images = Array.isArray(data.images) ? data.images.filter((img) => img && img.trim().length > 0) : [];
    const notes = (data.solutionNotes || '').trim();

    if (images.length === 0 && notes.length === 0) {
      return {
        error: 'Veuillez joindre au moins une image de copie manuscrite OU votre rédaction de solution en LaTeX.'
      };
    }

    const existingIdx = this.data.olympiadSubmissions.findIndex(
      (s) => s.olympiadId === oly.id && s.userId === user.id
    );
    let sub: OlympiadSubmission;

    if (existingIdx !== -1) {
      const existing = this.data.olympiadSubmissions[existingIdx];
      if (existing.status === 'graded') {
        return {
          error:
            "L'administrateur a déjà corrigé et noté votre copie. Vous ne pouvez plus modifier votre copie ni ajouter de photos ou de texte."
        };
      }
      if (oly.resultsPublished) {
        return {
          error: "Les résultats officiels de cette olympiade sont publiés. Aucune modification de copie n'est autorisée."
        };
      }
      sub = {
        ...existing,
        images,
        solutionNotes: notes,
        updatedAt: new Date().toISOString(),
        status: 'submitted'
      };
      this.data.olympiadSubmissions = this.data.olympiadSubmissions.map((s, i) => (i === existingIdx ? sub : s));
    } else {
      if (oly.resultsPublished) {
        return {
          error: "Les résultats officiels de cette olympiade sont déjà publiés. Les nouvelles participations sont closes."
        };
      }
      sub = {
        id: `olysub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        olympiadId: oly.id,
        userId: user.id,
        username: user.username,
        userEmail: user.email,
        images,
        solutionNotes: notes,
        status: 'submitted',
        problemScores: {},
        overallScore: 0,
        medal: 'Non évalué',
        feedback: '',
        submittedAt: new Date().toISOString(),
        gradedAt: null
      };
      this.data.olympiadSubmissions = [sub, ...this.data.olympiadSubmissions];
    }

    this.save();
    this.pushRemoteAction('SUBMIT_OLYMPIAD', { submission: sub }, user.id);
    return { success: true, submission: { ...sub } };
  }

  public getMyOlympiadSubmission(olyId: string, userId: string): OlympiadSubmission | null {
    const s = this.data.olympiadSubmissions.find((sub) => sub.olympiadId === olyId && sub.userId === userId);
    return s ? { ...s, images: [...s.images], problemScores: { ...s.problemScores } } : null;
  }

  public getUserOlympiadSubmissions(userId: string): OlympiadSubmission[] {
    return this.data.olympiadSubmissions
      .filter((s) => s.userId === userId)
      .map((s) => ({ ...s, images: [...s.images], problemScores: { ...s.problemScores } }));
  }

  public getOlympiadSubmissionsForAdmin(olyId: string): OlympiadSubmission[] {
    return this.data.olympiadSubmissions
      .filter((s) => s.olympiadId === olyId)
      .map((s) => ({ ...s, images: [...s.images], problemScores: { ...s.problemScores } }));
  }

  public gradeOlympiadSubmission(
    olyId: string,
    subId: string,
    scores: Record<string, number>,
    feedback: string
  ): { success?: boolean; submission?: OlympiadSubmission; error?: string } {
    const oly = this.getOlympiadById(olyId);
    if (!oly) return { error: 'Olympiade introuvable.' };

    if (oly.resultsPublished) {
      return {
        error:
          'Les résultats de cette olympiade ont été ouverts et publiés au public. Les notes et les appréciations/réponses du jury sont définitivement verrouillées et ne peuvent plus être modifiées.'
      };
    }

    const idx = this.data.olympiadSubmissions.findIndex((s) => s.id === subId && s.olympiadId === olyId);
    if (idx === -1) return { error: 'Soumission introuvable.' };

    const prevSub = this.data.olympiadSubmissions[idx];
    const prevScore = prevSub.status === 'graded' ? prevSub.overallScore || 0 : 0;

    let total = 0;
    const parsedScores: Record<string, number> = {};
    for (let i = 1; i <= oly.problemCount; i++) {
      const key = `P${i}`;
      const val = Math.max(0, Math.min(scores[key] ?? scores[i.toString()] ?? 0, oly.pointsPerProblem));
      parsedScores[key] = val;
      total += val;
    }

    let medal = 'Certificat de Participation';
    if (total >= oly.goldCutoff) medal = "🥇 Médaille d'Or";
    else if (total >= oly.silverCutoff) medal = "🥈 Médaille d'Argent";
    else if (total >= oly.bronzeCutoff) medal = "🥉 Médaille de Bronze";
    else if (total >= (oly.honorableMentionCutoff || oly.pointsPerProblem)) medal = '🎖️ Mention Honorable';

    const gradedAt = new Date().toISOString();
    const updatedSub: OlympiadSubmission = {
      ...prevSub,
      problemScores: parsedScores,
      overallScore: total,
      medal,
      feedback: feedback || 'Copie examinée et notée par le jury MK.',
      status: 'graded',
      gradedAt
    };

    this.data.olympiadSubmissions = this.data.olympiadSubmissions.map((s, i) => (i === idx ? updatedSub : s));

    const delta = total - prevScore;
    this.data.users = this.data.users.map((u) =>
      u.id === prevSub.userId ? { ...u, points: Math.max(0, (u.points || 0) + delta) } : u
    );

    this.save();
    this.pushRemoteAction('GRADE_OLYMPIAD', {
      olyId,
      subId,
      problemScores: parsedScores,
      overallScore: total,
      medal,
      feedback: updatedSub.feedback,
      gradedAt
    });
    return { success: true, submission: { ...updatedSub } };
  }

  public getOlympiadLeaderboard(olyId: string): { locked: boolean; rankings: OlympiadSubmission[] } {
    const oly = this.getOlympiadById(olyId);
    if (!oly) return { locked: true, rankings: [] };

    const subs = this.data.olympiadSubmissions
      .filter((s) => s.olympiadId === olyId && s.status === 'graded')
      .map((s) => ({ ...s, images: [...s.images], problemScores: { ...s.problemScores } }))
      .sort((a, b) => b.overallScore - a.overallScore);

    return {
      locked: !oly.resultsPublished,
      rankings: subs
    };
  }

  // ---------------- ADMIN PROBLEM REVIEWS & USER BANS ----------------
  public getAllSubmissions(): Submission[] {
    return this.data.submissions.map((s) => ({
      ...s,
      images: [...s.images],
      reviewImages: s.reviewImages ? [...s.reviewImages] : undefined
    }));
  }

  public reviewSubmission(
    subId: string,
    status: 'approved' | 'rejected',
    reason?: string,
    reviewImages?: string[]
  ): { success?: boolean; error?: string } {
    const idx = this.data.submissions.findIndex((s) => s.id === subId);
    if (idx === -1) return { error: 'Soumission introuvable.' };

    const prevSub = this.data.submissions[idx];
    const prevStatus = prevSub.status;
    const resolvedReason =
      reason !== undefined ? reason : status === 'approved' ? 'Validé par l’administrateur.' : 'Démonstration incomplète.';
    const reviewedAt = new Date().toISOString();

    const updatedSub: Submission = {
      ...prevSub,
      status,
      reviewReason: resolvedReason,
      reviewImages: reviewImages !== undefined ? [...reviewImages] : prevSub.reviewImages,
      reviewedAt
    };

    this.data.submissions = this.data.submissions.map((s, i) => (i === idx ? updatedSub : s));

    this.data.users = this.data.users.map((u) => {
      if (u.id !== prevSub.userId) return u;
      const solved = [...(u.solvedProblems || [])];
      let points = u.points || 0;
      if (status === 'approved' && prevStatus !== 'approved') {
        points += prevSub.points;
        if (!solved.includes(prevSub.problemId)) solved.push(prevSub.problemId);
      } else if (status === 'rejected' && prevStatus === 'approved') {
        points = Math.max(0, points - prevSub.points);
        const filtered = solved.filter((id) => id !== prevSub.problemId);
        solved.length = 0;
        solved.push(...filtered);
      }
      return { ...u, points, solvedProblems: solved, solvedCount: solved.length };
    });

    this.save();
    this.pushRemoteAction('REVIEW_SUBMISSION', {
      subId,
      status,
      reason: resolvedReason,
      reviewImages,
      reviewedAt
    });
    return { success: true };
  }

  public banUser(userId: string, duration: string, reason?: string): { success?: boolean; error?: string } {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return { error: 'Utilisateur introuvable.' };
    if (user.role === 'admin') return { error: 'Impossible de bannir un administrateur.' };

    let banUntil: string | null = null;
    const now = Date.now();
    switch (duration) {
      case '1_day':
        banUntil = new Date(now + 24 * 3600 * 1000).toISOString();
        break;
      case '3_days':
        banUntil = new Date(now + 3 * 24 * 3600 * 1000).toISOString();
        break;
      case '7_days':
        banUntil = new Date(now + 7 * 24 * 3600 * 1000).toISOString();
        break;
      case '1_month':
        banUntil = new Date(now + 30 * 24 * 3600 * 1000).toISOString();
        break;
      case 'permanent':
        banUntil = 'permanent';
        break;
      default:
        return { error: 'Durée invalide.' };
    }

    const banReason = reason || 'Non-respect des règles académiques ou plagiat.';
    this.data.users = this.data.users.map((u) =>
      u.id === userId ? { ...u, banned: true, banUntil, banReason } : u
    );
    this.save();
    this.pushRemoteAction('BAN_USER', { userId, banned: true, banUntil, banReason });
    return { success: true };
  }

  public unbanUser(userId: string): { success?: boolean; error?: string } {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return { error: 'Utilisateur introuvable.' };
    this.data.users = this.data.users.map((u) =>
      u.id === userId ? { ...u, banned: false, banUntil: null, banReason: null } : u
    );
    this.save();
    this.pushRemoteAction('BAN_USER', { userId, banned: false, banUntil: null, banReason: null });
    return { success: true };
  }

  // ---------------- FORUM & REPLIES ----------------
  public getForumTopics(category?: string): ForumTopic[] {
    let list = this.data.forumTopics || [];
    if (category && category !== 'all') {
      list = list.filter((t) => t.category === category);
    }
    return list.map((t) => ({
      ...t,
      replies: (t.replies || []).map((r) => ({ ...r }))
    }));
  }

  public getForumTopicById(id: string): ForumTopic | undefined {
    const t = (this.data.forumTopics || []).find((topic) => topic.id === id);
    return t ? { ...t, replies: (t.replies || []).map((r) => ({ ...r })) } : undefined;
  }

  public incrementTopicViews(id: string): void {
    this.data.forumTopics = (this.data.forumTopics || []).map((t) =>
      t.id === id ? { ...t, views: (t.views || 0) + 1 } : t
    );
    this.saveDirect(this.data);
  }

  public createForumTopic(
    user: User,
    data: {
      title: string;
      category: string;
      content?: string;
      imageUrl?: string | null;
      images?: string[];
    }
  ): { success?: boolean; topic?: ForumTopic; error?: string } {
    if (this.checkBanStatus(user)) {
      return { error: `Votre compte est suspendu. Motif : ${user.banReason || 'non autorisé'}.` };
    }

    const { title, category, content = '', imageUrl, images } = data;
    if (!title?.trim() || !category) {
      return { error: 'Le titre et la catégorie sont obligatoires.' };
    }

    const hasText = Boolean(content && content.trim().length > 0);
    const resolvedImages = images && images.length > 0 ? images : imageUrl ? [imageUrl] : [];
    const hasImage = resolvedImages.length > 0;

    if (!hasText && !hasImage) {
      return { error: 'Veuillez saisir du texte LaTeX ou joindre au moins une photo/image.' };
    }

    const check = this.checkContentSafety(title, hasText ? content : '');
    if (!check.approved) {
      return { error: check.reason };
    }

    const topic: ForumTopic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      category,
      authorId: user.id,
      authorName: user.username,
      content: content.trim(),
      imageUrl: resolvedImages[0] || null,
      images: resolvedImages,
      views: 1,
      createdAt: new Date().toISOString(),
      replies: []
    };

    this.data.forumTopics = [topic, ...(this.data.forumTopics || [])];
    this.save();
    this.pushRemoteAction('CREATE_TOPIC', { topic }, user.id);
    return { success: true, topic: { ...topic } };
  }

  public replyToForumTopic(
    topicId: string,
    user: User,
    data: { content?: string; imageUrl?: string | null; images?: string[] }
  ): { success?: boolean; reply?: ForumReply; error?: string } {
    if (this.checkBanStatus(user)) {
      return { error: `Votre compte est suspendu. Motif : ${user.banReason || 'non autorisé'}.` };
    }

    const topic = (this.data.forumTopics || []).find((t) => t.id === topicId);
    if (!topic) return { error: 'Sujet introuvable.' };

    const { content = '', imageUrl, images } = data;
    const resolvedImages = images && images.length > 0 ? images : imageUrl ? [imageUrl] : [];
    const hasText = Boolean(content && content.trim().length > 0);
    const hasImage = resolvedImages.length > 0;

    if (!hasText && !hasImage) {
      return { error: 'Votre réponse doit contenir du texte LaTeX ou au moins une image.' };
    }

    if (hasText) {
      const check = this.checkContentSafety('', content);
      if (!check.approved) return { error: check.reason };
    }

    const reply: ForumReply = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      authorId: user.id,
      authorName: user.username,
      content: content.trim(),
      imageUrl: resolvedImages[0] || null,
      images: resolvedImages,
      createdAt: new Date().toISOString()
    };

    this.data.forumTopics = (this.data.forumTopics || []).map((t) =>
      t.id === topicId ? { ...t, replies: [...(t.replies || []), reply] } : t
    );
    this.save();
    this.pushRemoteAction('REPLY_TOPIC', { topicId, reply }, user.id);
    return { success: true, reply: { ...reply } };
  }

  public deleteForumTopic(topicId: string, currentUser?: User | null): { success?: boolean; error?: string } {
    if (!currentUser) return { error: 'Authentification requise.' };
    const topic = (this.data.forumTopics || []).find((t) => t.id === topicId);
    if (!topic) return { error: 'Sujet introuvable.' };

    if (currentUser.role !== 'admin' && currentUser.id !== topic.authorId) {
      return { error: 'Seul un administrateur ou l’auteur peut supprimer ce sujet de discussion.' };
    }

    this.data.forumTopics = (this.data.forumTopics || []).filter((t) => t.id !== topicId);
    this.save();
    this.pushRemoteAction('DELETE_TOPIC', { topicId }, currentUser.id);
    return { success: true };
  }

  public deleteForumReply(
    topicId: string,
    replyId: string,
    currentUser?: User | null
  ): { success?: boolean; error?: string } {
    if (!currentUser) return { error: 'Authentification requise.' };
    const topic = (this.data.forumTopics || []).find((t) => t.id === topicId);
    if (!topic) return { error: 'Sujet introuvable.' };

    const reply = (topic.replies || []).find((r) => r.id === replyId);
    if (!reply) return { error: 'Réponse introuvable.' };

    if (currentUser.role !== 'admin' && currentUser.id !== reply.authorId) {
      return { error: 'Seul un administrateur ou l’auteur peut supprimer cette réponse.' };
    }

    this.data.forumTopics = (this.data.forumTopics || []).map((t) =>
      t.id === topicId ? { ...t, replies: (t.replies || []).filter((r) => r.id !== replyId) } : t
    );
    this.save();
    this.pushRemoteAction('DELETE_REPLY', { topicId, replyId }, currentUser.id);
    return { success: true };
  }

  private checkContentSafety(title: string, content: string): { approved: boolean; reason: string } {
    const FORBIDDEN_WORDS = [
      'spam',
      'casino',
      'viagra',
      'crypto scam',
      'insulte',
      'connard',
      'salaud',
      'merde',
      'putain',
      'idiot',
      'imbecile',
      'nude',
      'porn',
      'xxx'
    ];
    const text = `${title} ${content}`.toLowerCase();
    for (const w of FORBIDDEN_WORDS) {
      const regex = new RegExp(`(^|\\W)${w}(\\W|$)`, 'i');
      if (regex.test(text)) {
        return {
          approved: false,
          reason: `Contenu rejeté : terme non autorisé "${w}". Respectez les règles académiques de la plateforme MK Olympiades.`
        };
      }
    }
    return { approved: true, reason: 'OK' };
  }

  // ---------------- VIDEOS (STRICTLY ISOLATED FROM PROBLEMS) ----------------
  public getVideos(theme?: string, searchQuery?: string): VideoItem[] {
    let list = (this.data.videos || []).map((v) => ({ ...v }));
    if (theme && theme !== 'all') {
      list = list.filter((v) => v.theme === theme);
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.theme.toLowerCase().includes(q) ||
          v.authorName.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public async createVideo(
    user: User,
    input: {
      title: string;
      description: string;
      theme: VideoTheme;
      file: File;
    }
  ): Promise<{ success?: boolean; video?: VideoItem; error?: string }> {
    if (!user || user.role !== 'admin') {
      return { error: "Seul l'administrateur a la capacité de publier une vidéo depuis sa galerie." };
    }
    const title = input.title.trim();
    if (!title) {
      return { error: 'Le titre de la vidéo est obligatoire.' };
    }
    if (!input.file) {
      return { error: 'Veuillez sélectionner une vidéo depuis votre galerie.' };
    }

    const id = `vid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const mimeType = input.file.type || 'video/mp4';

    // Save locally in IndexedDB so playback is instant (0ms) and persists even on static Vercel deploy
    await saveVideoBlob(id, input.file);

    const video: VideoItem = {
      id,
      title,
      description: input.description.trim(),
      theme: input.theme,
      videoUrl: this.remoteSyncEnabled ? `/api/videos/${id}` : `idb://${id}`,
      hasLocalBlob: true,
      fileName: input.file.name,
      fileSize: formatFileSize(input.file.size),
      mimeType,
      authorId: user.id,
      authorName: user.username,
      createdAt: new Date().toISOString()
    };

    this.data.videos = [video, ...(this.data.videos || [])];
    this.save();
    this.pushRemoteAction('CREATE_VIDEO', { video }, user.id);

    // Upload binary stream in background if server sync is active
    if (this.remoteSyncEnabled) {
      fetch(`/api/videos/${id}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: input.file
      }).catch(() => {
        // Local IndexedDB playback still works seamlessly
      });
    }

    return { success: true, video: { ...video } };
  }

  public async updateVideo(
    user: User,
    id: string,
    updates: {
      title: string;
      description: string;
      theme: VideoTheme;
      file?: File | null;
    }
  ): Promise<{ success?: boolean; video?: VideoItem; error?: string }> {
    if (!user || user.role !== 'admin') {
      return { error: "Seul l'administrateur peut modifier les vidéos." };
    }
    const idx = (this.data.videos || []).findIndex((v) => v.id === id);
    if (idx === -1) return { error: 'Vidéo introuvable.' };

    const title = updates.title.trim();
    if (!title) return { error: 'Le titre de la vidéo est obligatoire.' };

    const existing = this.data.videos[idx];
    let videoUrl = existing.videoUrl;
    let fileName = existing.fileName;
    let fileSize = existing.fileSize;
    let mimeType = existing.mimeType;

    if (updates.file) {
      mimeType = updates.file.type || 'video/mp4';
      fileName = updates.file.name;
      fileSize = formatFileSize(updates.file.size);
      await saveVideoBlob(id, updates.file);
      videoUrl = this.remoteSyncEnabled ? `/api/videos/${id}?v=${Date.now()}` : `idb://${id}?v=${Date.now()}`;

      if (this.remoteSyncEnabled) {
        fetch(`/api/videos/${id}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': mimeType },
          body: updates.file
        }).catch(() => {});
      }
    }

    const updated: VideoItem = {
      ...existing,
      title,
      description: updates.description.trim(),
      theme: updates.theme,
      videoUrl,
      fileName,
      fileSize,
      mimeType,
      updatedAt: new Date().toISOString()
    };

    this.data.videos = this.data.videos.map((v, i) => (i === idx ? updated : v));
    this.save();
    this.pushRemoteAction('UPDATE_VIDEO', { video: updated }, user.id);
    return { success: true, video: { ...updated } };
  }

  public deleteVideo(user: User, id: string): { success?: boolean; error?: string } {
    if (!user || user.role !== 'admin') {
      return { error: "Seul l'administrateur peut supprimer des vidéos." };
    }
    const exists = (this.data.videos || []).some((v) => v.id === id);
    if (!exists) return { error: 'Vidéo introuvable.' };

    this.data.videos = (this.data.videos || []).filter((v) => v.id !== id);
    deleteVideoBlob(id).catch(() => {});
    this.save();
    this.pushRemoteAction('DELETE_VIDEO', { id }, user.id);
    return { success: true };
  }

  public async resolveVideoSource(video: VideoItem): Promise<string | null> {
    const localBlob = await getVideoBlob(video.id);
    if (localBlob) {
      return URL.createObjectURL(localBlob);
    }
    if (video.videoUrl && !video.videoUrl.startsWith('idb://')) {
      return video.videoUrl;
    }
    return null;
  }

  // ---------------- COURSES ----------------
  public getCourses(): Course[] {
    return this.data.courses || COURSES_DATA;
  }
}

export const store = new StoreService();
