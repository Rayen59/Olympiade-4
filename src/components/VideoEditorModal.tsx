import React, { useState, useEffect } from 'react';
import { VideoItem, VideoTheme, User } from '../types';
import { OLYMPIAD_THEMES } from '../data/problemsData';
import { store } from '../services/store';
import { formatFileSize } from '../services/mediaUtils';
import { X, Video, Upload, Edit3, PlusCircle, AlertTriangle, Smartphone, Film } from 'lucide-react';

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  videoToEdit: VideoItem | null;
  defaultTheme?: VideoTheme;
  onSaved: () => void;
}

const VIDEO_THEMES: VideoTheme[] = [...OLYMPIAD_THEMES, 'Général'];

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  videoToEdit,
  defaultTheme,
  onSaved
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<VideoTheme>(defaultTheme || 'Théorie des Nombres');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let activeObjectUrl: string | null = null;
    if (isOpen) {
      if (videoToEdit) {
        setTitle(videoToEdit.title);
        setDescription(videoToEdit.description || '');
        setTheme(videoToEdit.theme);
        setSelectedFile(null);
        setPreviewUrl(null);
        store.resolveVideoSource(videoToEdit).then((src) => {
          if (src) {
            if (src.startsWith('blob:')) activeObjectUrl = src;
            setPreviewUrl(src);
          }
        });
      } else {
        setTitle('');
        setDescription('');
        setTheme(defaultTheme || 'Théorie des Nombres');
        setSelectedFile(null);
        setPreviewUrl(null);
      }
      setError(null);
      setIsSaving(false);
    }
    return () => {
      if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    };
  }, [isOpen, videoToEdit, defaultTheme]);

  if (!isOpen || !currentUser || currentUser.role !== 'admin') return null;

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|mkv|avi|3gp)$/i.test(file.name)) {
      setError('Veuillez sélectionner un fichier vidéo valide depuis votre galerie.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      setTitle(cleanName);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Veuillez saisir un titre pour la vidéo.');
      return;
    }

    if (!videoToEdit && !selectedFile) {
      setError('Veuillez choisir une vidéo depuis votre galerie (PC ou Android).');
      return;
    }

    setIsSaving(true);
    try {
      if (videoToEdit) {
        const res = await store.updateVideo(currentUser, videoToEdit.id, {
          title,
          description,
          theme,
          file: selectedFile
        });
        if (res.error) {
          setError(res.error);
          setIsSaving(false);
          return;
        }
      } else if (selectedFile) {
        const res = await store.createVideo(currentUser, {
          title,
          description,
          theme,
          file: selectedFile
        });
        if (res.error) {
          setError(res.error);
          setIsSaving(false);
          return;
        }
      }

      onSaved();
      onClose();
    } catch {
      setError('Erreur lors de l’enregistrement de la vidéo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-linear-to-r from-[#0a3d75] to-[#0056b3] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {videoToEdit ? (
              <Edit3 className="w-5 h-5 text-amber-300" />
            ) : (
              <Video className="w-5 h-5 text-emerald-300" />
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {videoToEdit ? 'Modifier la Vidéo' : 'Partager une Vidéo (Galerie Admin)'}
              </h2>
              <p className="text-xs text-blue-100">
                Section Vidéos isolée des Problèmes • Accès administrateur exclusif
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Theme Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Thème de la Vidéo <span className="text-rose-500">*</span>
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as VideoTheme)}
              className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0056b3] outline-hidden"
            >
              {VIDEO_THEMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Cette vidéo apparaîtra uniquement dans la section <strong>Vidéos</strong> sous le thème sélectionné (jamais dans les Problèmes).
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Titre de la Vidéo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Introduction aux Valuations p-adiques (LTE)..."
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0056b3] outline-hidden font-medium"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description / Notes (LaTeX $...$ supporté)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Démonstration vidéo du lemme LTE pour $v_p(x^n - y^n)$ et applications..."
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0056b3] outline-hidden leading-relaxed"
            />
          </div>

          {/* Gallery Video Picker */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Film className="w-4 h-4 text-[#0056b3]" />
                {videoToEdit ? 'Remplacer la vidéo depuis votre galerie (optionnel)' : 'Sélectionner la vidéo depuis votre galerie *'}
              </label>
              {selectedFile && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </span>
              )}
            </div>

            <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl p-4 bg-white text-center transition">
              <input
                type="file"
                id="admin-video-gallery-input"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
              />
              <label
                htmlFor="admin-video-gallery-input"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0056b3] hover:bg-[#0a3d75] text-white font-bold rounded-lg shadow-xs cursor-pointer text-xs transition"
              >
                <Smartphone className="w-4 h-4" />
                <Upload className="w-3.5 h-3.5" />
                <span>Choisir une Vidéo depuis ma Galerie (PC / Android)</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Formats supportés : MP4, WebM, MOV, M4V • Lecture directe dans le navigateur
              </p>
            </div>

            {previewUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#0056b3] hover:bg-[#0a3d75] rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              {videoToEdit ? <Edit3 className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
              <span>{isSaving ? 'Publication...' : videoToEdit ? 'Enregistrer les Modifications' : 'Publier la Vidéo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
