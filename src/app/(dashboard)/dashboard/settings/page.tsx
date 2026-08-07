import { prisma } from "@/lib/prisma";
import { updateSettings } from "@/actions/settings";
import ImageUploadForm from "./ImageUploadForm";

export const dynamic = "force-dynamic";

function textField(label: string, name: string, defaultValue: string | null | undefined, type = "text") {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}

export default async function SettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  const defaultTipAmounts = (settings?.defaultTipAmountsCents ?? [500, 1000, 2000])
    .map((c) => (c / 100).toString())
    .join(", ");

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-foreground-muted">Profile, social links, and branding.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <h2 className="text-sm font-medium">Photo &amp; Logo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
          <ImageUploadForm field="photoUrl" label="Profile Photo" currentUrl={settings?.photoUrl ?? null} />
          <ImageUploadForm field="logoUrl" label="Logo" currentUrl={settings?.logoUrl ?? null} />
        </div>
      </div>

      <form action={updateSettings} className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <h2 className="text-sm font-medium">Profile</h2>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="bio">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            defaultValue={settings?.bio ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <h2 className="text-sm font-medium pt-2">Social Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {textField("Instagram", "instagramUrl", settings?.instagramUrl)}
          {textField("Facebook", "facebookUrl", settings?.facebookUrl)}
          {textField("TikTok", "tiktokUrl", settings?.tiktokUrl)}
          {textField("YouTube", "youtubeUrl", settings?.youtubeUrl)}
          {textField("Spotify", "spotifyUrl", settings?.spotifyUrl)}
          {textField("Website", "websiteUrl", settings?.websiteUrl)}
          {textField("Contact Email", "contactEmail", settings?.contactEmail, "email")}
        </div>

        <h2 className="text-sm font-medium pt-2">Tipping</h2>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="defaultTipAmounts">
            Default tip amounts ($, comma-separated)
          </label>
          <input
            id="defaultTipAmounts"
            name="defaultTipAmounts"
            type="text"
            defaultValue={defaultTipAmounts}
            placeholder="5, 10, 20"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <h2 className="text-sm font-medium pt-2">Brand Colours</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="brandPrimaryColor">
              Primary (buttons, accents)
            </label>
            <input
              id="brandPrimaryColor"
              name="brandPrimaryColor"
              type="color"
              defaultValue={settings?.brandPrimaryColor ?? "#7c3aed"}
              className="h-10 w-full rounded-lg border border-border bg-background"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="brandSecondaryColor">
              Secondary (tip highlights)
            </label>
            <input
              id="brandSecondaryColor"
              name="brandSecondaryColor"
              type="color"
              defaultValue={settings?.brandSecondaryColor ?? "#f59e0b"}
              className="h-10 w-full rounded-lg border border-border bg-background"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
}
