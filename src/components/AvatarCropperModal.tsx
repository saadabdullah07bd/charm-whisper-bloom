import React, { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

interface AvatarCropperModalProps {
  imageSrc: string;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
}

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const size = Math.min(512, Math.round(area.width));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to crop'))),
      'image/jpeg',
      0.9,
    );
  });
}

const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({ imageSrc, onCancel, onSave }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const handleSave = async () => {
    if (!area) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, area);
      await onSave(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border/30 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
          <h3 className="text-sm font-semibold">Adjust your photo</h3>
          <button onClick={onCancel} disabled={saving} className="p-1.5 rounded-lg hover:bg-muted/50 btn-press disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="relative w-full h-72 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <ZoomOut size={16} className="text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <ZoomIn size={16} className="text-muted-foreground" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 text-sm font-medium py-2.5 rounded-xl border border-border/40 hover:bg-muted/40 btn-press disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !area}
              className="flex-1 text-sm font-medium py-2.5 rounded-xl text-primary-foreground btn-press disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'hsl(var(--primary))' }}
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropperModal;
