import * as vscode from 'vscode';
import { SpotifyApi } from './spotifyApi';
import { SpotifyViewProvider } from './spotifyViewProvider';
import express = require('express');

let spotifyApi: SpotifyApi;
let spotifyViewProvider: SpotifyViewProvider;
let trackStatusBarItem: vscode.StatusBarItem;
let playPauseButton: vscode.StatusBarItem;
let prevButton: vscode.StatusBarItem;
let nextButton: vscode.StatusBarItem;
let pollTimer: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext) {
    spotifyApi = new SpotifyApi(context);
    await spotifyApi.initialize();

    // Register Webview Provider
    spotifyViewProvider = new SpotifyViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("spotify-view", spotifyViewProvider)
    );

    // Create Status Bar Items
    prevButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 103);
    prevButton.text = '$(chevron-left)';
    prevButton.tooltip = 'Previous Track';
    prevButton.command = 'spotify-vscode.previous';

    playPauseButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 102);
    playPauseButton.text = '$(play)';
    playPauseButton.tooltip = 'Play/Pause';
    playPauseButton.command = 'spotify-vscode.pause';

    nextButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
    nextButton.text = '$(chevron-right)';
    nextButton.tooltip = 'Next Track';
    nextButton.command = 'spotify-vscode.next';

    trackStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    trackStatusBarItem.tooltip = 'Currently Playing on Spotify';
    trackStatusBarItem.command = 'spotify-vscode.login';

    context.subscriptions.push(prevButton, playPauseButton, nextButton, trackStatusBarItem);

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('spotify-vscode.login', async () => {
            const app = express();
            const server = app.listen(8888, '127.0.0.1');

            app.get('/callback', async (req: express.Request, res: express.Response) => {
                const code = req.query.code as string;
                if (code) {
                    try {
                        await spotifyApi.handleCallback(vscode.Uri.parse(`http://127.0.0.1:8888/callback?code=${code}`));
                        res.send('<h1>Login realizado com sucesso!</h1><p>Pode fechar esta aba e voltar ao VS Code.</p>');
                        vscode.window.showInformationMessage('Spotify Login Successful!');
                        updateStatusBar();
                    } catch (err: any) {
                        res.status(500).send('<h1>Erro no Login</h1>');
                        vscode.window.showErrorMessage('Spotify Login Failed: ' + err.message);
                    } finally {
                        server.close();
                    }
                }
            });

            const url = await spotifyApi.getAuthUrl();
            vscode.env.openExternal(vscode.Uri.parse(url));
        }),
        vscode.commands.registerCommand('spotify-vscode.play', async () => {
            await spotifyApi.play();
            updateStatusBar();
        }),
        vscode.commands.registerCommand('spotify-vscode.pause', async () => {
            const track = await spotifyApi.getCurrentTrack();
            if (track?.isPlaying) {
                await spotifyApi.pause();
            } else {
                await spotifyApi.play();
            }
            updateStatusBar();
        }),
        vscode.commands.registerCommand('spotify-vscode.next', async () => {
            await spotifyApi.next();
            setTimeout(updateStatusBar, 500);
        }),
        vscode.commands.registerCommand('spotify-vscode.previous', async () => {
            await spotifyApi.previous();
            setTimeout(updateStatusBar, 500);
        }),
        vscode.commands.registerCommand('spotify-vscode.seek', async (positionMs: number) => {
            await spotifyApi.seek(positionMs);
            setTimeout(updateStatusBar, 500);
        })
    );

    updateStatusBar();
    pollTimer = setInterval(updateStatusBar, 5000);

    // Listener para mudanças na configuração
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('spotify-vscode.progressBarColor') || 
                e.affectsConfiguration('spotify-vscode.timebarStyle') ||
                e.affectsConfiguration('spotify-vscode.enableBlurBackground')) {
                spotifyViewProvider.updateConfig();
            }
        })
    );
}

async function updateStatusBar() {
    if (!spotifyApi.isAuthenticated()) {
        trackStatusBarItem.text = 'Spotify: Login';
        trackStatusBarItem.show();
        prevButton.hide();
        playPauseButton.hide();
        nextButton.hide();
        spotifyViewProvider.updateTrack(undefined);
        return;
    }

    const track = await spotifyApi.getCurrentTrack();
    spotifyViewProvider.updateTrack(track);

    if (track) {
        trackStatusBarItem.text = `$(note) ${track.name} - ${track.artist}`;
        playPauseButton.text = track.isPlaying ? '$(debug-pause)' : '$(play)';
        playPauseButton.command = track.isPlaying ? 'spotify-vscode.pause' : 'spotify-vscode.play';
        
        trackStatusBarItem.show();
        prevButton.show();
        playPauseButton.show();
        nextButton.show();
    } else {
        trackStatusBarItem.text = 'Spotify: No track playing';
        trackStatusBarItem.show();
        playPauseButton.text = '$(play)';
        playPauseButton.command = 'spotify-vscode.play';
        playPauseButton.show();
        prevButton.hide();
        nextButton.hide();
    }
}

export function deactivate() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
}
