import { buildSequenceDiagram, type ParticipantSpec, type StepSpec } from "./sequence-build";
import type { TemplateDefinition } from "./types";

const PARTICIPANTS: ParticipantSpec[] = [
  ["User", "actor"],
  ["Web App", "product"],
  ["Identity Provider", "third-party"],
  ["Orders API", "microservice"],
];

const STEPS: StepSpec[] = [
  ["User", "Web App", "Open My orders"],
  ["Web App", "User", "Redirect to sign in", "HTTPS", "reply"],
  ["User", "Identity Provider", "Sign in (password and MFA)", "HTTPS"],
  ["Identity Provider", "Web App", "Authorisation code", "HTTPS redirect", "reply"],
  ["Web App", "Identity Provider", "Exchange code for tokens (PKCE)", "OIDC"],
  ["Identity Provider", "Web App", "ID, access and refresh tokens", undefined, "reply"],
  ["note", "Web App", "Keeps the tokens server-side; the browser only gets a session cookie"],
  ["Web App", "Orders API", "Get orders (bearer token)", "REST"],
  ["Orders API", "Orders API", "Validate token signature and scopes"],
  ["Orders API", "Web App", "Orders", undefined, "reply"],
  ["Web App", "User", "My orders page", undefined, "reply"],
];

export const oidcSignInTemplate: TemplateDefinition = {
  id: "oidc-sign-in",
  name: "Sign-in with OpenID Connect",
  description: "The authorisation code flow with PKCE: redirect to the identity provider, swap the code for tokens, then call an API with them.",
  build: () => buildSequenceDiagram("Sign-in with OpenID Connect", "Sign-in", PARTICIPANTS, STEPS),
};
