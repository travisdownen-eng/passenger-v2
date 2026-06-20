import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/patients/new/manual")({
  head: () => ({ meta: [{ title: "New Patient · Passenger" }] }),
  component: ManualPatientPage,
});

function ManualPatientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      first_name: String(fd.get("first_name") || "").trim(),
      last_name: String(fd.get("last_name") || "").trim(),
      dob: (fd.get("dob") as string) || null,
      mrn: (fd.get("mrn") as string) || null,
      referral_date:
        (fd.get("referral_date") as string) ||
        new Date().toISOString().slice(0, 10),
      primary_diagnosis: (fd.get("primary_diagnosis") as string) || null,
      hospitalization_reason: (fd.get("hospitalization_reason") as string) || null,
      home_health_reason: (fd.get("home_health_reason") as string) || null,
    };
    if (!payload.first_name || !payload.last_name) {
      toast.error("First and last name are required");
      setSaving(false);
      return;
    }
    const { data, error } = await supabase
      .from("patients")
      .insert(payload)
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create patient");
      return;
    }
    qc.invalidateQueries({ queryKey: ["patients"] });
    toast.success("Patient created");
    navigate({ to: "/patients/$id", params: { id: data.id } });
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl w-full mx-auto">
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="size-4" /> Back to patients
      </Link>
      <h1 className="text-2xl font-display font-semibold mb-1">New Patient</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Create a patient manually. You can upload a referral document afterward.
      </p>
      <form onSubmit={handleSubmit} className="surface-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name" name="first_name" required />
          <Field label="Last name" name="last_name" required />
          <Field label="Date of birth" name="dob" type="date" />
          <Field label="MRN" name="mrn" placeholder="MRN-000000" />
          <Field label="Referral date" name="referral_date" type="date" />
          <Field label="Primary diagnosis" name="primary_diagnosis" />
        </div>
        <TextAreaField
          label="Hospitalization reason"
          name="hospitalization_reason"
          placeholder="Reason for recent hospitalization"
        />
        <TextAreaField
          label="Home health reason"
          name="home_health_reason"
          placeholder="Why home health was ordered"
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button asChild variant="ghost" type="button">
            <Link to="/patients">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} placeholder={placeholder} rows={3} />
    </div>
  );
}
