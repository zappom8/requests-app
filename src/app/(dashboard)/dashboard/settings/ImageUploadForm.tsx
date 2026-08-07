"use client";

import { useState } from "react";
import { uploadBrandingImage } from "@/actions/settings";

export default function ImageUploadForm({
  field,
  label,
  currentUrl,
}: {
  field: "photoUrl" | "logoUrl";
  label: string;
  currentUrl: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      await uploadBrandingImage(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      {currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt={label} className="h-20 w-20 rounded-lg object-cover border border-border" />
      )}
      <form action={handleSubmit} className="flex items-center gap-2">
        <input type="hidden" name="field" value={field} />
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          className="text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent disabled:opacity-50"
        >
          {submitting ? "Uploading…" : "Upload"}
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
