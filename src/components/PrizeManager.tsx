/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent, DragEvent, FormEvent } from 'react';
import { Prize } from '../types';
import { Plus, Trash2, Edit3, ArrowUp, ArrowDown, Upload, X, Check, RefreshCw } from 'lucide-react';

const PRESET_COLORS = [
  '#FF6B6B', // Neon Coral
  '#FFD93D', // Yellow/Gold
  '#6BCB77', // Emerald Green
  '#4D96FF', // Sky Blue
  '#C77DFF', // Pastel Violet
  '#FF9A3C', // Solar Orange
  '#00C9A7', // Teal Coast
  '#FF6EC7'  // Pink Cyber
];

interface PrizeManagerProps {
  prizes: Prize[];
  onAddPrize: (prize: Omit<Prize, 'id'>) => void;
  onUpdatePrize: (id: string, updated: Partial<Prize>) => void;
  onDeletePrize: (id: string) => void;
  onReorderPrizes: (newPrizes: Prize[]) => void;
  onResetToDefault: () => void;
  onClearAll: () => void;
}

export function PrizeManager({
  prizes,
  onAddPrize,
  onUpdatePrize,
  onDeletePrize,
  onReorderPrizes,
  onResetToDefault,
  onClearAll,
}: PrizeManagerProps) {
  // Form values
  const [name, setName] = useState('');
  const [uploadedImageB64, setUploadedImageB64] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);

  // File drag tracking
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read upload file helper
  const processFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Tolong unggah file gambar saja (PNG, JPG, JPEG, WEBP, GIF)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImageB64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Submit prize add or update
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      // Perform inline update
      onUpdatePrize(editingId, {
        name: name.trim(),
        image: uploadedImageB64,
        color: selectedColor,
      });
      setEditingId(null);
    } else {
      // Add new
      onAddPrize({
        name: name.trim(),
        image: uploadedImageB64,
        color: selectedColor,
      });
    }

    // Reset fields
    setName('');
    setUploadedImageB64('');
    // Alternate standard color helper
    setSelectedColor(PRESET_COLORS[(prizes.length + 1) % PRESET_COLORS.length]);
  };

  // Set individual item into Edit formulation State
  const startEditing = (prize: Prize) => {
    setEditingId(prize.id);
    setName(prize.name);
    setUploadedImageB64(prize.image);
    setSelectedColor(prize.color);

    // Scroll to form smoothly
    const managerHeader = document.getElementById('prize-form-section');
    managerHeader?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setName('');
    setUploadedImageB64('');
    setSelectedColor(PRESET_COLORS[prizes.length % PRESET_COLORS.length]);
  };

  // Reordering helpers
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= prizes.length) return;

    const listCopy = [...prizes];
    const item = listCopy[index];
    listCopy[index] = listCopy[nextIdx];
    listCopy[nextIdx] = item;

    onReorderPrizes(listCopy);
  };

  return (
    <div className="flex flex-col gap-6" id="prize-manager-panel">
      
      {/* 1. Reset / Seed Quick Controls row */}
      <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
        <h3 className="font-display text-lg font-bold text-yellow-400">
          ⚙️ Kelola Hadiah ({prizes.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onResetToDefault}
            className="flex items-center gap-1 text-xs bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-500/30 px-2.5 py-1.5 rounded-lg font-sans transition-all duration-200"
            title="Muat Ulang Hadiah Bawaan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Default</span>
          </button>
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-500/30 px-2.5 py-1.5 rounded-lg font-sans transition-all duration-200"
            title="Hapus Semua Hadiah"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kosongkan</span>
          </button>
        </div>
      </div>

      {/* 2. Drag & Drop Upload Form & Add fields */}
      <form
        id="prize-form-section"
        onSubmit={handleSubmit}
        className="bg-[#151326] p-4 rounded-xl border border-white/5 flex flex-col gap-4 relative shadow-lg"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-purple-400 uppercase font-sans">
            {editingId ? '✏️ Ubah Detail Hadiah' : '🎁 Tambah Hadiah Baru'}
          </span>
          {editingId && (
            <button
              type="button"
              onClick={cancelEditing}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Batal
            </button>
          )}
        </div>

        {/* Input Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-300 font-sans">
            Nama Hadiah <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Voucher Belanja, Smartwatch ⌚"
            className="w-full bg-[#0F0F1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-sans transition-all"
          />
        </div>

        {/* Drag and Drop File Upload Wrapper */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-300 font-sans">Gambar Hadiah (Opsional, tapi direkomendasikan)</label>
          
          <div
            id="drag-and-drop-container"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`cursor-pointer border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-center transition-all ${
              uploadedImageB64
                ? 'border-emerald-500/40 bg-emerald-950/10'
                : dragActive
                ? 'border-purple-400 bg-purple-950/20 shadow-[inset_0_0_12px_rgba(147,51,234,0.1)]'
                : 'border-white/10 bg-[#0F0F1A] hover:border-purple-500/40 hover:bg-purple-950/10'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpg, image/jpeg, image/webp, image/gif"
              className="hidden"
            />

            {uploadedImageB64 ? (
              <div className="flex items-center justify-between w-full h-12 px-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 bg-black rounded-lg border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    <img
                      src={uploadedImageB64}
                      alt="Thumbnail Preview"
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-emerald-400 font-semibold font-sans">Gambar Terpasang ✔️</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[150px] font-sans">Siap untuk roda putar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedImageB64('');
                  }}
                  className="p-1 px-2 text-xs bg-red-950 text-red-400 border border-red-900/40 rounded hover:bg-red-900/20 font-sans transition-colors"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-slate-400" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-slate-300 font-semibold font-sans">
                    Tarik file ke sini, atau <span className="text-purple-400 underline">pilih file</span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-sans">PNG, JPG, JPEG, WEBP, atau GIF</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Color presets selection indicator */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-300 font-sans">Warna Segmen Roda</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setSelectedColor(hex)}
                style={{ backgroundColor: hex }}
                className={`w-6 h-6 rounded-full cursor-pointer ring-offset-2 ring-offset-[#151326] transition-all relative ${
                  selectedColor === hex ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                }`}
                aria-label={`Pilih warna ${hex}`}
              >
                {selectedColor === hex && (
                  <Check className="w-3.5 h-3.5 text-[#0F0F1A] absolute inset-0 m-auto font-bold" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Submit action panel */}
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 w-full font-display font-semibold text-sm py-2.5 rounded-lg cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_4px_16px_rgba(124,58,237,0.5)] transition-all"
        >
          {editingId ? (
            <>
              <Check className="w-4 h-4" /> Simpan Perubahan
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Simpan ke Roda
            </>
          )}
        </button>
      </form>

      {/* 3. Prizes Card-List view */}
      <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
        {prizes.length === 0 ? (
          <div className="text-center py-8 bg-[#151326]/30 border border-dashed border-white/10 rounded-xl">
            <GiftContainerPlaceholder />
            <p className="text-xs text-slate-400 mt-2 font-sans">Roda kosong. Tambahkan hadiah di atas!</p>
          </div>
        ) : (
          prizes.map((p, idx) => (
            <div
              key={p.id}
              className="group flex items-center justify-between p-2.5 bg-[#121021]/80 hover:bg-[#151326] border border-white/5 rounded-xl transition-all duration-200"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Visual Accent representation of wedge color + image representation */}
                <div
                  style={{ borderColor: p.color }}
                  className="relative w-11 h-11 rounded-lg border-2 overflow-hidden flex-shrink-0 bg-black flex items-center justify-center flex-shrink-0"
                >
                  <img
                    src={p.image}
                    alt={p.name}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="text-left overflow-hidden">
                  <h4 className="text-xs font-semibold text-white font-sans truncate">{p.name}</h4>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-[10px] text-slate-400 font-mono">
                      Segmen {idx + 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* Functional Controls block (Up/Down reordering and Edit/Delete triggers) */}
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                {/* Reordering */}
                <button
                  type="button"
                  onClick={() => moveItem(idx, 'up')}
                  disabled={idx === 0}
                  className={`p-1.5 rounded bg-slate-900/40 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors ${
                    idx === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title="Naikkan Posisi"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 'down')}
                  disabled={idx === prizes.length - 1}
                  className={`p-1.5 rounded bg-slate-900/40 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors ${
                    idx === prizes.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title="Turunkan Posisi"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>

                {/* Edit inline */}
                <button
                  type="button"
                  onClick={() => startEditing(p)}
                  className="p-1.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:text-white hover:bg-yellow-500/20 cursor-pointer transition-all"
                  title="Ubah Nama/Gambar"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                {/* Delete inline */}
                <button
                  type="button"
                  onClick={() => onDeletePrize(p.id)}
                  className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500/20 cursor-pointer transition-all"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Inline gift logo SVG container
function GiftContainerPlaceholder() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-8 h-8 mx-auto text-slate-500 opacity-60"
    >
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 15h16" />
      <path d="M4 15V9a5 5 0 0 1 10 0v6" />
    </svg>
  );
}
