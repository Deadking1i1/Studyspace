"use client";

import { useActionState, useEffect, useState, type CSSProperties } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { themeDefinitions, type ThemeActionState, type ThemeId } from "@/lib/themes";
import { applyThemeBrand } from "@/lib/client/theme-brand";

type ThemePickerProps = {
  action: (previousState: ThemeActionState, formData: FormData) => Promise<ThemeActionState>;
  csrfToken: string;
  initialTheme: ThemeId;
};

export function ThemePicker({ action, csrfToken, initialTheme }: ThemePickerProps) {
  const [previewTheme, setPreviewTheme] = useState(initialTheme);
  const initialState: ThemeActionState = {
    message: "",
    status: "idle",
    theme: initialTheme,
  };
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "saved") setPreviewTheme(state.theme);
  }, [state]);

  function applyPreview(theme: ThemeId) {
    setPreviewTheme(theme);
    document.querySelector<HTMLElement>(".app-shell")?.setAttribute("data-theme", theme);
    applyThemeBrand(theme);
    const profileTheme = document.querySelector<HTMLInputElement>('input[data-profile-theme="true"]');
    if (profileTheme) profileTheme.value = theme;
  }

  return (
    <section className="appearance-panel" aria-labelledby="appearance-heading">
      <div className="appearance-heading-row">
        <div>
          <h3 id="appearance-heading">Study environment</h3>
          <p className="muted">Choose the atmosphere that helps you settle in and focus.</p>
        </div>
        <span className="theme-save-status" aria-live="polite">
          {pending ? <><LoaderCircle className="theme-spinner" size={15} aria-hidden="true" /> Saving</> : state.message}
        </span>
      </div>

      <form action={formAction}>
        <input name="csrf_token" type="hidden" value={csrfToken} />
        <div className="theme-picker-grid" aria-label="Study environment themes">
          {themeDefinitions.map((theme) => {
            const selected = previewTheme === theme.id;
            return (
              <button
                aria-pressed={selected}
                className={`theme-choice${selected ? " selected" : ""}`}
                key={theme.id}
                name="theme"
                onClick={() => applyPreview(theme.id)}
                style={{ "--theme-thumbnail": `url(${theme.image})` } as CSSProperties}
                type="submit"
                value={theme.id}
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
      </form>
    </section>
  );
}
