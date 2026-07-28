window.onSpotifyWebPlaybackSDKReady = () => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
    const messageNode = document.querySelector("[data-spotify-message]");
    const deviceNode = document.querySelector("[data-spotify-device]");
    const trackNode = document.querySelector("[data-spotify-track]");
    const artistNode = document.querySelector("[data-spotify-artist]");
    const coverImageNode = document.querySelector("[data-spotify-cover-img]");
    let deviceId = null;

    function setMessage(message) {
        if (messageNode) {
            messageNode.textContent = message;
        }
    }

    async function fetchToken(callback) {
        try {
            const response = await fetch("/integrations/spotify/token");
            if (!response.ok) {
                throw new Error("Reconnect Spotify to continue playback.");
            }
            const data = await response.json();
            callback(data.access_token);
        } catch (error) {
            setMessage(error.message);
        }
    }

    const player = new Spotify.Player({
        name: "Study Space Focus Player",
        getOAuthToken: fetchToken,
        volume: 0.5
    });

    player.addListener("ready", ({ device_id }) => {
        deviceId = device_id;
        if (deviceNode) {
            deviceNode.textContent = "Browser player ready";
        }
        setMessage("Spotify is ready. Transfer playback to this browser when you want in-app controls.");
    });

    player.addListener("not_ready", () => {
        if (deviceNode) {
            deviceNode.textContent = "Browser player offline";
        }
        setMessage("Spotify playback device went offline. Refresh this page to reconnect.");
    });

    player.addListener("initialization_error", ({ message }) => setMessage(message));
    player.addListener("authentication_error", ({ message }) => setMessage(message));
    player.addListener("account_error", ({ message }) => setMessage(`${message} Spotify Premium is required for playback.`));
    player.addListener("playback_error", ({ message }) => setMessage(message));

    player.addListener("player_state_changed", (state) => {
        if (!state || !state.track_window || !state.track_window.current_track) {
            return;
        }
        const track = state.track_window.current_track;
        if (trackNode) {
            trackNode.textContent = track.name || "Unknown track";
        }
        if (artistNode) {
            artistNode.textContent = (track.artists || []).map((artist) => artist.name).join(", ") || "Spotify";
        }
        const image = track.album?.images?.[0]?.url;
        if (coverImageNode && image) {
            coverImageNode.src = image;
            coverImageNode.hidden = false;
        }
    });

    async function transferPlayback() {
        if (!deviceId) {
            setMessage("Spotify browser device is not ready yet.");
            return;
        }
        try {
            const response = await fetch("/integrations/spotify/transfer", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken
                },
                body: JSON.stringify({ device_id: deviceId })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Unable to transfer playback.");
            }
            setMessage("Playback transferred to Study Space.");
        } catch (error) {
            setMessage(error.message);
        }
    }

    document.querySelectorAll("[data-spotify-action]").forEach((button) => {
        button.addEventListener("click", async () => {
            const action = button.dataset.spotifyAction;
            if (action === "previous") {
                await player.previousTrack();
            } else if (action === "toggle") {
                await player.togglePlay();
            } else if (action === "next") {
                await player.nextTrack();
            } else if (action === "transfer") {
                await transferPlayback();
            }
        });
    });

    player.connect().then((connected) => {
        if (!connected) {
            setMessage("Spotify could not create a browser player.");
        }
    });
};
