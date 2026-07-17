const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const reduceMotion = document.body?.classList.contains("reduce-motion")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const particleRoot = document.getElementById("particles");
if (particleRoot && !reduceMotion) {
    particleRoot.appendChild(canvas);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let particles = [];
for (let i = 0; i < 80; i++) {
    particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.3 + 0.7,
        speed: Math.random() * 0.6 + 0.2
    });
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(56, 189, 248, 0.18)";

    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y -= p.speed;
        if (p.y < -10) {
            p.y = canvas.height + 10;
            p.x = Math.random() * canvas.width;
        }
    });

    requestAnimationFrame(animate);
}

if (!reduceMotion) {
    animate();
}

const focusSessionMinutes = 25;
let timerSecondsRemaining = focusSessionMinutes * 60;
let timerIntervalId = null;
let elapsedSessionSeconds = 0;

function renderTimer() {
    const display = document.getElementById("timer-display");
    if (!display) {
        return;
    }

    const minutes = Math.floor(timerSecondsRemaining / 60).toString().padStart(2, "0");
    const seconds = (timerSecondsRemaining % 60).toString().padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;
}

function setTimerMessage(message) {
    const messageNode = document.getElementById("timer-message");
    if (messageNode) {
        messageNode.textContent = message;
    }
}

function startTimer() {
    if (timerIntervalId) {
        return;
    }

    setTimerMessage("Focus session running.");
    timerIntervalId = window.setInterval(() => {
        if (timerSecondsRemaining <= 0) {
            pauseTimer();
            setTimerMessage("Session complete. Save it to add it to your study history.");
            return;
        }

        timerSecondsRemaining -= 1;
        elapsedSessionSeconds += 1;
        renderTimer();
    }, 1000);
}

function pauseTimer() {
    if (timerIntervalId) {
        window.clearInterval(timerIntervalId);
        timerIntervalId = null;
        setTimerMessage("Session paused.");
    }
}

function resetTimer() {
    pauseTimer();
    timerSecondsRemaining = focusSessionMinutes * 60;
    elapsedSessionSeconds = 0;
    renderTimer();
    setTimerMessage("");
}

async function saveTimerSession() {
    pauseTimer();
    const elapsedMinutes = Math.max(1, Math.round(elapsedSessionSeconds / 60));
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    if (elapsedSessionSeconds < 30) {
        setTimerMessage("Study for at least 30 seconds before saving a session.");
        return;
    }

    try {
        const response = await fetch("/study-sessions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken || ""
            },
            body: JSON.stringify({ duration_minutes: elapsedMinutes })
        });

        if (!response.ok) {
            throw new Error("Unable to save study session.");
        }

        resetTimer();
        setTimerMessage(`Saved ${elapsedMinutes} minute study session.`);
    } catch (error) {
        setTimerMessage(error.message);
    }
}

renderTimer();

window.addEventListener('DOMContentLoaded', () => {
    const timerButtons = document.querySelectorAll("[data-timer-action]");
    timerButtons.forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.timerAction;
            if (action === "start") {
                startTimer();
            } else if (action === "pause") {
                pauseTimer();
            } else if (action === "reset") {
                resetTimer();
            } else if (action === "save") {
                saveTimerSession();
            }
        });
    });

    const editor = document.getElementById('editor');
    const editorContent = document.getElementById('editor-content');
    const editorForm = document.getElementById('editor-form');
    const toolbarButtons = document.querySelectorAll('.editor-toolbar button[data-command]');

    toolbarButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command;
            if (!editor) {
                return;
            }
            document.execCommand(command, false, null);
            editor.focus();
        });
    });

    if (editorForm) {
        editorForm.addEventListener('submit', () => {
            if (editorContent) {
                editorContent.value = editor.innerHTML;
            }
        });
    }
});
