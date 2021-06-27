declare module "@okta/okta-sdk-nodejs";

declare module 'njwt' {
    export class Jwt {

    }
    export class Verifier {
        
    }
}

declare module '@okta/jwt-verifier' {
    import { assertIssuer, assertClientId, TestingOptions } from '@okta/configuration-validation';
    import { JwksClient } from 'jwks-rsa';
    import { Jwt, Verifier } from 'njwt';

    export interface OktaClaims {
        [key: string]: string;
    }

    export interface OktaJwtVerifierOptions {
        assertClaims?: OktaClaims;
        cacheMaxAge?: number;
        clientId: string;
        issuer: string;
        jwksRequestsPerMinute?: number;
        testing?: TestingOptions;
    }

    class AssertedClaimsVerifier {
        constructor();
        errors: string[];

        extractOperator(claim: string): string | undefined;
        extractClaim(claim: string): string;
        isValidOperator(operator?: string): boolean;
        checkAssertions(op: string, claim: string, expectedValue: string | string[], actualValue?: string[]): void;
    }

    function verifyAssertedClaims(verifier: Verifier, claims: string[]): void;
    function verifyAudience(expected: string[], audience: string): void;
    function verifyAudience(expected: string | string[], audience: string): void;
    function verifyIssuer(expected: string, issuer: string): void;

    export default class OktaJwtVerifier {
        constructor(options: OktaJwtVerifierOptions);
        claimsToAssert: OktaClaims;
        issuer: string;
        jwksClient: JwksClient;
        verifier: Verifier;
        verifyAsPromise(accessToken: string): Promise<Jwt>;
        verifyAccessToken(accessToken: string, expectedAudience: string): Promise<Jwt>;
    }
}