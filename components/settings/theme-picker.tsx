"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { themeDefinitions, type ThemeId } from "@/lib/themes";
import { useStudyTheme } from "@/components/shell/theme-shell";

type ThemePickerProps = {
  csrfToken: string;
  initialTheme: ThemeId;
};

export function ThemePicker({ csrfToken, initialTheme }: ThemePickerProps) {
  const { theme: previewTheme, setTheme: setPreviewTheme } = useStudyTheme();
  const [message, setMessage] = useState("");
  const [savingTheme, setSavingTheme] = useState<ThemeId | null>(null);
  const lastSavedTheme = useRef(initialTheme);
  const latestSelection = useRef(initialTheme);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    const profileTheme = document.querySelector<HTMLInputElement>('input[data-profile-theme="true"]');
    if (profileTheme) profileTheme.value = previewTheme;
  }, [previewTheme]);

  function selectTheme(theme: ThemeId) {
    latestSelection.current = theme;
    setPreviewTheme(theme);
    setSavingTheme(theme);
    setMessage("");

    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const response = await fetch("/api/settings/theme", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ theme }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string; theme?: ThemeId };
        if (!response.ok) throw new Error(result.error || "Could not save theme.");
        lastSavedTheme.current = result.theme ?? theme;
        if (latestSelection.current === theme) setMessage("Saved");
      } catch (error) {
        if (latestSelection.current === theme) {
          setPreviewTheme(lastSavedTheme.current);
          setMessage(error instanceof Error ? error.message : "Could not save theme.");
        }
      } finally {
        if (latestSelection.current === theme) setSavingTheme(null);
      }
    });
  }

  return (
    <section className="appearance-panel" aria-labelledby="appearance-heading">
      <div className="appearance-heading-row">
        <div>
          <h3 id="appearance-heading">Study environment</h3>
          <p className="muted">Choose the atmosphere that helps you settle in and focus.</p>
        </div>
        <span aria-atomic="true" className="theme-save-status" role="status">
          {savingTheme ? <><LoaderCircle className="theme-spinner" size={15} aria-hidden="true" /> Saving</> : message}
        </span>
      </div>

      <div>
        <div aria-labelledby="appearance-heading" className="theme-picker-grid" role="group">
          {themeDefinitions.map((theme) => {
            const selected = previewTheme === theme.id;
            return (
              <button
                aria-pressed={selected}
                className={`theme-choice${selected ? " selected" : ""}`}
                key={theme.id}
                onClick={() => selectTheme(theme.id)}
                style={{ "--theme-thumbnail": `url(${theme.image})` } as CSSProperties}
                type="button"
              >
                <span className="theme-choice-image" aria-hidden="true" />
                <span className="theme-choice-copy">
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </span>
                <span className="theme-choice-check" aria-hidden="true">
                  {selected ? <Check size={14} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
