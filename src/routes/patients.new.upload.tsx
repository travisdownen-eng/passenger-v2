import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/patients/new/upload")({
  head: () => ({ meta: [{ title: "Upload Referral · Passenger" }] }),
  component: UploadReferralPage,
});

function UploadReferralPage() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="p-6 lg:p-8 max-w-3xl w-full mx-auto">
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="size-4" /> Back to patients
      </Link>
      <h1 className="text-2xl font-display font-semibold mb-1">Upload Referral</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload a referral document. Passenger will extract patient data and create the chart
        automatically.
      </p>

      <div className="surface-card p-8">
        <label
          htmlFor="referral-file"
          className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg py-14 px-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
        >
          <div className="size-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-3">
            <Upload className="size-5" />
          </div>
          <div className="font-medium">
            {file ? file.name : "Drop referral PDF here or click to browse"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            PDF, DOCX, or scanned image · up to 25MB
          </div>
          <input
            id="referral-file"
            type="file"
            className="hidden"
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-6 flex items-start gap-3 p-4 rounded-md bg-info/10 border border-info/20 text-sm">
          <FileText className="size-4 text-info mt-0.5 shrink-0" />
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Referral intelligence is coming soon.</span>{" "}
            For now, upload captures the document; the AI extraction pipeline will populate the
            chart automatically when that module ships.
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-border">
          <Button asChild variant="ghost">
            <Link to="/patients">Cancel</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/patients/new/manual">Create manually instead</Link>
          </Button>
          <Button disabled={!file}>Upload & extract</Button>
        </div>
      </div>
    </div>
  );
}
