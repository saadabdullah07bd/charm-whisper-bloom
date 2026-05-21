import React from 'react';
import { ExternalLink } from 'lucide-react';
import { type PatientReport } from '@/types/medical';
import ModalShell from '@/components/ModalShell';
import InAppPdfViewer from '@/components/InAppPdfViewer';
import ZoomableImage from '@/components/ZoomableImage';

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
          <a
            href={report.dataUrl}
            download={report.name}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground btn-press"
          >
            <ExternalLink size={14} /> Download
          </a>
        </div>

        {isPdf ? (
          <div className="h-[72vh] w-full rounded-xl border border-border bg-background overflow-hidden">
            <InAppPdfViewer url={report.dataUrl} fileName={report.name} />
          </div>
        ) : (
          <div className="h-[72vh] w-full rounded-xl border border-border bg-background overflow-hidden">
            <ZoomableImage src={report.dataUrl} alt={report.name} />
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default ReportPreviewModal;
