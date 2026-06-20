import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { patientReferralsQuery } from "@/lib/queries";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/patients/$id/upload")({
  head: () => ({ meta: [{ title: "Documents · Passenger" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(patientReferralsQuery(params.id)),
  component: PatientUploadPage,
});

function PatientUploadPage() {
  const { id } = Route.useParams();
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <section className="surface-card p-6">
        <h2 className="text-sm font-semibold mb-3">Upload source document</h2>
        <label
          htmlFor="file"
          className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg py-10 px-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
        >
          <div className="size-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-2">
            <Upload className="size-4" />
          </div>
          <div className="text-sm font-medium">
            {file ? file.name : "Drop file or click to browse"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">PDF, DOCX, image · up to 25MB</div>
          <input
            id="file"
            type="file"
            className="hidden"
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="flex justify-end gap-2 mt-4">
          <Button asChild variant="ghost">
            <Link to="/patients/$id" params={{ id }}>
              Back
            </Link>
          </Button>
          <Button disabled={!file}>Upload</Button>
        </div>
      </section>

      <Suspense fallback={null}>
        <DocsList id={id} />
      </Suspense>
    </div>
  );
}

function DocsList({ id }: { id: string }) {
  const { data: referrals } = useSuspenseQuery(patientReferralsQuery(id));
  return (
    <section className="surface-card p-6">
      <h2 className="text-sm font-semibold mb-3">On file ({referrals.length})</h2>
      {referrals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents uploaded.</p>
      ) : (
        <ul className="divide-y divide-border">
          {referrals.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <div className="size-9 rounded-md bg-accent text-accent-foreground flex items-center justify-center">
                <FileText className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(r.upload_date)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
