"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

type SpotifyPlayer = {
  addListener: (event: string, callback: (payload: any) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  previousTrack: () => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  setVolume?: (volume: number) => Promise<void>;
};

type TrackState = {
  track: string;
  artist: string;
  cover: string;
};

type Playlist = {
  id: string;
  name: string;
  uri: string;
  trackCount: number;
  image: string;
  owner: string;
};

type PlaybackDevice = {
  active: boolean;
  id: string;
  name: string;
  privateSession: boolean;
  type: string;
  volumePercent: number | null;
};

type SearchTrack = {
  id: string;
  name: string;
  uri: string;
  artist: string;
  image: string;
};

type SearchPayload = {
  tracks?: SearchTrack[];
  playlists?: Playlist[];
  error?: string;
};

type RepeatMode = "off" | "context" | "track";

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function SpotifyPlayerShell({ csrfToken }: Readonly<{ csrfToken: string }>) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string>("");
  const [message, setMessage] = useState("Creating browser player...");
  const [device, setDevice] = useState("Browser player pending");
  const [devices, setDevices] = useState<PlaybackDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [isPaused, setIsPaused] = useState(true);
  const [track, setTrack] = useState<TrackState>({ track: "Waiting for Spotify...", artist: "Open Spotify on another device or transfer playback here.", cover: "" });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistUri, setSelectedPlaylistUri] = useState("");
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [volume, setVolume] = useState(50);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTracks, setSearchTracks] = useState<SearchTrack[]>([]);
  const [searchPlaylists, setSearchPlaylists] = useState<Playlist[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  async function loadDevices() {
    setDevicesLoading(true);
    try {
      const response = await fetch("/integrations/spotify/devices", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Spotify devices.");
      const loadedDevices = Array.isArray(data.devices) ? data.devices as PlaybackDevice[] : [];
      setDevices(loadedDevices);
      setSelectedDeviceId((current) => current || loadedDevices.find((candidate) => candidate.active)?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Spotify devices.");
    } finally {
      setDevicesLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchToken(callback: (token: string) => void) {
      try {
        const response = await fetch("/integrations/spotify/token", { cache: "no-store" });
        if (!response.ok) throw new Error("Reconnect Spotify to continue playback.");
        const data = await response.json();
        callback(data.access_token);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to fetch Spotify token.");
      }
    }

    function initializePlayer() {
      if (cancelled || !window.Spotify || playerRef.current) return;
      const player = new window.Spotify.Player({
        name: "Study Space Focus Player",
        getOAuthToken: fetchToken,
        volume: 0.5,
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id;
        setSelectedDeviceId((current) => current || device_id);
        setDevice("Browser player ready");
        setMessage("Spotify is ready. Transfer playback to this browser when you want in-app controls.");
        void loadDevices();
      });
      player.addListener("not_ready", () => {
        setDevice("Browser player offline");
        setMessage("Spotify playback device went offline. Refresh this page to reconnect.");
      });
      player.addListener("initialization_error", ({ message: spotifyMessage }: { message: string }) => setMessage(spotifyMessage));
      player.addListener("authentication_error", ({ message: spotifyMessage }: { message: string }) => setMessage(spotifyMessage));
      player.addListener("account_error", ({ message: spotifyMessage }: { message: string }) => setMessage(`${spotifyMessage} Spotify Premium is required for playback.`));
      player.addListener("playback_error", ({ message: spotifyMessage }: { message: string }) => setMessage(spotifyMessage));
      player.addListener("player_state_changed", (state: any) => {
        const currentTrack = state?.track_window?.current_track;
        if (!currentTrack) return;
        setTrack({
          track: currentTrack.name || "Unknown track",
          artist: (currentTrack.artists || []).map((artist: { name: string }) => artist.name).join(", ") || "Spotify",
          cover: currentTrack.album?.images?.[0]?.url || "",
        });
        setProgressMs(Number(state.position) || 0);
        setDurationMs(Number(currentTrack.duration_ms) || 0);
        setIsPaused(Boolean(state.paused));
      });
      void player.connect().then((connected) => {
        if (!connected) setMessage("Spotify could not create a browser player.");
      });
    }

    if (window.Spotify) initializePlayer();
    else {
      window.onSpotifyWebPlaybackSDKReady = initializePlayer;
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPlaylists() {
      setPlaylistsLoading(true);
      try {
        const response = await fetch("/integrations/spotify/playlists", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load playlists.");
        if (cancelled) return;
        const loadedPlaylists = Array.isArray(data.playlists) ? data.playlists : [];
        setPlaylists(loadedPlaylists);
        setSelectedPlaylistUri(loadedPlaylists[0]?.uri || "");
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load playlists.");
      } finally {
        if (!cancelled) setPlaylistsLoading(false);
      }
    }
    void loadPlaylists();
    void loadDevices();
    return () => {
      cancelled = true;
    };
  }, []);

  async function transferPlayback(targetDeviceId = deviceIdRef.current) {
    if (!targetDeviceId) {
      setMessage("Spotify browser device is not ready yet.");
      return;
    }
    try {
      const response = await fetch("/integrations/spotify/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({ device_id: targetDeviceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to transfer playback.");
      setSelectedDeviceId(targetDeviceId);
      setMessage("Playback transferred to the selected device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to transfer playback.");
    }
  }

  async function playPlaylist(playlistUri: string) {
    if (!playlistUri) {
      setMessage("Select a playlist first.");
      return;
    }
    try {
      const response = await fetch("/integrations/spotify/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          context_uri: playlistUri,
          device_id: selectedDeviceId || deviceIdRef.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start playlist.");
      setMessage("Playlist started in Study Space.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start playlist.");
    }
  }

  async function playSelectedPlaylist() {
    await playPlaylist(selectedPlaylistUri);
  }

  async function postControl(payload: Record<string, unknown>, successMessage: string) {
    try {
      const response = await fetch("/integrations/spotify/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          ...payload,
          device_id: selectedDeviceId || deviceIdRef.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Spotify control failed.");
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Spotify control failed.");
      return false;
    }
  }

  async function toggleShuffle() {
    const nextShuffle = !shuffle;
    setShuffle(nextShuffle);
    await postControl({ action: "shuffle", state: nextShuffle }, nextShuffle ? "Shuffle enabled." : "Shuffle disabled.");
  }

  async function updateRepeat(nextRepeatMode: RepeatMode) {
    setRepeatMode(nextRepeatMode);
    const label = nextRepeatMode === "context" ? "playlist" : nextRepeatMode;
    await postControl({ action: "repeat", state: nextRepeatMode }, `Repeat set to ${label}.`);
  }

  async function seekTo(nextProgressMs: number) {
    setProgressMs(nextProgressMs);
    await postControl({ action: "seek", position_ms: nextProgressMs }, "Track position updated.");
  }

  async function updateVolume(nextVolume: number) {
    setVolume(nextVolume);
    try {
      await playerRef.current?.setVolume?.(nextVolume / 100);
      await postControl({ action: "volume", volume_percent: nextVolume }, "Volume updated.");
    } catch {
      setMessage("Unable to update browser player volume.");
    }
  }

  async function changeTrack(action: "previous" | "next") {
    await postControl({ action }, action === "previous" ? "Previous track selected." : "Next track selected.");
  }

  async function togglePlayback() {
    const nextPaused = !isPaused;
    const applied = await postControl({ action: nextPaused ? "pause" : "resume" }, nextPaused ? "Playback paused." : "Playback resumed.");
    if (applied) setIsPaused(nextPaused);
  }

  async function searchSpotify() {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setMessage("Search needs at least 2 characters.");
      return;
    }
    setSearchLoading(true);
    try {
      const response = await fetch(`/integrations/spotify/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = await response.json() as SearchPayload;
      if (!response.ok) throw new Error(data.error || "Unable to search Spotify.");
      setSearchTracks(data.tracks || []);
      setSearchPlaylists(data.playlists || []);
      setMessage("Spotify search complete.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to search Spotify.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function playTrack(uri: string) {
    try {
      const response = await fetch("/integrations/spotify/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({
          uris: [uri],
          device_id: selectedDeviceId || deviceIdRef.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to play track.");
      setMessage("Track started in Study Space.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to play track.");
    }
  }

  async function queueTrack(uri: string) {
    await postControl({ action: "queue", uri }, "Track added to queue.");
  }

  const filteredPlaylists = playlists.filter((playlist) => {
    const query = playlistQuery.trim().toLowerCase();
    if (!query) return true;
    return `${playlist.name} ${playlist.owner}`.toLowerCase().includes(query);
  });
  const selectedPlaylist = playlists.find((playlist) => playlist.uri === selectedPlaylistUri);

  return (
    <div className="spotify-player-shell">
      <div className="spotify-now-playing">
        <div className="spotify-cover">{track.cover ? <img src={track.cover} alt="" /> : <span>SS</span>}</div>
        <div>
          <p className="eyebrow">Now playing</p>
          <h3>{track.track}</h3>
          <p className="muted">{track.artist}</p>
        </div>
      </div>
      <div className="inline-actions" aria-label="Spotify playback controls">
        <button className="button secondary" onClick={() => void changeTrack("previous")} type="button">Previous</button>
        <button className="button" onClick={() => void togglePlayback()} type="button">{isPaused ? "Play" : "Pause"}</button>
        <button className="button secondary" onClick={() => void changeTrack("next")} type="button">Next</button>
      </div>
      <div className="spotify-advanced-controls">
        <button className={`button secondary ${shuffle ? "active-control" : ""}`} onClick={() => void toggleShuffle()} type="button">
          Shuffle {shuffle ? "On" : "Off"}
        </button>
        <div className="segmented-controls" aria-label="Spotify repeat mode">
          <button className={`segmented-button ${repeatMode === "off" ? "active" : ""}`} onClick={() => void updateRepeat("off")} type="button">Repeat off</button>
          <button className={`segmented-button ${repeatMode === "context" ? "active" : ""}`} onClick={() => void updateRepeat("context")} type="button">Repeat playlist</button>
          <button className={`segmented-button ${repeatMode === "track" ? "active" : ""}`} onClick={() => void updateRepeat("track")} type="button">Repeat track</button>
        </div>
      </div>
      <label className="grid">
        <span>Track position</span>
        <input
          disabled={durationMs <= 0}
          max={Math.max(durationMs, 1)}
          min={0}
          onChange={(event) => setProgressMs(Number(event.target.value))}
          onMouseUp={(event) => void seekTo(Number(event.currentTarget.value))}
          onTouchEnd={(event) => void seekTo(Number(event.currentTarget.value))}
          type="range"
          value={Math.min(progressMs, Math.max(durationMs, 1))}
        />
        <span className="muted">{formatDuration(progressMs)} / {formatDuration(durationMs)}</span>
      </label>
      <div className="spotify-device-row">
        <label className="grid">
          <span>Playback device</span>
          <select disabled={devicesLoading} onChange={(event) => setSelectedDeviceId(event.target.value)} value={selectedDeviceId}>
            <option value="">Use Spotify&apos;s active device</option>
            {devices.map((playbackDevice) => (
              <option key={playbackDevice.id} value={playbackDevice.id}>
                {playbackDevice.name} ({playbackDevice.type}){playbackDevice.active ? " - active" : ""}
              </option>
            ))}
            {deviceIdRef.current && !devices.some((playbackDevice) => playbackDevice.id === deviceIdRef.current) ? (
              <option value={deviceIdRef.current}>Study Space browser player</option>
            ) : null}
          </select>
        </label>
        <button className="button secondary" disabled={devicesLoading} onClick={() => void loadDevices()} type="button">
          {devicesLoading ? "Checking..." : "Refresh devices"}
        </button>
      </div>
      <div className="spotify-control-grid">
        <div className="grid">
          <span className="form-label">Selected playlist</span>
          <div className="spotify-selected-playlist">
            {selectedPlaylist ? `${selectedPlaylist.name} - ${selectedPlaylist.trackCount} tracks` : (playlistsLoading ? "Loading playlists..." : "No playlist selected")}
          </div>
        </div>
        <button className="button" disabled={!selectedPlaylistUri} onClick={() => void playSelectedPlaylist()} type="button">Play playlist</button>
      </div>
      <label className="grid">
        <span>Search your playlists</span>
        <input
          onChange={(event) => setPlaylistQuery(event.target.value)}
          placeholder="Filter library playlists..."
          type="search"
          value={playlistQuery}
        />
      </label>
      <div className="spotify-playlist-grid">
        {filteredPlaylists.slice(0, 12).map((playlist) => (
          <button
            className={`spotify-playlist-tile ${selectedPlaylistUri === playlist.uri ? "active" : ""}`}
            key={playlist.id}
            onClick={() => setSelectedPlaylistUri(playlist.uri)}
            type="button"
          >
            <span className="spotify-playlist-cover">
              {playlist.image ? <img alt="" src={playlist.image} /> : "SS"}
            </span>
            <span>
              <strong>{playlist.name}</strong>
              <small>{playlist.owner} - {playlist.trackCount} tracks</small>
            </span>
          </button>
        ))}
      </div>
      <div className="spotify-search-panel">
        <div className="spotify-search-row">
          <label className="grid">
            <span>Search Spotify</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void searchSpotify();
              }}
              placeholder="Songs, artists, albums, playlists..."
              type="search"
              value={searchQuery}
            />
          </label>
          <button className="button" disabled={searchLoading} onClick={() => void searchSpotify()} type="button">
            {searchLoading ? "Searching..." : "Search"}
          </button>
        </div>
        <div className="spotify-results-grid">
          <section className="spotify-result-list" aria-label="Spotify track search results">
            <h4>Tracks</h4>
            {searchTracks.length === 0 ? <p className="muted">No tracks searched yet.</p> : null}
            {searchTracks.map((result) => (
              <div className="spotify-result-row" key={result.id}>
                <span className="spotify-playlist-cover">{result.image ? <img alt="" src={result.image} /> : "SS"}</span>
                <span className="spotify-result-main">
                  <strong>{result.name}</strong>
                  <small>{result.artist}</small>
                </span>
                <span className="inline-actions compact-actions">
                  <button className="button secondary" onClick={() => void queueTrack(result.uri)} type="button">Queue</button>
                  <button className="button" onClick={() => void playTrack(result.uri)} type="button">Play</button>
                </span>
              </div>
            ))}
          </section>
          <section className="spotify-result-list" aria-label="Spotify playlist search results">
            <h4>Playlists</h4>
            {searchPlaylists.length === 0 ? <p className="muted">No playlists searched yet.</p> : null}
            {searchPlaylists.map((result) => (
              <div className="spotify-result-row" key={result.id}>
                <span className="spotify-playlist-cover">{result.image ? <img alt="" src={result.image} /> : "SS"}</span>
                <span className="spotify-result-main">
                  <strong>{result.name}</strong>
                  <small>{result.owner} - {result.trackCount} tracks</small>
                </span>
                <span className="inline-actions compact-actions">
                  <button className="button secondary" onClick={() => setSelectedPlaylistUri(result.uri)} type="button">Select</button>
                  <button className="button" onClick={() => {
                    setSelectedPlaylistUri(result.uri);
                    void playPlaylist(result.uri);
                  }} type="button">Play</button>
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
      <label className="grid">
        <span>Volume</span>
        <input
          max={100}
          min={0}
          onChange={(event) => void updateVolume(Number(event.target.value))}
          type="range"
          value={volume}
        />
      </label>
      <div className="item-row compact">
        <span className="muted">{device}</span>
        <button className="button secondary" onClick={() => void transferPlayback()} type="button">Use this browser</button>
      </div>
      <p className="notice">{message}</p>
    </div>
  );
}
