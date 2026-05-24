import * as vscode from 'vscode';
import axios from 'axios';
import * as crypto from 'crypto';
import * as querystring from 'querystring';

// Este ID é público e identifica sua extensão para o Spotify.
// No fluxo PKCE, ele não compromete a segurança.
const CLIENT_ID = '0f2ac217279b4edca220cdb98bf33285'; 
const REDIRECT_URI = 'http://127.0.0.1:8888/callback'; 
const SCOPES = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state'
];

export interface SpotifyTrack {
    name: string;
    artist: string;
    isPlaying: boolean;
    albumArt?: string;
    progressMs?: number;
    durationMs?: number;
}

export class SpotifyApi {
    private accessToken: string | undefined;
    private refreshToken: string | undefined;
    private codeVerifier: string | undefined;

    constructor(private context: vscode.ExtensionContext) {}

    async initialize() {
        this.refreshToken = await this.context.secrets.get('spotifyRefreshToken');
        if (this.refreshToken) {
            await this.refreshAccessToken();
        }
    }

    private generateCodeVerifier() {
        return crypto.randomBytes(32).toString('hex');
    }

    private generateCodeChallenge(codeVerifier: string) {
        return crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async getAuthUrl() {
        this.codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(this.codeVerifier);
        
        const query = querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: SCOPES.join(' '),
            redirect_uri: REDIRECT_URI,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
        });

        return `https://accounts.spotify.com/authorize?${query}`;
    }

    async handleCallback(uri: vscode.Uri) {
        const query = querystring.parse(uri.query);
        const code = query.code as string;

        if (!code || !this.codeVerifier) {
            throw new Error('Invalid callback or code verifier missing');
        }

        const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            code_verifier: this.codeVerifier,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        this.accessToken = response.data.access_token;
        this.refreshToken = response.data.refresh_token;

        if (this.refreshToken) {
            await this.context.secrets.store('spotifyRefreshToken', this.refreshToken);
        }
    }

    private async refreshAccessToken() {
        if (!this.refreshToken) { return; }

        try {
            const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
                client_id: CLIENT_ID,
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            this.accessToken = response.data.access_token;
            if (response.data.refresh_token) {
                this.refreshToken = response.data.refresh_token;
                await this.context.secrets.store('spotifyRefreshToken', this.refreshToken as string);
            }
        } catch (error) {
            console.error('Failed to refresh token', error);
            this.accessToken = undefined;
        }
    }

    private async apiRequest(method: string, endpoint: string, data?: any): Promise<any> {
        if (!this.accessToken) {
            await this.refreshAccessToken();
        }

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        try {
            const response = await axios({
                method,
                url: `https://api.spotify.com/v1${endpoint}`,
                data,
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401) {
                await this.refreshAccessToken();
                return this.apiRequest(method, endpoint, data);
            }
            throw error;
        }
    }

    async getCurrentTrack(): Promise<SpotifyTrack | undefined> {
        try {
            const data = await this.apiRequest('GET', '/me/player/currently-playing');
            if (!data || !data.item) { return undefined; }

            return {
                name: data.item.name,
                artist: data.item.artists.map((a: any) => a.name).join(', '),
                isPlaying: data.is_playing,
                albumArt: data.item.album?.images[0]?.url,
                progressMs: data.progress_ms,
                durationMs: data.item.duration_ms
            };
        } catch (e) {
            return undefined;
        }
    }

    async play() { await this.apiRequest('PUT', '/me/player/play'); }
    async pause() { await this.apiRequest('PUT', '/me/player/pause'); }
    async next() { await this.apiRequest('POST', '/me/player/next'); }
    async previous() { await this.apiRequest('POST', '/me/player/previous'); }
    async seek(positionMs: number) { 
        await this.apiRequest('PUT', `/me/player/seek?position_ms=${positionMs}`); 
    }

    isAuthenticated() {
        return !!this.accessToken || !!this.refreshToken;
    }
}
