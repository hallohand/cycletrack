'use client';

import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface PDFExportButtonProps {
    cycles: any[]; // Ideally typed with the return of groupCycles
}

export function PDFExportButton({ cycles }: PDFExportButtonProps) {

    const handleExport = () => {
        try {
            const doc = new jsPDF();
            const dateStr = new Date().toLocaleDateString('de-DE');

            // Header
            doc.setFontSize(18);
            doc.text('CycleTrack - Zyklusbericht', 14, 20);

            doc.setFontSize(10);
            doc.text(`Erstellt am: ${dateStr}`, 14, 28);
            doc.text(`Anzahl Zyklen: ${cycles.length}`, 14, 33);

            // Prepare Table Data
            const tableData = cycles.map(c => {
                const ovuDay = c.days.find((d: any) => d.isOvulation);
                const isoStart = new Date(c.startDate).toLocaleDateString('de-DE');
                const isoEnd = c.endDate ? new Date(c.endDate).toLocaleDateString('de-DE') : 'Aktuell';

                let ovuDateStr = '-';
                let lutealStr = '-';

                if (ovuDay) {
                    ovuDateStr = new Date(ovuDay.date).toLocaleDateString('de-DE');

                    // Calculate Luteal Length (Days after ovulation until end)
                    // If cycle is finished
                    if (c.endDate) {
                        const ovuIndex = c.days.findIndex((d: any) => d.isOvulation);
                        if (ovuIndex !== -1) {
                            // Safer to use days.length
                            const len = c.days.length;
                            // Luteal phase = total length - (ovuIndex + 1)
                            // Example: Length 28. Ovu Index 13 (Day 14). Luteal = 28 - 14 = 14.
                            const lutealDays = len - (ovuIndex + 1);
                            if (lutealDays > 0) lutealStr = lutealDays + ' Tage';
                        }
                    }
                }

                return [
                    isoStart,
                    isoEnd,
                    c.days.length + ' Tage',
                    c.periodLength + ' Tage',
                    ovuDateStr,
                    lutealStr
                ];
            });

            // Add Table
            autoTable(doc, {
                startY: 40,
                head: [['Startdatum', 'Enddatum', 'Länge', 'Periode', 'Eisprung', 'Lutealphase']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [225, 29, 72] }, // Rose-600 color match
                styles: { fontSize: 9 },
            });

            // Footer
            const pageCount = (doc as any).internal.getNumberOfPages(); // Typed as any to bypass TS check on internal
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text(`Seite ${i} von ${pageCount}`, 196, 285, { align: 'right' });
                doc.text('Generiert mit CycleTrack', 14, 285);
            }

            doc.save(`cycletrack-bericht-${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('PDF Bericht erfolgreich erstellt');
        } catch (e) {
            console.error(e);
            toast.error('Fehler beim Erstellen des PDFs');
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <FileText className="w-4 h-4" />
            PDF Export
        </Button>
    );
}
