import { google, sheets_v4 } from 'googleapis'
import * as path from 'path'
import fs from 'fs'
import readline from 'readline'
import { OAuth2Client } from 'google-auth-library'
import Sheets = sheets_v4.Sheets


const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path.resolve(__dirname + '/token.json');
const CRED_PATH = path.resolve(__dirname + '/credentials.json')

export async function loadExcel(): Promise<Sheets> {
    try {
        const content = await fs.promises.readFile(CRED_PATH);
        const auth = await authorize(JSON.parse(content.toString()));
        return google.sheets({version: 'v4', auth})
    } catch (e) {
        console.log('Error loading client secret file:', e);
        return undefined;
    }
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials: any): Promise<OAuth2Client> {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    try {
        const token = await fs.promises.readFile(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token.toString()));
    } catch (e) {
        console.log('ova', e)
        // return getNewToken(oAuth2Client);
    }
    return oAuth2Client;
}

function ask(str: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve, reject) => {
        rl.question(str, (input) => resolve(input) );
    });
}


/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
async function getNewToken(oAuth2Client: OAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const code = await ask('Enter the code from that page here: ');

    try {
        const token = await oAuth2Client.getToken(code);

        oAuth2Client.setCredentials(token.tokens);
        // Store the token to disk for later program executions
        try {
            await fs.promises.writeFile(TOKEN_PATH, JSON.stringify(token))
            console.log('Token stored to', TOKEN_PATH);
        } catch (e) {
            return console.error(e);
        }
    } catch (e) {
        return console.error('Error while trying to retrieve access token', e);
    }

    return oAuth2Client;
}
