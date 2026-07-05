"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { refundReportAction, rejectReportAction, type Report } from "@/actions/admin";
import { Button, Card, ErrorText } from "@/components/ui";

export function ReportsList({ reports }: { reports: Report[] }) {
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();

  const refund = (id: string) =>
    start(async () => {
      setError(undefined);
      const r = await refundReportAction(id);
      if (r?.error) return setError(r.error);
      setResolved((s) => ({ ...s, [id]: "reembolsado" }));
    });

  const reject = (id: string) =>
    start(async () => {
      await rejectReportAction(id);
      setResolved((s) => ({ ...s, [id]: "rejeitado" }));
    });

  return (
    <div className="space-y-3">
      <ErrorText>{error}</ErrorText>
      {reports.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            {r.finalUrl && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={r.finalUrl} muted playsInline preload="metadata" className="h-28 w-16 shrink-0 rounded-lg bg-black object-cover" />
            )}
            <div className="min-w-0">
              <Link href={`/videos/${r.videoId}`} className="font-medium hover:text-accent">
                {r.title ?? "Vídeo"}
              </Link>
              <p className="text-xs text-muted">{r.userEmail} · cobrado {r.chargedCredits} créditos</p>
              <p className="mt-1 max-w-lg text-sm text-muted">"{r.reason}"</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {resolved[r.id] ? (
              <span className="text-sm text-accent">{resolved[r.id]}</span>
            ) : (
              <>
                <Button onClick={() => refund(r.id)} disabled={pending}>
                  Reembolsar {r.chargedCredits}
                </Button>
                <Button variant="ghost" onClick={() => reject(r.id)} disabled={pending}>
                  Rejeitar
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
