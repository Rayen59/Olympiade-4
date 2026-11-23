import React, { useState, useEffect, useMemo } from 'react';
import { VideoItem, VideoTheme, User } from '../types';
import { OLYMPIAD_THEMES } from '../data/problemsData';
import { store } from '../services/store';
import { MathView } from './MathView';
import { VideoEditorModal } from './VideoEditorModal';
import {
  Video,
  Plus,
  Search,
  Edit3,
  Trash2,
  ShieldAlert,
  Clock,
  Film,
  X
} from 'lucide-react';

interface VideosViewProps {
  currentUser: User | null;
}

const VIDEO_THEMES: VideoTheme[] = [...OLYMPIAD_THEMES, 'Général'];

const VideoPlayerCard: React.FC<{
  video: VideoItem;
  isAdmin: boolean;
  onEdit: (v: VideoItem) => void;
  onDelete: (v: VideoItem) => void;
}> = ({ video, isAdmin, onEdit, onDelete }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [loadingSrc, setLoadingSrc] = useState(true);

  useEffect(() => {
    let active = true;
    let createdBlobUrl: string | null = null;
    setLoadingSrc(true);

    store.resolveVideoSource(video).then((src) => {
      if (!active) {
        if (src && src.startsWith('blob:')) URL.revokeObjectURL(src);
        return;
      }
      if (src && src.startsWith('blob:')) createdBlobUrl = src;
      setResolvedSrc(src);
      setLoadingSrc(false);
    });

    return () => {
      active = false;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [video.id, video.videoUrl, video.updatedAt]);

  const getThemeBadgeStyle = (theme: VideoTheme) => {
    switch (theme) {
      case 'Théorie des Nombres':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'Géométrie':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'Combinatoire':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'Inégalités':
        return 'bg-cyan-50 border-cyan-200 text-cyan-800';
      case 'Équations Fonctionnelles':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      default:
        return 'bg-blue-50 border-blue-200 text-[#0056b3]';
    }
  };

  return (
    <div className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between">
      <div>
        {/* Video Player Area */}
        <div className="bg-slate-950 aspect-video flex items-center justify-center relative overflow-hidden">
          {loadingSrc ? (
            <div className="text-slate-400 text-xs flex items-center gap-2">
              <Film className="w-4 h-4 animate-pulse" />
              <span>Chargement de la vidéo...</span>
            </div>
          ) : resolvedSrc ? (
            <video
              key={resolvedSrc}
              src={resolvedSrc}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="text-slate-400 text-xs text-center px-4">
              <Film className="w-7 h-7 mx-auto mb-1 opacity-50" />
              <p>Vidéo disponible uniquement sur l'appareil d'origine ou serveur connecté.</p>
            </div>
          )}
        </div>

        {/* Metadata & Content */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${getThemeBadgeStyle(video.theme)}`}>
              {video.theme}
            </span>
            {video.fileSize && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {video.fileSize}
              </span>
            )}
          </div>

          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
            <MathView content={video.title} />
          </h3>

          {video.description && (
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border-l-3 border-[#0056b3] leading-relaxed">
              <MathView content={video.description} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {new Date(video.updatedAt || video.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
          <span>•</span>
          <span className="font-semibold text-slate-700">{video.authorName}</span>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(video)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Modifier</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(video)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Supprimer</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const VideosView: React.FC<VideosViewProps> = ({ currentUser }) => {
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tick, setTick] = useState(0);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState<VideoItem | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);

  useEffect(() => {
    return store.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const videos = useMemo(() => {
    return store.getVideos(selectedTheme, searchQuery);
  }, [selectedTheme, searchQuery, tick]);

  const isAdmin = currentUser?.role === 'admin';

  const handleCreate = () => {
    setVideoToEdit(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (video: VideoItem) => {
    setVideoToEdit(video);
    setIsEditorOpen(true);
  };

  const handleConfirmDelete = () => {
    if (videoToDelete && currentUser) {
      store.deleteVideo(currentUser, videoToDelete.id);
      setVideoToDelete(null);
      setTick((t) => t + 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#0a3d75] flex items-center gap-2">
            <Video className="w-5 h-5 text-[#0056b3]" />
            <span>Vidéothèque Académique MK</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Cours et démonstrations en vidéo classés par thématique (strictement isolés de la banque de problèmes).
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une Vidéo (Galerie)</span>
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-[#0a3d75]">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-[#0056b3]" />
            <span>
              Mode Administrateur : Seul l'administrateur peut importer une vidéo depuis sa galerie, choisir son thème ou la modifier.
            </span>
          </div>
          <span className="font-bold text-[11px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full shrink-0">
            {videos.length} vidéo(s)
          </span>
        </div>
      )}

      {/* Search Box & Theme Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
        {/* Search Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une vidéo par titre, description ou thème..."
            className="w-full text-xs pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0056b3] focus:bg-white outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Effacer la recherche"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Theme Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">Thème :</span>
          <button
            type="button"
            onClick={() => setSelectedTheme('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
              selectedTheme === 'all'
                ? 'bg-[#0056b3] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tous
          </button>
          {VIDEO_THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => setSelectedTheme(theme)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                selectedTheme === theme
                  ? 'bg-[#0056b3] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {theme}
            </button>
          ))}

          <span className="ml-auto text-xs text-slate-400 font-mono">
            {videos.length} vidéo(s) affichée(s)
          </span>
        </div>
      </div>

      {/* Videos Grid */}
      {videos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 space-y-2">
          <Video className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-sm font-semibold">
            {searchQuery.trim() || selectedTheme !== 'all'
              ? 'Aucune vidéo ne correspond à votre recherche ou au thème sélectionné.'
              : 'Aucune vidéo partagée pour le moment.'}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={handleCreate}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0056b3] text-white text-xs font-bold rounded-lg hover:bg-[#0a3d75] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Partager une première vidéo depuis ma galerie</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((vid) => (
            <VideoPlayerCard
              key={vid.id}
              video={vid}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={(v) => setVideoToDelete(v)}
            />
          ))}
        </div>
      )}

      {/* Admin Video Upload / Edit Modal */}
      <VideoEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setVideoToEdit(null);
        }}
        currentUser={currentUser}
        videoToEdit={videoToEdit}
        defaultTheme={selectedTheme !== 'all' ? (selectedTheme as VideoTheme) : undefined}
        onSaved={() => setTick((t) => t + 1)}
      />

      {/* Delete Confirmation Modal */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-700 font-bold text-sm">
              <Trash2 className="w-5 h-5" />
              <span>Supprimer cette vidéo ?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Voulez-vous vraiment supprimer définitivement la vidéo <strong>« {videoToDelete.title} »</strong> ({videoToDelete.theme}) ?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVideoToDelete(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
