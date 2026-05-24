import * as vscode from 'vscode';
import { SpotifyTrack } from './spotifyApi';

export class SpotifyViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'play': vscode.commands.executeCommand('spotify-vscode.play'); break;
                case 'pause': vscode.commands.executeCommand('spotify-vscode.pause'); break;
                case 'next': vscode.commands.executeCommand('spotify-vscode.next'); break;
                case 'previous': vscode.commands.executeCommand('spotify-vscode.previous'); break;
                case 'seek': vscode.commands.executeCommand('spotify-vscode.seek', data.value); break;
            }
        });
    }

    public updateTrack(track: SpotifyTrack | undefined) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'update', track });
        }
    }

    public updateConfig() {
        if (this._view) {
            const config = vscode.workspace.getConfiguration('spotify-vscode');
            this._view.webview.postMessage({ 
                type: 'updateConfig', 
                color: config.get('progressBarColor'),
                style: config.get('timebarStyle'),
                enableBlur: config.get('enableBlurBackground')
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const config = vscode.workspace.getConfiguration('spotify-vscode');
        const barColor = config.get('progressBarColor', 'var(--vscode-button-background)');
        const timebarStyle = config.get('timebarStyle', 'standard');
        const enableBlur = config.get('enableBlurBackground', false);

        // URI para o CSS do Codicon
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${codiconsUri}" rel="stylesheet" />
                <style>
                    body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 20px;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        --bar-color: ${barColor};
                        overflow: hidden;
                        height: 100vh;
                        position: relative;
                        background: transparent;
                    }
                    #bg-blur {
                        position: fixed;
                        top: -20px;
                        left: -20px;
                        right: -20px;
                        bottom: -20px;
                        background-size: cover;
                        background-position: center;
                        filter: blur(30px) brightness(0.4);
                        z-index: -1;
                        display: ${enableBlur ? 'block' : 'none'};
                        transition: background-image 0.5s ease-in-out;
                    }
                    .album-art {
                        width: 100%;
                        max-width: 250px;
                        aspect-ratio: 1/1;
                        background-color: #333;
                        border-radius: 8px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                        margin-bottom: 20px;
                        background-size: cover;
                        background-position: center;
                        position: relative;
                        z-index: 1;
                    }
                    .track-info {
                        text-align: center;
                        margin-bottom: 10px;
                        position: relative;
                        z-index: 1;
                    }
                    .track-name {
                        font-size: 1.2em;
                        font-weight: bold;
                        margin-bottom: 5px;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    }
                    .artist-name {
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 10px;
                    }
                    .progress-container {
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 15px;
                        position: relative;
                        z-index: 1;
                    }
                    .progress-bar-wrapper {
                        width: 100%;
                        height: 20px;
                        position: relative;
                        display: flex;
                        align-items: center;
                    }
                    .progress-bar {
                        width: 100%;
                        height: 6px;
                        -webkit-appearance: none;
                        background: var(--vscode-button-secondaryBackground);
                        outline: none;
                        margin: 0;
                        transition: height 0.2s;
                    }
                    
                    /* Estilo Onda */
                    body.style-wave .progress-bar {
                        height: 20px;
                        -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' preserveAspectRatio='none'%3E%3Cpath d='M0 10 Q 5 0 10 10 T 20 10 L 20 13 Q 15 23 10 13 T 0 13 Z' fill='black'/%3E%3C/svg%3E");
                        mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' preserveAspectRatio='none'%3E%3Cpath d='M0 10 Q 5 0 10 10 T 20 10 L 20 13 Q 15 23 10 13 T 0 13 Z' fill='black'/%3E%3C/svg%3E");
                        -webkit-mask-size: 30px 100%;
                        mask-size: 30px 100%;
                        -webkit-mask-repeat: repeat-x;
                        mask-repeat: repeat-x;
                        border-radius: 0;
                        background-size: 100% 100%;
                    }
                    
                    body.style-wave .progress-bar::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        width: 20px;
                        height: 20px;
                        background: transparent;
                        cursor: pointer;
                    }

                    /* Estilo Padrão */
                    body.style-standard .progress-bar {
                        height: 6px;
                        border-radius: 3px;
                    }
                    body.style-standard .progress-bar::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        width: 14px;
                        height: 14px;
                        background: var(--bar-color);
                        border-radius: 50%;
                        cursor: pointer;
                        border: 2px solid var(--vscode-sideBar-background);
                        box-shadow: 0 0 5px rgba(0,0,0,0.5);
                        position: relative;
                        z-index: 2;
                    }

                    .progress-bar:focus {
                        outline: none;
                    }
                    
                    .time-info {
                        display: flex;
                        justify-content: space-between;
                        width: 100%;
                        font-size: 0.85em;
                        color: var(--vscode-descriptionForeground);
                    }
                    .controls {
                        display: flex;
                        gap: 20px;
                        align-items: center;
                        position: relative;
                        z-index: 1;
                    }
                    .control-btn {
                        background: none;
                        border: none;
                        color: var(--vscode-foreground);
                        cursor: pointer;
                        padding: 10px;
                        border-radius: 50%;
                        transition: background 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .control-btn .codicon {
                        font-size: 24px;
                    }
                    .control-btn:hover {
                        background-color: var(--vscode-toolbar-hoverBackground);
                    }
                    .play-pause {
                        background: none;
                    }
                    .play-pause .codicon {
                        font-size: 32px;
                    }
                    .play-pause:hover {
                        background: none;
                        color: var(--vscode-button-background);
                        transform: scale(1.1);
                    }
                </style>
            </head>
            <body class="style-${timebarStyle}">
                <div id="bg-blur"></div>
                <div id="art" class="album-art"></div>
                <div class="track-info">
                    <div id="name" class="track-name">Spotify: Login</div>
                    <div id="artist" class="artist-name">Click the status bar to connect</div>
                </div>

                <div class="progress-container">
                    <div class="progress-bar-wrapper">
                        <input type="range" id="progress" class="progress-bar" min="0" value="0" step="1" 
                            onmousedown="isSeeking = true" 
                            onmouseup="seek(this.value)"
                            oninput="updateTimeLabel(this.value)">
                    </div>
                    <div class="time-info">
                        <span id="current-time">0:00</span>
                        <span id="total-time">0:00</span>
                    </div>
                </div>

                <div class="controls">
                    <button class="control-btn" onclick="vscode.postMessage({type:'previous'})">
                        <i class="codicon codicon-chevron-left"></i>
                    </button>
                    <button id="playPause" class="control-btn play-pause" onclick="togglePlay()">
                        <i id="playPauseIcon" class="codicon codicon-play"></i>
                    </button>
                    <button class="control-btn" onclick="vscode.postMessage({type:'next'})">
                        <i class="codicon codicon-chevron-right"></i>
                    </button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let isPlaying = false;
                    let currentProgress = 0;
                    let duration = 0;
                    let progressInterval;
                    let isSeeking = false;

                    function formatTime(ms) {
                        const seconds = Math.floor((ms / 1000) % 60);
                        const minutes = Math.floor((ms / (1000 * 60)) % 60);
                        return \`\${minutes}:\${seconds < 10 ? '0' : ''}\${seconds}\`;
                    }

                    function togglePlay() {
                        vscode.postMessage({ type: isPlaying ? 'pause' : 'play' });
                    }

                    function seek(value) {
                        isSeeking = true;
                        vscode.postMessage({ type: 'seek', value: parseInt(value) });
                    }

                    function updateTimeLabel(value) {
                        const percent = (value / duration) * 100;
                        const progressEl = document.getElementById('progress');
                        progressEl.style.background = \`linear-gradient(to right, var(--bar-color) 0%, var(--bar-color) \${percent}%, var(--vscode-button-secondaryBackground) \${percent}%, var(--vscode-button-secondaryBackground) 100%)\`;
                        document.getElementById('current-time').textContent = formatTime(value);
                    }

                    function startTimer() {
                        clearInterval(progressInterval);
                        if (isPlaying && !isSeeking) {
                            progressInterval = setInterval(() => {
                                if (!isSeeking && currentProgress < duration) {
                                    currentProgress += 1000;
                                    updateProgressUI();
                                }
                            }, 1000);
                        }
                    }

                    function updateProgressUI() {
                        if (isSeeking) return;
                        const progressEl = document.getElementById('progress');
                        progressEl.max = duration;
                        progressEl.value = currentProgress;
                        
                        const percent = duration > 0 ? (currentProgress / duration) * 100 : 0;
                        progressEl.style.background = \`linear-gradient(to right, var(--bar-color) 0%, var(--bar-color) \${percent}%, var(--vscode-button-secondaryBackground) \${percent}%, var(--vscode-button-secondaryBackground) 100%)\`;
                        
                        document.getElementById('current-time').textContent = formatTime(currentProgress);
                        document.getElementById('total-time').textContent = formatTime(duration);
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'update') {
                            const track = message.track;
                            if (track) {
                                isSeeking = false;
                                document.getElementById('name').textContent = track.name;
                                document.getElementById('artist').textContent = track.artist;
                                document.getElementById('art').style.backgroundImage = \`url(\${track.albumArt})\`;
                                document.getElementById('bg-blur').style.backgroundImage = \`url(\${track.albumArt})\`;
                                isPlaying = track.isPlaying;
                                currentProgress = track.progressMs || 0;
                                duration = track.durationMs || 0;
                                
                                const icon = document.getElementById('playPauseIcon');
                                icon.className = 'codicon ' + (isPlaying ? 'codicon-debug-pause' : 'codicon-play');
                                
                                updateProgressUI();
                                startTimer();
                            } else {
                                document.getElementById('name').textContent = 'No track playing';
                                document.getElementById('artist').textContent = '';
                                document.getElementById('art').style.backgroundImage = '';
                                document.getElementById('bg-blur').style.backgroundImage = '';
                                document.getElementById('playPauseIcon').className = 'codicon codicon-play';
                                isPlaying = false;
                                updateProgressUI();
                                clearInterval(progressInterval);
                            }
                        } else if (message.type === 'updateConfig') {
                            if (message.color) document.body.style.setProperty('--bar-color', message.color);
                            if (message.style) {
                                document.body.classList.remove('style-standard', 'style-wave');
                                document.body.classList.add('style-' + message.style);
                            }
                            if (message.enableBlur !== undefined) {
                                document.getElementById('bg-blur').style.display = message.enableBlur ? 'block' : 'none';
                            }
                            updateProgressUI();
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
