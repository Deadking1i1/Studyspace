const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

document.getElementById("particles").appendChild(canvas);

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

animate();

window.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const editorContent = document.getElementById('editor-content');
    const editorForm = document.getElementById('editor-form');
    const toolbarButtons = document.querySelectorAll('.editor-toolbar button[data-command]');

    toolbarButtons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command;
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