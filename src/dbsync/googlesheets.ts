import { google, sheets_v4 } from 'googleapis'
import * as path from 'path'
import fs from 'fs'
import readline from 'readline'
import { OAuth2Client } from 'google-auth-library'
import Sheets = sheets_v4.Sheets
import { config } from 'dotenv'

config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
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
        if (!process.env.GOOGLE_DOCS_TOKEN) {
            throw new Error('missing GOOGLE_DOCS_TOKEN env variable!');
        }
        oAuth2Client.setCredentials(JSON.parse(process.env.GOOGLE_DOCS_TOKEN));
    } catch (e) {
        console.log(`can't authorize to get google docs`, e)
        throw e
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
        console.log('Here is your token. Store it in GOOGLE_DOCS_TOKEN: ', JSON.stringify(token));
    } catch (e) {
        return console.error('Error while trying to retrieve access token', e);
    }

    return oAuth2Client;
}
