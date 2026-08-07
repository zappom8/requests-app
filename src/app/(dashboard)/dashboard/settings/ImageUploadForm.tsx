"use client";

import { useState } from "react";
import { uploadBrandingImage, removeBrandingImage } from "@/actions/settings";

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
  const [removing, setRemoving] = useState(false);
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

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("field", field);
      await removeBrandingImage(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      {currentUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt={label} className="h-20 w-20 rounded-lg object-cover border border-border" />
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="rounded-lg border border-danger/50 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      )}
      <form action={handleSubmit} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="field" value={field} />
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          required
          className="min-w-0 text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-foreground"
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
