-- Migration: create SSOConfig table (Single Sign-On configuration)
-- Désactivé par défaut. Configurable par l'ADMIN uniquement.
-- Supporte SAML 2.0 et OIDC / OAuth 2.0.

CREATE TABLE IF NOT EXISTS "SSOConfig" (
  "id"               TEXT         NOT NULL DEFAULT 'global',
  "enabled"          BOOLEAN      NOT NULL DEFAULT false,
  "protocol"         TEXT         NOT NULL DEFAULT 'OIDC',
  -- SAML
  "samlEntityId"     TEXT,
  "samlSsoUrl"       TEXT,
  "samlCertificate"  TEXT,
  "samlSignAlgorithm" TEXT        DEFAULT 'RSA-SHA256',
  -- OIDC
  "oidcIssuerUrl"    TEXT,
  "oidcClientId"     TEXT,
  "oidcClientSecret" TEXT,
  "oidcScopes"       TEXT         DEFAULT 'openid email profile',
  -- Common
  "autoProvision"    BOOLEAN      NOT NULL DEFAULT true,
  "defaultRole"      TEXT         NOT NULL DEFAULT 'ANALYSTE',
  "allowedDomains"   TEXT,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SSOConfig_pkey" PRIMARY KEY ("id")
);
