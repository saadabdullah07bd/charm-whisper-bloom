import React from 'react';
import { ExternalLink } from 'lucide-react';
import { type PatientReport } from '@/types/medical';
import ModalShell from '@/components/ModalShell';

interface Props {
  report: PatientReport | null;
  onClose: () => void;
}

const ReportPreviewModal: React.FC<Props> = ({ report, onClose }) => {
  if (!report) return null;

  const isPdf = report.fileType.includes('pdf') || report.name.toLowerCase().endsWith('.pdf');

  return (
    <ModalShell open={!!report} onClose={onClose} title={report.name} maxWidthClass="max-w-6xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Uploaded on {new Date(report.date).toLocaleString()}
          </p>
          <button
            type="button"
            onClick={async () => {
              window.open(report.dataUrl, '_blank', 'noopener,noreferrer');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground btn-press"
          >
            <ExternalLink size={14} /> Open
          </button>
        </div>

        {isPdf ? (
          <iframe
            src={report.dataUrl}
            title={report.name}
            className="h-[72vh] w-full rounded-xl border border-border bg-background"
          />
        ) : (
          <div className="rounded-xl border border-border bg-background p-3">
            <img
              src={report.dataUrl}
              alt={report.name}
              className="mx-auto max-h-[72vh] w-auto max-w-full object-contain"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default ReportPreviewModal;