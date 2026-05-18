import { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PrescriptionFile {
  id: string;
  file_path: string;
  file_name: string;
  mime_type?: string | null;
  notes?: string | null;
  created_at: string;
}

interface Props {
  patientId: string;
  visitId?: string | null;
  files: PrescriptionFile[];
  onChange: () => void;
  readOnly?: boolean;
}

export default function PrescriptionUpload({ patientId, visitId, files, onChange, readOnly }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 15 MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${patientId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('prescriptions')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: userData } = await supabase.auth.getUser();
      const { error: insErr } = await supabase
        .from('prescription_files')
        .insert({
          patient_id: patientId,
          visit_id: visitId ?? null,
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          uploaded_by: userData.user?.id,
        });
      if (insErr) throw insErr;

      // Auto-complete the most recent awaiting_prescription appointment for this patient
      try {
        const { data: apt } = await supabase
          .from('appointments')
          .select('id')
          .eq('patient_id', patientId)
          .in('status', ['awaiting_prescription', 'in_call'])
          .order('appointment_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (apt?.id) {
          await supabase
            .from('appointments')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', apt.id);
        }
      } catch (e) {
        console.warn('Could not auto-complete appointment:', e);
      }

      toast({ title: 'Prescription uploaded' });
      onChange();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async (f: PrescriptionFile) => {
    const { data, error } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(f.file_path, 60 * 60);
    if (error || !data) {
      toast({ title: 'Cannot open file', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (f: PrescriptionFile) => {
    if (!confirm(`Delete ${f.file_name}?`)) return;
    await supabase.storage.from('prescriptions').remove([f.file_path]);
    await supabase.from('prescription_files').delete().eq('id', f.id);
    onChange();
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-border/50 rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all duration-200 btn-press disabled:opacity-50"
          >
            {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
            <span className="text-sm font-medium">
              {uploading ? 'Uploading…' : 'Upload prescription PDF or image'}
            </span>
            <span className="text-xs">PDF, PNG, JPG (max 15 MB)</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={handleUpload}
            className="hidden"
          />
        </>
      )}

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No prescription files yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 border border-border/50 rounded-xl p-3 bg-card/50"
            >
              <FileText size={20} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(f.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDownload(f)}
                className="p-2 rounded-lg hover:bg-foreground/5 btn-press"
                aria-label="Download"
              >
                <Download size={16} />
              </button>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(f)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive btn-press"
                  aria-label="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
