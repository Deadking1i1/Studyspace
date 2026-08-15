"use client";

import { useEffect, useMemo, useState } from "react";

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function StudyTimer({
  csrfToken,
  saveAction,
  subjects = [],
  topics = [],
}: Readonly<{
  csrfToken: string;
  saveAction: (formData: FormData) => Promise<void>;
  subjects?: { id: number; name: string }[];
  topics?: { id: number; subjectId: number; name: string }[];
}>) {
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [savedMinutes, setSavedMinutes] = useState(25);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setIsRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const progress = useMemo(() => {
    const total = duration * 60;
    if (!total) return 0;
    return Math.round(((total - secondsLeft) / total) * 100);
  }, [duration, secondsLeft]);

  function resetTimer(nextDuration = duration) {
    setIsRunning(false);
    setDuration(nextDuration);
    setSecondsLeft(nextDuration * 60);
    setSavedMinutes(nextDuration);
  }

  function syncCompletedMinutes() {
    const completedMinutes = Math.max(1, Math.round((duration * 60 - secondsLeft) / 60));
    setSavedMinutes(completedMinutes);
  }

  return (
    <section className="card timer-workspace">
      <div className="timer-display" aria-live="polite">{formatSeconds(secondsLeft)}</div>
      <div className="timer-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="form-grid-2">
        <label className="grid">
          <span>Session length</span>
          <input
            min={1}
            max={720}
            onChange={(event) => resetTimer(Math.min(Math.max(Number(event.target.value || 25), 1), 720))}
            type="number"
            value={duration}
          />
        </label>
        <label className="grid">
          <span>Minutes to save</span>
          <input
            min={1}
            max={720}
            onChange={(event) => setSavedMinutes(Math.min(Math.max(Number(event.target.value || 1), 1), 720))}
            type="number"
            value={savedMinutes}
          />
        </label>
      </div>
      <div className="inline-actions">
        <button className="button" onClick={() => setIsRunning(true)} type="button">Start</button>
        <button className="button secondary" onClick={() => setIsRunning(false)} type="button">Pause</button>
        <button className="button secondary" onClick={() => resetTimer()} type="button">Reset</button>
        <form action={saveAction}>
          <input name="csrf_token" type="hidden" value={csrfToken} />
          <input name="duration_minutes" type="hidden" value={savedMinutes} />
          {subjects.length ? (
            <div className="timer-academic-fields">
              <label className="grid">
                <span>Subject studied</span>
                <select name="subject_id">
                  <option value="">General session</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>
              <label className="grid">
                <span>Topic</span>
                <select name="topic_id">
                  <option value="">No topic</option>
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          <button className="button secondary" onClick={syncCompletedMinutes} type="submit">Save session</button>
        </form>
      </div>
    </section>
  );
}
