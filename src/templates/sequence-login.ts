import { sequenceFromMermaid } from "./sequence-build";
import type { TemplateDefinition } from "./types";

/** The OAuth 2.0 authorisation code flow with PKCE, as a single-page app uses it. */
const CODE = `sequenceDiagram
  autonumber
  actor User
  participant App as Web App
  participant IdP as Identity Provider
  participant API as Orders API
  User->>App: Open the app
  App-->>User: Redirect to sign-in (code challenge)
  User->>IdP: Sign in
  IdP->>IdP: Check password and MFA
  alt Credentials valid
    IdP-->>User: Redirect back with a code
    User->>App: Arrive with the code
    App->>IdP: Exchange code and verifier (HTTPS)
    IdP-->>App: Access and refresh tokens
    App->>API: Request orders with access token (REST)
    API->>API: Verify signature and expiry
    API-->>App: Orders
    App-->>User: Signed-in page
  else Credentials invalid
    IdP-->>User: Sign-in failed
  end
  opt Access token expired
    App->>IdP: Refresh token (HTTPS)
    IdP-->>App: New access token
  end
`;

export const sequenceLoginTemplate: TemplateDefinition = {
  id: "sequence-login",
  name: "Sign-in sequence (OAuth)",
  description:
    "How a user signs in to a web app with an identity provider (authorisation code with PKCE), calls an API with the token and refreshes it.",
  category: "Sequence",
  keywords: ["login", "sign in", "oauth", "oidc", "authentication", "tokens", "pkce", "sso", "identity"],
  build: () =>
    sequenceFromMermaid("Sign-in flow", "Sign-in", CODE, {
      "Web App": "product",
      "Identity Provider": "third-party",
      "Orders API": "microservice",
    }),
};
